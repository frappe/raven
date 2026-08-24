import frappe
from frappe import _
from frappe.query_builder import Order

from raven.api.raven_users import get_current_raven_user
from raven.utils import (
	delete_channel_members_cache,
	delete_workspace_members_cache,
	get_channel_members,
	get_raven_user,
	get_workspace_member,
	is_channel_member,
	is_workspace_member,
	track_channel_visit,
)


@frappe.whitelist()
def get_all_channels(hide_archived: bool | str = True):
	"""
	Fetches all channels where current user is a member - both channels and DMs
	To be used on the web app.
	"""

	if hide_archived == "false":
		hide_archived = False

	# 1. Get "channels" - public, open, private, and DMs
	channels = get_channel_list(hide_archived)

	# 2. Resolve each DM's peer from the denormalized dm_user_1/2 fields —
	# no per-channel member lookups (the old get_peer_user_id path cost one
	# cache/DB hit per DM)
	parsed_channels = []
	for channel in channels:
		parsed_channel = {
			**channel,
			"peer_user_id": get_peer_user_id_from_dm_users(channel),
		}

		parsed_channels.append(parsed_channel)

	channel_list = [channel for channel in parsed_channels if not channel.get("is_direct_message")]
	dm_list = [channel for channel in parsed_channels if channel.get("is_direct_message")]

	return {"channels": channel_list, "dm_channels": dm_list}


def get_peer_user_id_from_dm_users(channel, relative_to: str | None = None) -> str | None:
	"""
	Resolve the DM peer from dm_user_1/dm_user_2 (set on every DM since the
	v2.6 dedup patch) — no member-cache lookup. Self-message channels have
	both fields set to the user, so the same comparison covers them. Falls
	back to the member-cache lookup for the rare channel the backfill could
	not resolve.

	`channel` can be a dict row or a Raven Channel document. `relative_to`
	defaults to the session user; message hot paths pass the sender instead
	(background inserts can run as Administrator, who is in no DM).
	"""
	if not channel.get("is_direct_message"):
		return None

	me = relative_to or frappe.session.user
	user_1 = channel.get("dm_user_1")
	user_2 = channel.get("dm_user_2")
	if user_1 and user_2:
		return user_2 if user_1 == me else user_1

	return get_peer_user_id(
		channel.get("name"),
		channel.get("is_direct_message"),
		channel.get("is_self_message"),
	)


def get_channel_list(hide_archived: bool = False):
	"""
	get List of all channels where current user is a member (all includes public, private, open, and DM channels)
	"""
	channel = frappe.qb.DocType("Raven Channel")
	channel_member = frappe.qb.DocType("Raven Channel Member")

	workspace_member = frappe.qb.DocType("Raven Workspace Member")

	query = (
		frappe.qb.from_(channel)
		.select(
			channel.name,
			channel.channel_name,
			channel.type,
			channel.channel_description,
			channel.is_archived,
			channel.is_direct_message,
			channel.is_self_message,
			channel.creation,
			channel.owner,
			channel.last_message_timestamp,
			channel.last_message_details,
			channel.pinned_messages_string,
			channel.workspace,
			channel.dm_user_1,
			channel.dm_user_2,
			channel_member.name.as_("member_id"),
			channel_member.is_admin,
			channel_member.allow_notifications,
			channel_member.muted,
		)
		.left_join(channel_member)
		.on(
			(channel.name == channel_member.channel_id) & (channel_member.user_id == frappe.session.user)
		)
		.left_join(workspace_member)
		.on(
			(channel.workspace == workspace_member.workspace)
			& (workspace_member.user == frappe.session.user)
		)
		.where(
			((channel.is_direct_message == 1) & (channel_member.user_id == frappe.session.user))
			| (
				(workspace_member.user == frappe.session.user)
				& ((channel.type != "Private") | (channel_member.user_id == frappe.session.user))
			)
		)
		.where(channel.is_thread == 0)
	)

	if hide_archived:
		query = query.where(channel.is_archived == 0)

	query = query.orderby(channel.last_message_timestamp, order=Order.desc)

	return query.run(as_dict=True)


@frappe.whitelist()
def get_channels(hide_archived: bool | str = False):
	channels = get_channel_list(hide_archived)
	for channel in channels:
		peer_user_id = get_peer_user_id_from_dm_users(channel)
		channel["peer_user_id"] = peer_user_id
		if peer_user_id:
			user_full_name = frappe.get_cached_value("User", peer_user_id, "full_name")
			channel["full_name"] = user_full_name
	return channels


