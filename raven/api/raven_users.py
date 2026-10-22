import json

import frappe
from frappe import _
from frappe.utils.caching import redis_cache

from raven.api.raven_channel_member import add_channel_members
from raven.api.workspaces import add_workspace_members
from raven.api.workspaces import get_list as get_workspace_list
from raven.install import RAVEN_USER_PROFILE


@frappe.whitelist(methods=["GET"])
def get_current_raven_user():
	"""
	Fetches the current user's Raven User profile
	"""

	# Check if the user is a Raven User and has the "Raven User" role
	# If not, then throw an error
	if not frappe.has_permission("Raven User"):
		frappe.throw(
			_(
				"You do not have a <b>Raven User</b> role. Please contact your administrator to add your user profile as a <b>Raven User</b>."
			),
			title=_("Insufficient permissions. Please contact your administrator."),
		)

	return frappe.get_cached_doc("Raven User", {"user": frappe.session.user})


@frappe.whitelist()
@frappe.read_only()
def get_list():
	"""
	Fetches list of all users who have the role: Raven User
	"""

	# Check if the user is a Raven User and has he "Raven User" role
	# If not, then throw an error
	if not frappe.has_permission("Raven User"):
		frappe.throw(
			_(
				"You do not have a <b>Raven User</b> role. Please contact your administrator to add your user profile as a <b>Raven User</b>."
			),
			title=_("Insufficient permissions. Please contact your administrator."),
		)

	# Get users is cached since this won't change frequently
	return get_users()


@redis_cache()
def get_users():
	users = frappe.db.get_all(
		"Raven User",
		fields=[
			"full_name",
			"user_image",
			"name",
			"first_name",
			"enabled",
			"type",
			"availability_status",
			"custom_status",
			"contact_number",
		],
		order_by="full_name",
	)
	return users


@frappe.whitelist(methods=["GET"])
def get_all_users_on_leave():

	if not "hrms" in frappe.get_installed_apps():
		return []

	# Check if user has Raven User role
	if not frappe.has_permission("Raven User"):
		frappe.throw(
			_(
				"You do not have a <b>Raven User</b> role. Please contact your administrator to add your user profile as a <b>Raven User</b>."
			),
			title=_("Insufficient permissions. Please contact your administrator."),
		)

	show_if_a_user_is_on_leave = frappe.get_single_value(
		"Raven Settings", "show_if_a_user_is_on_leave"
	)

	if not show_if_a_user_is_on_leave:
		return []

	# Join attendance table with user table on user_id
	attendance = frappe.qb.DocType("Attendance")
	employee = frappe.qb.DocType("Employee")

	query = (
		frappe.qb.from_(attendance)
		.join(employee)
		.on(attendance.employee == employee.name)
		.select(employee.user_id)
		.where(attendance.status == "On Leave")
		.where(attendance.attendance_date == frappe.utils.today())
		.where(attendance.docstatus == 1)
	)

	# Return an array of user IDs
	return query.run(pluck=True)


@frappe.whitelist(methods=["POST"])
def enable_user(user: str):
	"""Give a user their Raven access back.

	A Raven User is disabled when the site account is disabled, or when the
	Raven User role was taken away. This restores both, in one save that
	runs the normal permission checks (writing a User needs System Manager).
	"""
	user_doc = frappe.get_doc("User", user)
	user_doc.enabled = 1
	give_raven_access(user_doc)


def has_role_profile(user_doc) -> bool:
	"""Roles from a role profile are reapplied on every save, so one added by hand is lost."""
	return bool(user_doc.role_profile_name or user_doc.get("role_profiles"))


def profiles_can_stack() -> bool:
	"""From Frappe 16 a user holds several role profiles; on 15 there is one, so a second can't be added."""
	return frappe.get_meta("User").has_field("role_profiles")


def give_raven_access(user_doc):
	"""
	Makes the user a Raven User and saves; the User's save hook creates the Raven User record.
	A user whose roles come from role profiles gets Raven's own profile alongside them, since a
	role added by hand would be dropped on their next save. On Frappe 15 that can't be done.
	"""
	if has_role_profile(user_doc):
		if not profiles_can_stack():
			frappe.throw(
				_("{0} gets their roles from a role profile. Add the Raven User role there.").format(
					user_doc.name
				)
			)
		if RAVEN_USER_PROFILE not in [row.role_profile for row in user_doc.role_profiles]:
			user_doc.append("role_profiles", {"role_profile": RAVEN_USER_PROFILE})
	elif "Raven User" not in [role.role for role in user_doc.roles]:
		user_doc.append("roles", {"role": "Raven User"})
	user_doc.save()


