import datetime

import frappe
from frappe import _
from frappe.query_builder import Order

from raven.utils import track_channel_visit


def message_columns(message):
	"""The columns every chat stream endpoint returns for a message.
	Shared: get_message_batch (raven_message.py) selects the same set, so a
	batch fetched for the thread header renders exactly like the stream."""
	return (
		message.name,
		message.owner,
		message.creation,
		message.modified,
		message.text,
		message.file,
		message.file_size,
		message.message_type,
		message.message_reactions,
		message.is_reply,
		message.linked_message,
		message._liked_by,
		message.channel_id,
		message.thumbnail_width,
		message.thumbnail_height,
		message.file_thumbnail,
		message.link_doctype,
		message.link_document,
		message.replied_message_details,
		message.content,
		message.is_edited,
		message.is_forwarded,
		message.poll_id,
		message.is_bot_message,
		message.bot,
		message.hide_link_preview,
		message.is_thread,
		message.blurhash,
		message.message_batch_id,
		message.links,
		message.json,
	)


# Safety cap. A window is ~30 messages, so 100 distinct links is already
# extreme. Urls past the cap are not lost — the client asks for them later
# through the normal get_previews call.
_SIDECAR_MAX_URLS = 100


def _link_previews_sidecar(messages) -> dict:
	"""
	Collect every link in this window of messages and return their stored
	previews, keyed by the RAW url. This is the "side-car" from Phase 5 of
	docs/link-previews-plan.md.

	Why it exists: the client seeds its preview store from this BEFORE it
	renders the messages. Cards then appear together with their messages,
	instead of one network round-trip later — that late pop-in is what made
	the stream jump. The preview status rides along too, so the client can
	tell "still fetching" apart from "failed or blocked, never coming".

	The list rides on the RESPONSE, next to the messages. It is not part of
	the message objects, and message caches must never store it (see the
	plan doc's watch items).

	Read-only. A window with no links returns an empty dict and runs no
	query.
	"""
	from raven.api.preview_links import previews_for_urls

	urls = []
	seen = set()
	for message in messages:
		if not message.links:
			continue
		# message.links is a newline-joined string of raw hrefs. The client
		# extracts the same spellings from the message, so the keys match.
		for url in message.links.split("\n"):
			url = url.strip()
			if url and url not in seen:
				seen.add(url)
				urls.append(url)

	if not urls:
		return {}

	return previews_for_urls(urls[:_SIDECAR_MAX_URLS])


def _complete_boundary_batch(channel_id: str, boundary, older: bool):
	"""
	Batches (shared message_batch_id) must never be cut at a page edge —
	otherwise the UI renders a partial album that visibly grows when the next
	page loads. If the boundary message of a page is part of a batch, fetch the
	batch members that lie beyond the boundary so the page contains the whole
	batch. Returns the extra messages in the same order as the caller's page.
	"""
	if not boundary.message_batch_id:
		return []

	message = frappe.qb.DocType("Raven Message")
	if older:
		condition = (message.creation < boundary.creation) | (
			(message.creation == boundary.creation) & (message.name < boundary.name)
		)
		order = Order.desc
	else:
		condition = (message.creation > boundary.creation) | (
			(message.creation == boundary.creation) & (message.name > boundary.name)
		)
		order = Order.asc

	return (
		frappe.qb.from_(message)
		.select(*message_columns(message))
		.where(message.channel_id == channel_id)
		.where(message.message_batch_id == boundary.message_batch_id)
		.where(condition)
		.orderby(message.creation, order=order)
		.orderby(message.name, order=order)
		.run(as_dict=True)
	)


