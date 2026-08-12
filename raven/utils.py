from datetime import timedelta

import frappe
from frappe import _
from frappe.query_builder import Order
from frappe.query_builder.functions import Coalesce, Count


def get_raven_room():
	"""
	Room which any user with the role "Raven User" is subscribed to.
	"""
	# When they open the app, the will be subscribed to the users list.
	# We are just using the doctype room to send events to them
	# If we use "all" instead, then the events are only sent to System Users and not users who do not have Desk access.
	return "doctype:Raven User"


def track_channel_visit(
	channel_id, user=None, commit=False, publish_event_for_user=False, last_visit=None
):
	"""
	Track the last visit of the user to the channel.
	If the user is not a member of the channel, create a new member record.

	`last_visit` is the read watermark — typically the creation timestamp of the
	newest message the user has actually seen. The client flushes it (debounced)
	as the user scrolls, so unread counts (messages with creation > last_visit)
	track reading progress precisely instead of marking everything read on exit.

	The value is clamped server-side: it can never run ahead of the server clock,
	and it can never roll a member's existing last_visit backward — so an
	out-of-order or stale flush from the client cannot un-read messages. When
	omitted, "now" is used (e.g. tracking a plain visit on exit).
	"""

	# TODO(read-only): on a read replica / maintenance window the visit is
	# silently dropped, so unread counts come back stale once writes resume. The
	# fix is client-side — detect the read-only response and re-flush the watermark
	# on recovery (or queue it). Handle when we harden offline/sync.
	if frappe.flags.read_only:
		return

	if not user:
		user = frappe.session.user

	# Clamp the target to "now" — a client watermark must never be in the future
	now_dt = frappe.utils.get_datetime(frappe.utils.now())
	target_dt = now_dt
	if last_visit:
		parsed = frappe.utils.get_datetime(last_visit)
		if parsed:
			target_dt = min(parsed, now_dt)

	# Get the channel member record
	channel_member = get_channel_member(channel_id, user)

	if channel_member:
		# Single atomic, monotonic update: advance last_visit only when the new
		# watermark is later than the stored one — the guard lives in the WHERE
		# clause (Coalesce covers members who've never visited), so there's no
		# read-modify-write window for concurrent flushes to race through.
		member = frappe.qb.DocType("Raven Channel Member")
		(
			frappe.qb.update(member)
			.set(member.last_visit, target_dt)
			.where(member.name == channel_member["name"])
			.where(Coalesce(member.last_visit, "2000-01-01 00:00:00") < target_dt)
		).run()

	# Else if the user is not a member of the channel and the channel is open, create a new member record
	elif frappe.get_cached_value("Raven Channel", channel_id, "type") == "Open":
		frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": channel_id,
				"user_id": frappe.session.user,
				"last_visit": target_dt,
			}
		).insert()

	# TODO(no-commit): this explicit commit only exists because some callers update
	# last_visit during GET requests (chat_stream), which don't auto-commit. Once
	# those move off GET-time writes, drop the `commit` param entirely — POST
	# requests already commit on success. Kept for now to preserve v2 behaviour.
	if commit:
		frappe.db.commit()  # nosempgrep

	if publish_event_for_user:
		# Update all clients with the "last visit" timestamp for this channel for this user
		# Same event is used when sending a message in v3 - but that contains the last message timestamp
		# Which is the datetime of the latest message in the channel.
		# This event is broadcasted back to the user to update the last visit timestamp for this channel for this user
		frappe.publish_realtime(
			"raven:unread_channel_count_updated",
			{
				"channel_id": channel_id,
				"sent_by": frappe.session.user,
				"last_visit": str(target_dt),
				"event_type": "track_visit",
			},
			user=user,
		)