@frappe.whitelist(methods=["POST"])
def invite_user(
	email: str,
	first_name: str = None,
	last_name: str = None,
	workspaces: list[str] | str | None = None,
	channels: list[str] | str | None = None,
):
	"""
	Invites a user to Raven. If the user exists in Frappe, they are added to Raven.
	Optionally adds them to the given workspaces and channels in the same call.
	"""
	if isinstance(workspaces, str):
		workspaces = json.loads(workspaces)
	workspaces = workspaces or []
	if isinstance(channels, str):
		channels = json.loads(channels)
	channels = channels or []

	# Check workspace access before touching the user, so a bad workspace fails early.
	for workspace in workspaces:
		frappe.has_permission("Raven Workspace", doc=workspace, ptype="write", throw=True)

	existing_user = frappe.db.exists("User", {"email": email})

	if existing_user:
		give_raven_access(frappe.get_doc("User", existing_user))
		add_user_to_workspaces_and_channels(existing_user, workspaces, channels)
		return {"success": True, "message": "User added to Raven"}
	else:
		user_doc = frappe.new_doc("User")
		user_doc.email = email
		user_doc.first_name = first_name
		user_doc.last_name = last_name
		user_doc.send_welcome_email = 1
		user_doc.append("roles", {"role": "Raven User"})
		user_doc.insert()
		add_user_to_workspaces_and_channels(user_doc.name, workspaces, channels)
		return {"success": True, "message": "User added to Raven"}


def add_user_to_workspaces_and_channels(user: str, workspaces: list[str], channels: list[str]):
	"""
	Workspaces first, since channel membership needs workspace membership.
	Both calls run under the caller's own permissions. Existing memberships are
	skipped, so inviting someone again (or someone already there) doesn't fail.
	"""
	for workspace in workspaces:
		if not frappe.db.exists("Raven Workspace Member", {"workspace": workspace, "user": user}):
			add_workspace_members(workspace, [user])
	for channel in channels:
		if not frappe.db.exists("Raven Channel Member", {"channel_id": channel, "user_id": user}):
			add_channel_members(channel, [user])


def get_employee_details(user: str):
	"""
	Fetches employee details for a given user
	"""
	# Check if FrappeHR is installed
	if not "hrms" in frappe.get_installed_apps():
		return False

	employee = frappe.db.exists("Employee", {"user_id": user})

	if employee:
		return frappe.db.get_value(
			"Employee",
			employee,
			["designation", "department", "team", "cell_number", "prefered_email"],
			as_dict=True,
		)

	return None


def _as_list(value) -> list:
	"""Whitelisted list args arrive as JSON strings from form posts."""
	if isinstance(value, str):
		value = json.loads(value)
	return value or []


def _visible_to_caller() -> tuple[set[str], set[str]]:
	"""
	Workspaces and channels the calling admin can see, using the same list
	endpoints the app itself uses for the caller.
	"""
	# Imported here: raven_channel imports from this module, so a top-level import would be circular.
	from raven.api.raven_channel import get_all_channels

	workspaces = {w["name"] for w in get_workspace_list()}
	channels = {c["name"] for c in get_all_channels()["channels"]}
	return workspaces, channels


def _access_within(user: str, visible_workspaces: set[str], visible_channels: set[str]) -> dict:
	"""Which of the given workspaces and channels the user is a member of."""
	member_of_workspaces = set(
		frappe.get_all("Raven Workspace Member", {"user": user}, pluck="workspace")
	)
	member_of_channels = set(
		frappe.get_all("Raven Channel Member", {"user_id": user}, pluck="channel_id")
	)
	return {
		"workspaces": sorted(visible_workspaces & member_of_workspaces),
		"channels": sorted(visible_channels & member_of_channels),
	}


@frappe.whitelist(methods=["GET"])
def get_user_access(user: str):
	"""
	Which of the caller's visible workspaces and channels the user is a member of.
	Feeds the Manage Access dialog.
	"""
	frappe.only_for(("System Manager", "Raven Admin"))
	return _access_within(user, *_visible_to_caller())


@frappe.whitelist(methods=["POST"])
def update_user_access(
	user: str,
	add_workspaces: list[str] | str | None = None,
	remove_workspaces: list[str] | str | None = None,
	add_channels: list[str] | str | None = None,
	remove_channels: list[str] | str | None = None,
):
	"""
	Applies a membership diff for one user. The client sends only what changed.
	All workspace changes run before any channel change, so channel membership is
	always checked against the final workspace membership. Adding someone to a
	channel in a workspace they were just removed from is refused, not slipped in.
	"""
	frappe.only_for(("System Manager", "Raven Admin"))

	for workspace in _as_list(add_workspaces):
		add_workspace_members(workspace, [user])

	for workspace in _as_list(remove_workspaces):
		frappe.has_permission("Raven Workspace", doc=workspace, ptype="write", throw=True)
		member_id = frappe.db.exists("Raven Workspace Member", {"workspace": workspace, "user": user})
		if member_id:
			# on_trash removes the user's channel memberships in this workspace too.
			frappe.delete_doc("Raven Workspace Member", member_id, ignore_permissions=True)

	for channel in _as_list(add_channels):
		add_channel_members(channel, [user])

	for channel in _as_list(remove_channels):
		member_id = frappe.db.exists("Raven Channel Member", {"channel_id": channel, "user_id": user})
		if member_id:
			# Normal delete permission applies: only admins of that channel may remove a member.
			frappe.delete_doc("Raven Channel Member", member_id)

	return _access_within(user, *_visible_to_caller())