@frappe.whitelist()
def get_messages(
	channel_id: str,
	limit: int = 20,
	base_message: str | None = None,
	update_last_visit: bool = True,
	anchor_to_unread: bool = False,
):
	"""
	API to get list of messages for a channel, ordered by creation date (newest first)

	`update_last_visit` (DEPRECATED, v2-compat): when True the fetch also advances the
	caller's last_visit. The v3 client tracks last_visit itself (a debounced watermark
	via raven_channel_member.track_visit), so it passes False — this avoids a write to
	the Raven Channel Member row inside the read transaction, which can collide with a
	concurrent message send and surface as a QueryDeadlockError (MariaDB 1020). Remove
	this flag and the GET-time write once v2 is gone.

	`anchor_to_unread` (v3): when True and the caller has unread messages (anything created
	after their last_visit), the returned window is centered on the FIRST unread message
	instead of the latest page — so the client can render a "New messages" divider and land
	the user on it. Backward-compatible: v2 omits it (defaults False) and keeps getting the
	latest page. Ignored when `base_message` is given (an explicit jump wins), and a no-op
	when the caller has never visited (no last_visit → show recent, no divider).
	"""

	# Check permission for channel access
	if not frappe.has_permission(doctype="Raven Channel", doc=channel_id, ptype="read"):
		frappe.throw(_("You do not have permission to access this channel"), frappe.PermissionError)

	# An explicit jump-to-message (reply click / deep link) always wins.
	if base_message and frappe.db.exists("Raven Message", base_message):
		return get_messages_around_base(channel_id, base_message, limit)

	# The member's current read watermark: returned so the v3 client can baseline its own
	# last_visit tracking, and used below to locate the unread boundary. Read before the
	# optional legacy write further down.
	last_visit = frappe.db.get_value(
		"Raven Channel Member",
		{"channel_id": channel_id, "user_id": frappe.session.user},
		"last_visit",
	)

	# v3 unread divider: center the window on the first unread message so the client can show
	# the "New messages" line and scroll there. Only when the caller has visited before
	# (last_visit set) and there's something newer — otherwise fall through to the latest page.
	if anchor_to_unread and last_visit:
		# Exclude System messages ("X joined", etc.) and the caller's OWN messages —
		# your own message is never "new" to you. Sending does not advance last_visit
		# on the server (only the client's read tracker does, later), so without the
		# owner filter the divider often anchored on the user's own message — most
		# visibly in threads, where the member row is created just before the first
		# reply. Bot messages are the exception: a bot can post with owner set to
		# this user, and the user didn't write those — they count as new. Hence the
		# or_filters: keep a message when someone else wrote it OR a bot wrote it.
		first_unread = frappe.db.get_all(
			"Raven Message",
			pluck="name",
			filters={
				"channel_id": channel_id,
				"creation": (">", last_visit),
				"message_type": ("!=", "System"),
			},
			or_filters=[
				["owner", "!=", frappe.session.user],
				["is_bot_message", "=", 1],
			],
			order_by="creation asc, name asc",
			limit=1,
		)
		if first_unread:
			result = get_messages_around_base(channel_id, first_unread[0], limit)
			result["last_visit"] = last_visit
			result["first_unread_message"] = first_unread[0]
			return result

	# Default (also the v2 path): the latest page, ordered newest-first.
	# Cannot use `get_all` as it does not apply the `order_by` clause to multiple fields
	message = frappe.qb.DocType("Raven Message")

	messages = (
		frappe.qb.from_(message)
		.select(*message_columns(message))
		.where(message.channel_id == channel_id)
		.orderby(message.creation, order=Order.desc)
		.orderby(message.name, order=Order.desc)
		.limit(limit)
		.run(as_dict=True)
	)

	has_old_messages = False

	# Check if older messages are available
	if len(messages) == limit:
		# Never cut a batch at the page edge — include its remaining members
		messages.extend(_complete_boundary_batch(channel_id, messages[-1], older=True))

		# Check if there are more messages available
		older_message = frappe.db.get_all(
			"Raven Message",
			pluck="name",
			filters={"channel_id": channel_id, "creation": ("<", messages[-1].creation)},
			order_by="creation desc, name desc",
			limit=1,
		)

		if len(older_message) > 0:
			has_old_messages = True

	if update_last_visit:
		track_channel_visit(channel_id=channel_id, commit=True)
	return {
		"messages": messages,
		"has_old_messages": has_old_messages,
		"has_new_messages": False,
		"last_visit": last_visit,
		"previews": _link_previews_sidecar(messages),
	}