def set_channel_unread(channel_id: str, message_id: str = None, user: str = None):
	"""
	Mark a channel unread by rolling `last_visit` backward to just below an
	anchor message — the anchor and everything after it become unread.

	Anchor: `message_id` when given, else the latest non-System message in the
	channel. The new watermark is set one microsecond below the anchor's
	creation, so the anchor becomes the first unread message and everything
	before it stays read (when the anchor is the channel's first message this
	marks the whole channel unread).

	This is the one intentional *backward* watermark move, so it writes
	`last_visit` directly and bypasses the monotonic guard in
	`track_channel_visit`. Creates a Raven Channel Member record if the user has
	none, but ONLY for Open channels (mirrors `track_channel_visit`). For
	non-Open channels with no member record this is a no-op — inserting a member
	record there would fire `after_insert` and emit a spurious "X joined." system
	message, which must not happen for a read-state operation.
	"""
	if not user:
		user = frappe.session.user

	message = frappe.qb.DocType("Raven Message")

	# Resolve the anchor message's creation.
	if message_id:
		anchor = frappe.db.get_value(
			"Raven Message", message_id, ["channel_id", "creation"], as_dict=True
		)
		if not anchor or anchor.channel_id != channel_id:
			frappe.throw(_("Message does not belong to this channel"))
	else:
		anchor_rows = (
			frappe.qb.from_(message)
			.select(message.creation)
			.where(message.channel_id == channel_id)
			.where(message.message_type != "System")
			.orderby(message.creation, order=Order.desc)
			.orderby(message.name, order=Order.desc)
			.limit(1)
			.run(as_dict=True)
		)
		if not anchor_rows:
			# No eligible message — nothing to mark unread.
			return
		anchor = anchor_rows[0]

	# Anchor (and everything after) must be unread. Consumers test unread as
	# `message.creation > last_visit` (timestamp-only) and `creation` is
	# datetime(6), so a watermark one microsecond below the anchor makes the
	# anchor the first unread message while every earlier message stays read.
	# This also handles "anchor is the first message" (whole channel unread)
	# without a sentinel, and avoids a separate previous-message query.
	new_watermark = frappe.utils.get_datetime(anchor.creation) - timedelta(microseconds=1)

	channel_member = get_channel_member(channel_id, user)
	if channel_member:
		# Direct backward write — deliberately no monotonic guard.
		frappe.db.set_value("Raven Channel Member", channel_member["name"], "last_visit", new_watermark)
	else:
		# Only auto-create a member record for Open channels (mirrors
		# track_channel_visit). Inserting into a non-Open channel fires
		# after_insert, which posts a public "X joined." system message — an
		# unwanted side effect for a read-state operation.
		if frappe.get_cached_value("Raven Channel", channel_id, "type") != "Open":
			return

		# insert() bypasses the monotonic guard in before_insert (which sets
		# last_visit to now()), so we correct the watermark with set_value after.
		new_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": channel_id,
				"user_id": user,
			}
		).insert(ignore_permissions=True)
		# RavenChannelMember.before_insert force-sets last_visit = now(), so we
		# insert first, then correct the watermark backward via set_value. There is
		# a negligible same-request window where the record reads as fully read.
		frappe.db.set_value("Raven Channel Member", new_member.name, "last_visit", new_watermark)

	from raven.api.raven_message import get_unread_count_for_channel

	unread_count = get_unread_count_for_channel(channel_id)

	frappe.publish_realtime(
		"raven:unread_channel_count_updated",
		{
			"channel_id": channel_id,
			"sent_by": user,
			"last_visit": str(new_watermark),
			"event_type": "mark_unread",
			"unread_count": unread_count,
		},
		user=user,
	)
	return unread_count


# Workspace Members
def get_workspace_members(workspace_id: str):
	"""
	Gets all members of a workspace from the cache
	"""
	cache_key = f"raven:workspace_members:{workspace_id}"

	data = frappe.cache().get_value(cache_key)
	if data:
		return data

	members = frappe.db.get_all(
		"Raven Workspace Member",
		filters={"workspace": workspace_id},
		fields=["name", "user", "is_admin"],
	)

	data = {member.user: member for member in members}
	frappe.cache().set_value(cache_key, data)
	return data


def delete_workspace_members_cache(workspace_id: str):
	cache_key = f"raven:workspace_members:{workspace_id}"
	frappe.cache().delete_value(cache_key)


def get_workspace_member(workspace_id: str, user: str = None) -> dict:
	"""
	Get the workspace member ID
	"""
	if not user:
		user = frappe.session.user

	return get_workspace_members(workspace_id).get(user, None)


def is_workspace_member(workspace_id: str, user: str = None) -> bool:
	"""
	Check if a user is a member of a workspace
	"""
	if not user:
		user = frappe.session.user

	all_members = get_workspace_members(workspace_id)

	return user in all_members


def get_channel_members(channel_id: str):
	"""
	Gets all members of a channel from the cache as a map - also includes the type of the user
	"""
	cache_key = f"raven:channel_members:{channel_id}"

	data = frappe.cache().get_value(cache_key)
	if data:
		return data

	raven_channel_member = frappe.qb.DocType("Raven Channel Member")
	raven_user = frappe.qb.DocType("Raven User")

	query = (
		frappe.qb.from_(raven_channel_member)
		.join(raven_user)
		.on(raven_channel_member.user_id == raven_user.name)
		.select(
			raven_channel_member.name,
			raven_channel_member.user_id,
			raven_channel_member.is_admin,
			raven_channel_member.allow_notifications,
			raven_user.type,
		)
		.where(raven_channel_member.channel_id == channel_id)
		.where(raven_user.enabled == 1)
	)

	members = query.run(as_dict=True)

	data = {member.user_id: member for member in members}
	frappe.cache().set_value(cache_key, data)
	return data


def delete_channel_members_cache(channel_id: str):
	"""
	Delete the channel members cache and clear the push tokens for the channel if the flag is set to True

	By default, the push tokens are cleared when the channel members cache is deleted
	"""
	cache_key = f"raven:channel_members:{channel_id}"
	frappe.cache().delete_value(cache_key)

	frappe.publish_realtime(
		"channel_members_updated",
		{"channel_id": channel_id},
		room=get_raven_room(),
		after_commit=True,
	)


