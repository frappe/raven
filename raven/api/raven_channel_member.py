import frappe
from frappe import _

from raven.utils import (
	create_members_added_system_message,
	delete_channel_members_cache,
	get_channel_member,
)
from raven.utils import get_channel_members as get_channel_members_util
from raven.utils import get_workspace_members, set_channel_unread, track_channel_visit


@frappe.whitelist()
def remove_channel_member(user_id: str, channel_id: str):
	# Get raven channel member name where user_id and channel_id match
	member = get_channel_member(channel_id, user_id)
	# Delete raven channel member
	if member:
		frappe.delete_doc("Raven Channel Member", member["name"], delete_permanently=True)
	else:
		frappe.throw(_("User is not a member of this channel"))

	return True


@frappe.whitelist(methods=["POST"])
def track_visit(channel_id: str, last_visit: str = None):
	"""
	Track the last visit of the user to the channel.

	`last_visit` is the read watermark — the creation timestamp of the newest
	message the user has seen. The client flushes it (debounced) as the user
	scrolls and on channel exit / tab hide; omitting it marks the channel read as
	of now. The value is clamped server-side (never future, never backward).

	Publishes to the user's other sessions so reading on one device clears the
	unread badge on the rest.

	Returns True when the visit was recorded, False when the site is in read-only
	mode (the write would fail). The client's boot.read_only flag is a page-load
	snapshot, so this response is its only LIVE signal — a False tells it to queue
	the watermark (visit outbox) and replay it after maintenance ends.
	"""

	# Read-only mode (maintenance with reads allowed): decline cleanly instead of
	# letting the write below blow up against the read-only connection.
	if frappe.flags.read_only:
		return False

	# On v3, the client sends the last_visit only on the basis of viewing a more reecent message and hence this needs to be broadcasted back to the user.
	# On v2, this is called when the user enters/exists a channel, without the timestamp - should not be published to the user.

	# So temp fix for DM sorting error in v2 mentioned by Mangesh
	publish_event_for_user = False
	if last_visit:
		publish_event_for_user = True
	# No explicit commit: this is a POST, which auto-commits on success.
	track_channel_visit(
		channel_id=channel_id, last_visit=last_visit, publish_event_for_user=publish_event_for_user
	)
	return True


@frappe.whitelist(methods=["POST"])
def mark_channel_as_unread(channel_id: str, message_id: str = None):
	"""
	Mark a channel as unread for the current user. Message-anchored: the anchor
	message and everything after it become unread. Returns the resulting unread
	count (also broadcast to the user's other sessions for live badge updates).
	"""
	frappe.has_permission("Raven Channel", doc=channel_id, throw=True)
	return set_channel_unread(channel_id=channel_id, message_id=message_id)


@frappe.whitelist(methods=["POST"])
def add_channel_members(channel_id: str, members: list[str]):
	"""
	Add members to a channel
	"""

	# Since this is a bulk operation, we need to disable cache invalidation (will be handled manually) and ignore permissions (since we already have permission to add members)

	for member in members:
		member_doc = frappe.get_doc(
			{"doctype": "Raven Channel Member", "channel_id": channel_id, "user_id": member}
		)
		member_doc.flags.ignore_cache_invalidation = True
		# One combined system message for the whole batch is sent below —
		# per-member messages would flood the channel ("added X" ten times).
		member_doc.flags.ignore_system_message = True
		member_doc.insert()

	if not members:
		return True

	# ONE "A added B, C and n others" message for the whole action. Same
	# visibility rule as single additions: no system messages in DMs or Open channels.
	channel = frappe.get_cached_doc("Raven Channel", channel_id)
	if not channel.is_direct_message and channel.type != "Open":
		create_members_added_system_message(channel_id, members)

	delete_channel_members_cache(channel_id)
	return True


@frappe.whitelist(methods=["GET"])
def get_channel_members(channel_id: str):
	frappe.has_permission("Raven Channel", doc=channel_id, throw=True)

	members_object = {}

	# This is a dictionary
	channel_members = get_channel_members_util(channel_id)

	channel_type = frappe.get_cached_value("Raven Channel", channel_id, "type")

	if channel_type == "Open":
		workspace = frappe.get_cached_value("Raven Channel", channel_id, "workspace")
		workspace_members = get_workspace_members(workspace)

		# All workspace members are members of an open channel - merge the workspace members with channel members
		for workspace_member in workspace_members:
			channel_member = channel_members.get(workspace_member, {})

			members_object[workspace_member] = {
				"is_admin": channel_member.get("is_admin", 0),
				"channel_member_name": channel_member.get("name", None),
			}

	else:
		for member in channel_members:
			channel_member = channel_members[member]

			members_object[member] = {
				"is_admin": channel_member.is_admin,
				"channel_member_name": channel_member.name,
			}

	return members_object