def get_peer_user(channel_id: str, is_direct_message: int, is_self_message: bool = False) -> dict:
	"""
	For a given channel, fetches the peer's member object
	"""
	if is_direct_message == 0:
		return None
	if is_self_message:
		return {
			"user_id": frappe.session.user,
		}

	members = get_channel_members(channel_id)

	for member in members:
		if member != frappe.session.user:
			return members[member]

	return None


def get_peer_user_id(
	channel_id: str, is_direct_message: int, is_self_message: bool = False
) -> str:
	"""
	For a given channel, fetches the user id of the peer
	"""
	peer_user = get_peer_user(channel_id, is_direct_message, is_self_message)
	if peer_user:
		return peer_user.get("user_id")
	return None


@frappe.whitelist(methods=["POST"])
def create_direct_message_channel(user_id: str):
	"""
	Creates a direct message channel between current user and the user with user_id
	The user_id can be the peer or the user themself
	1. Check if a channel already exists between the two users
	- Use dm_user_1 and dm_user_2 to check if a channel exists to prevent race condition duplicates
	2. If not, create a new channel
	3. Check if the user_id is the current user and set is_self_message accordingly
	"""
	# TODO: this logic might break if the user_id changes

	# Validate both users are Raven Users
	if not get_raven_user(frappe.session.user):
		frappe.throw(_("You need to be a Raven User to send DMs."))

	if user_id != frappe.session.user:
		if not get_raven_user(user_id):
			frappe.throw(_("The user you are trying to message is not a Raven User."))

	# Get the canonical order of the users
	if frappe.session.user > user_id:
		dm_user_1, dm_user_2 = frappe.session.user, user_id
	else:
		dm_user_1, dm_user_2 = user_id, frappe.session.user

	channel_name = frappe.db.get_value(
		"Raven Channel",
		filters={
			"is_direct_message": 1,
			"dm_user_1": dm_user_1,
			"dm_user_2": dm_user_2,
		},
		fieldname="name",
	)
	if channel_name:
		return channel_name
	# create direct message channel with user and current user
	else:
		channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": dm_user_1 + " _ " + dm_user_2,
				"is_direct_message": 1,
				"is_self_message": frappe.session.user == user_id,
			}
		)
		channel.insert()
		return channel.name


@frappe.whitelist(methods=["POST"])
def toggle_pinned_channel(channel_id: str):
	"""
	Toggles the pinned status of the channel
	"""
	raven_user = get_current_raven_user()
	pinned_channels = raven_user.pinned_channels or []

	is_pinned = False
	for pin in pinned_channels:
		if pin.channel_id == channel_id:
			raven_user.remove(pin)
			is_pinned = True
			break

	if not is_pinned:
		raven_user.append("pinned_channels", {"channel_id": channel_id})

	raven_user.save()

	return raven_user


@frappe.whitelist()
def leave_channel(channel_id: str):
	"""
	Leave a channel
	"""
	members = frappe.get_all(
		"Raven Channel Member",
		filters={"channel_id": channel_id, "user_id": frappe.session.user},
	)

	for member in members:
		frappe.delete_doc("Raven Channel Member", member.name, delete_permanently=True)

	return "Ok"


@frappe.whitelist()
def toggle_pin_message(channel_id: str, message_id: str):
	"""
	Toggle pin/unpin a message in a channel.
	"""
	channel = frappe.get_doc("Raven Channel", channel_id)

	# Check if the user is a member of the channel
	if not is_channel_member(channel_id):
		frappe.throw(_("You are not a member of this channel"))

	pinned_message = None

	# Check whether the message exists in the channel
	message_exists = frappe.db.get_value("Raven Message", message_id, "channel_id") == channel_id

	if not message_exists:
		frappe.throw(_("Message does not exist in this channel"))

		# Check if the message is already pinned
	for pm in channel.pinned_messages:
		if pm.message_id == message_id:
			pinned_message = pm
			break

	if pinned_message:
		# Unpin the message
		channel.remove(pinned_message)
	else:
		# Pin the message if it's not pinned
		channel.append("pinned_messages", {"message_id": message_id})

	channel.save(ignore_permissions=True)

	return "Ok"


@frappe.whitelist()
def mark_all_messages_as_read(channel_ids: list):
	"""
	Mark all messages in these channels as read
	"""
	user = frappe.session.user
	for channel_id in channel_ids:
		track_channel_visit(channel_id, user=user)

	return "Ok"


