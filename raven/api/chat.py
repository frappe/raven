import frappe
from frappe import _

from raven.api.raven_users import get_list
from raven.utils import get_channel_members as get_channel_members_util
from raven.utils import get_workspace_members


@frappe.whitelist(methods=["GET"])
def get_channel_members(channel_id: str):
	"""Members of a channel with their user details, keyed by user. An Open channel gives every workspace member."""

	frappe.has_permission("Raven Channel", doc=channel_id, throw=True)

	member_object = {}

	# This is an array
	all_users = get_list()

	# This is a dictionary
	channel_members = get_channel_members_util(channel_id)

	channel_type = frappe.get_cached_value("Raven Channel", channel_id, "type")

	if channel_type == "Open":
		workspace = frappe.get_cached_value("Raven Channel", channel_id, "workspace")
		workspace_members = get_workspace_members(workspace)

		# All workspace members are members of an open channel - merge the workspace members with channel members
		for workspace_member in workspace_members:
			channel_member = channel_members.get(workspace_member, {})
			user_obj = next((u for u in all_users if u.name == workspace_member), None)

			member_object[user_obj.name] = {
				"name": user_obj.name,
				"full_name": user_obj.full_name,
				"user_image": user_obj.user_image,
				"first_name": user_obj.first_name,
				"type": user_obj.type,
				"availability_status": user_obj.availability_status,
				"is_admin": channel_member.get("is_admin", 0),
				"allow_notifications": channel_member.get("allow_notifications", 1),
				"channel_member_name": channel_member.get("name", None),
			}

	else:
		for member in channel_members:
			channel_member = channel_members[member]
			user_obj = next((u for u in all_users if u.name == member), None)

			if user_obj:
				member_object[user_obj.name] = {
					"name": user_obj.name,
					"full_name": user_obj.full_name,
					"user_image": user_obj.user_image,
					"first_name": user_obj.first_name,
					"type": user_obj.type,
					"availability_status": user_obj.availability_status,
					"is_admin": channel_member.is_admin,
					"allow_notifications": channel_member.allow_notifications,
					"channel_member_name": channel_member.name,
				}

	return member_object