def get_messages_around_base(channel_id: str, base_message: str, limit: int = 20):
	"""
	Get messages around the base message — half the limit on each side
	(the newer half includes the base message itself)
	"""
	# Fetch older messages for the channel
	from_timestamp = frappe.get_cached_value("Raven Message", base_message, "creation")
	half_limit = max(limit // 2, 1)

	# TODO: Optimize this to use a complex SQL query to fetch around the main message
	older_messages = fetch_older_messages(channel_id, base_message, from_timestamp, half_limit)
	newer_messages = fetch_newer_messages(
		channel_id, base_message, from_timestamp, half_limit, include_from_message=True
	)

	combined_messages = newer_messages.get("messages", []) + older_messages.get("messages", [])

	return {
		**older_messages,
		**newer_messages,
		"messages": combined_messages,
		"previews": _link_previews_sidecar(combined_messages),
		"from_timestamp": from_timestamp,
		"last_visit": frappe.db.get_value(
			"Raven Channel Member",
			{"channel_id": channel_id, "user_id": frappe.session.user},
			"last_visit",
		),
	}


@frappe.whitelist()
def get_older_messages(channel_id: str, from_message: str, limit: int = 20):
	"""
	API to get older messages for a channel, ordered by creation date (newest first)

	Function is split into two to avoid duplicate perm check and timestamp check
	"""

	# Check permission for channel access
	if not frappe.has_permission(doctype="Raven Channel", doc=channel_id, ptype="read"):
		frappe.throw(_("You do not have permission to access this channel"), frappe.PermissionError)
	# Fetch older messages for the channel
	from_timestamp = frappe.get_cached_value("Raven Message", from_message, "creation")

	return fetch_older_messages(channel_id, from_message, from_timestamp, limit)


def fetch_older_messages(
	channel_id: str, from_message: str, from_timestamp: datetime.datetime, limit: int = 20
):
	# Cannot use `get_all` as it does not apply the `order_by` clause to multiple fields
	message = frappe.qb.DocType("Raven Message")

	messages = (
		frappe.qb.from_(message)
		.select(*message_columns(message))
		.where(message.channel_id == channel_id)
		.where(
			(message.creation < from_timestamp)
			| ((message.creation == from_timestamp) & (message.name < from_message))
		)
		.orderby(message.creation, order=Order.desc)
		.orderby(message.name, order=Order.desc)
		.limit(limit)
		.run(as_dict=True)
	)

	has_old_messages = False

	# Check if older messages are available
	if len(messages) == limit:
		# Never cut a batch at the page edge — include its remaining members
		messages.extend(_complete_boundary_batch(channel_id, messages[-1], older=True))

		# Check if there are more messages available
		older_message = frappe.db.get_all(
			"Raven Message",
			pluck="name",
			filters={
				"channel_id": channel_id,
				"creation": ("<=", messages[-1].creation),
				"name": ["!=", messages[-1].name],
			},
			order_by="creation desc, name desc",
			limit=1,
		)

		if len(older_message) > 0:
			has_old_messages = True

	return {
		"messages": messages,
		"has_old_messages": has_old_messages,
		"previews": _link_previews_sidecar(messages),
	}


@frappe.whitelist()
def get_newer_messages(
	channel_id: str, from_message: str, limit: int = 20, update_last_visit: bool = True
):
	"""
	API to get older messages for a channel, ordered by creation date (newest first)

	`update_last_visit` (DEPRECATED, v2-compat): see get_messages. v3 passes False and
	advances last_visit itself, avoiding a GET-time write that can collide with a
	concurrent send. Remove with v2.
	"""

	# Check permission for channel access
	if not frappe.has_permission(doctype="Raven Channel", doc=channel_id, ptype="read"):
		frappe.throw(_("You do not have permission to access this channel"), frappe.PermissionError)

	# Fetch older messages for the channel
	from_timestamp = frappe.get_cached_value("Raven Message", from_message, "creation")

	response = fetch_newer_messages(
		channel_id, from_message, from_timestamp, limit, include_from_message=False
	)

	if update_last_visit and response.get("has_new_messages") == False:
		# If no newer messages are available, we can track it as a visit to the channel
		# There are cases when we want to publish the unread count update event for a specific user
		# Example: The user is viewing an older message in a channel. If a new message comes up, the sidebar shows an unread count
		# Now if the user scrolls to the bottom, we need to update the unread count
		track_channel_visit(channel_id=channel_id, commit=True, publish_event_for_user=True)

	return response


def fetch_newer_messages(
	channel_id: str,
	from_message: str,
	from_timestamp: datetime.datetime,
	limit: int = 20,
	include_from_message: bool = False,
):

	message = frappe.qb.DocType("Raven Message")

	if include_from_message:
		condition = (message.creation > from_timestamp) | (
			(message.creation == from_timestamp) & (message.name >= from_message)
		)

	else:
		condition = (message.creation > from_timestamp) | (
			(message.creation == from_timestamp) & (message.name > from_message)
		)

	messages = (
		frappe.qb.from_(message)
		.select(*message_columns(message))
		.where(message.channel_id == channel_id)
		.where(condition)
		.orderby(message.creation, order=Order.asc)
		.orderby(message.name, order=Order.asc)
		.limit(limit)
		.run(as_dict=True)
	)

	has_new_messages = False

	# Check if newer messages are available
	if len(messages) == limit:
		# Never cut a batch at the page edge — include its remaining members
		messages.extend(_complete_boundary_batch(channel_id, messages[-1], older=False))

		# Check if there are more messages available
		newer_message = frappe.db.get_all(
			"Raven Message",
			pluck="name",
			filters={
				"channel_id": channel_id,
				"creation": (">=", messages[-1].creation),
				"name": ["!=", messages[-1].name],
			},
			order_by="creation asc, name asc",
			limit=1,
		)

		if len(newer_message) > 0:
			has_new_messages = True

	# The messages are in ascending order, so reverse them
	messages.reverse()
	return {
		"messages": messages,
		"has_new_messages": has_new_messages,
		"previews": _link_previews_sidecar(messages),
	}