@frappe.whitelist()
def create_channel(
	channel_name: str, channel_description: str, type: str, workspace: str, members: list = None
):
	"""
	Create a new channel
	"""
	channel = frappe.get_doc(
		{
			"doctype": "Raven Channel",
			"channel_name": channel_name,
			"channel_description": channel_description,
			"type": type,
			"workspace": workspace,
		}
	).insert()

	if members:
		channel.add_members(members)

	return channel.as_dict()


@frappe.whitelist(methods=["POST"])
def transfer_channel_to_workspace(
	channel_id: str, target_workspace: str, add_missing_members_to_workspace: bool = False
):
	"""
	Move a Public/Private channel from its current workspace to `target_workspace`.

	Caller must be an admin of BOTH workspaces. Channel members who are not in the
	target workspace are either added to it (add_missing_members_to_workspace) or
	dropped from the channel. Child threads follow. The channel PK is left
	unchanged (opaque) — only the `workspace` field moves, so no rename cascade.
	"""
	channel = frappe.get_doc("Raven Channel", channel_id)

	# --- Validation ---
	if channel.type not in ("Public", "Private"):
		frappe.throw(_("Only Public or Private channels can be transferred"))
	# Threads are type="Private" (so they pass the check above) — the is_thread
	# flag is what excludes them; DMs/self-messages (type=None) are already caught.
	if channel.is_direct_message or channel.is_self_message or channel.is_thread:
		frappe.throw(_("This channel type cannot be transferred"))

	source_workspace = channel.workspace
	if target_workspace == source_workspace:
		frappe.throw(_("The channel is already in this workspace"))
	if not frappe.db.exists("Raven Workspace", target_workspace):
		frappe.throw(_("Target workspace does not exist"))

	# Name collision: B must not already have a non-DM channel with this name.
	if frappe.db.exists(
		"Raven Channel",
		{
			"workspace": target_workspace,
			"channel_name": channel.channel_name,
			"is_direct_message": 0,
		},
	):
		frappe.throw(_("A channel with this name already exists in the target workspace"))

	# --- Authorization: admin of BOTH workspaces ---
	for ws in (source_workspace, target_workspace):
		member = get_workspace_member(ws, frappe.session.user)
		if not (member and member.get("is_admin")):
			frappe.throw(_("You must be an admin of both workspaces"), frappe.PermissionError)

	# --- Reconcile members against the target workspace ---
	# Explicit channel members (Public/Private). For each member not in B, either
	# add them to B (opt-in) or drop them from the channel.
	for user_id in list(get_channel_members(channel_id).keys()):
		if is_workspace_member(target_workspace, user_id):
			continue
		if add_missing_members_to_workspace:
			frappe.get_doc(
				{
					"doctype": "Raven Workspace Member",
					"workspace": target_workspace,
					"user": user_id,
					"is_admin": 0,
				}
			).insert(ignore_permissions=True)
		else:
			# Raw delete — bypass RavenChannelMember.after_delete, which would post
			# spurious "X left."/"removed X" system messages, reassign channel admin,
			# or auto-archive an emptied channel. None of that should happen on a
			# transfer (members are pruned for workspace access, not leaving).
			frappe.db.delete("Raven Channel Member", {"channel_id": channel_id, "user_id": user_id})

	# Membership of both workspaces / the channel changed — drop caches.
	delete_channel_members_cache(channel_id)
	delete_workspace_members_cache(target_workspace)

	# --- Move (PK unchanged) ---
	channel.workspace = target_workspace
	channel.flags.ignore_channel_member_check = True
	channel.save(ignore_permissions=True)
	# channel.save() fires Raven Channel.on_update -> publishes "channel_list_updated"
	# to the global Raven room, so every client refetches its workspace-scoped list
	# (the channel leaves A's sidebar and appears in B's). No manual event needed.

	# Move child threads. A thread is a Raven Channel whose channel_name is a
	# message id; its parent is that message's channel. Find threads spawned from
	# messages in this channel and move their workspace too (PKs stay opaque).
	message = frappe.qb.DocType("Raven Message")
	thread = frappe.qb.DocType("Raven Channel")
	child_threads = (
		frappe.qb.from_(thread)
		.join(message)
		.on(thread.channel_name == message.name)
		.select(thread.name)
		.where(thread.is_thread == 1)
		.where(message.channel_id == channel_id)
		.run(pluck=True)
	)
	if child_threads:
		frappe.qb.update(thread).set(thread.workspace, target_workspace).where(
			thread.name.isin(child_threads)
		).run()

	return "Ok"