def get_channel_member(channel_id: str, user: str = None) -> dict:
	"""
	Get the channel member ID
	"""

	if not user:
		user = frappe.session.user

	all_members = get_channel_members(channel_id)

	return all_members.get(user, None)


def is_channel_member(channel_id: str, user: str = None) -> bool:
	"""
	Check if a user is a member of a channel
	"""
	if not user:
		user = frappe.session.user

	return user in get_channel_members(channel_id)


def get_raven_user(user_id: str) -> str:
	"""
	Get the Raven User ID of a user
	"""
	# TODO: Run this via cache
	raven_user = frappe.qb.DocType("Raven User")
	query = (
		frappe.qb.from_(raven_user)
		.select(raven_user.name)
		.where((raven_user.user == user_id) | (raven_user.bot == user_id))
		.limit(1)
	)

	result = query.run(pluck=True)

	return result[0] if result else None


def create_members_added_system_message(channel_id: str, member_ids: list[str]):
	"""
	ONE system message for one member-addition ACTION — single or bulk (adding 10
	people must not produce 10 messages).

	The structured payload goes in the message's `json` field so clients can render
	a translated string with live user names. `text` still carries a plain-English
	summary ("A added B, C, D and 2 others.") for clients that only render the bare
	string (v2 compatibility).
	"""
	added_by = frappe.session.user
	added_by_name = frappe.get_cached_value("Raven User", added_by, "full_name")
	# The text summary only ever SHOWS the first 3 names — don't resolve the rest
	# (a 200-member bulk add shouldn't do 200 lookups for a teaser). Clients render
	# the full list from the ids in the payload.
	teaser_names = [
		frappe.get_cached_value("Raven User", member_id, "full_name") for member_id in member_ids[:3]
	]

	if len(member_ids) == 1:
		summary = f"{added_by_name} added {teaser_names[0]}."
	elif len(member_ids) <= 3:
		summary = f"{added_by_name} added {', '.join(teaser_names[:-1])} and {teaser_names[-1]}."
	else:
		summary = f"{added_by_name} added {', '.join(teaser_names)} and {len(member_ids) - 3} others."

	frappe.get_doc(
		{
			"doctype": "Raven Message",
			"channel_id": channel_id,
			"message_type": "System",
			"text": summary,
			"json": frappe.as_json({"event": "members_added", "added_by": added_by, "members": member_ids}),
		}
	).insert(ignore_permissions=True)


def count_thread_replies(thread_id: str) -> int:
	"""
	Count the replies in a thread, where a BATCH send (multiple attachments + an
	optional caption sharing one message_batch_id) counts as ONE reply — it's a
	single logical message stored as several rows. Standalone messages (no batch
	id) count individually; System messages don't count at all. Same batch
	collapsing as the unread counts (get_unread_count_for_channels).
	"""
	message = frappe.qb.DocType("Raven Message")
	result = (
		frappe.qb.from_(message)
		.select(Count(Coalesce(message.message_batch_id, message.name)).distinct())
		.where(message.channel_id == thread_id)
		.where(message.message_type != "System")
		.run()
	)
	return result[0][0] if result else 0


def get_thread_reply_count(thread_id: str) -> int:
	"""
	Get the number of replies in a thread (a batch = one reply), cached.
	"""
	return frappe.cache().hget(
		"raven:thread_reply_count",
		thread_id,
		lambda: count_thread_replies(thread_id),
	)


def refresh_thread_reply_count(thread_id: str):
	"""
	Refresh the thread reply count (a batch = one reply)
	"""
	new_count = count_thread_replies(thread_id)
	frappe.cache().hset("raven:thread_reply_count", thread_id, new_count)

	return new_count


def clear_thread_reply_count_cache(thread_id: str):
	"""
	Clear the thread reply count cache
	"""
	frappe.cache().hdel("raven:thread_reply_count", thread_id)


def make_api_call(url: str, api_key: str, api_secret: str, method: str, params: dict = None):
	"""
	Make an API call to the given URL
	"""
	from base64 import b64encode

	import requests

	token = b64encode(f"{api_key}:{api_secret}".encode()).decode()
	auth_header = {"Authorization": f"Basic {token}"}

	if method == "GET":
		response = requests.get(url, headers=auth_header, params=params)
	elif method == "POST":
		response = requests.post(url, headers=auth_header, json=params)

	# return response.json only if the response is successful
	if not response.ok:
		frappe.log_error(
			title="Raven Cloud API Error",
			message=f"Failed to make API call to {url}: {response.status_code} {response.text}",
		)
		raise Exception(f"Failed to make API call to {url}: {response.status_code} {response.text}")

	# Return the JSON response
	return response.json()
