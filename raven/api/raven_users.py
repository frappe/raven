import json

import frappe
from frappe import _
from frappe.utils.caching import redis_cache


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


@frappe.whitelist(methods=["POST"])
def update_raven_user(**args):
	"""
	Deprecated in v3
	Updates the current user's Raven User profile
	"""

	frappe.get_doc("Raven User", {"user": frappe.session.user}).update(args).save()


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


@frappe.whitelist()
def is_user_on_leave(user: str):
	"""
	If the user is on leave, return True
	"""
	# Check if FrappeHR is installed
	if not "hrms" in frappe.get_installed_apps():
		return False

	employee = frappe.db.exists("Employee", {"user_id": user})

	if employee:
		# Check if attendance today is marked as "On Leave"
		attendance = frappe.db.exists(
			"Attendance",
			{
				"employee": employee,
				"status": "On Leave",
				"attendance_date": frappe.utils.today(),
				"docstatus": 1,
			},
		)

		if attendance:
			return True

	return False


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
def add_users_to_raven(users: list[str] | str):

	if isinstance(users, str):
		users = json.loads(users)

	failed_users = []
	success_users = []

	for user in users:
		user_doc = frappe.get_doc("User", user)

		if user_doc.role_profile_name:
			failed_users.append(user_doc)

		elif hasattr(user_doc, "role_profiles") and len(user_doc.role_profiles) > 0:
			failed_users.append(user_doc)
		else:
			user_doc.append("roles", {"role": "Raven User"})
			user_doc.save()
			success_users.append(user_doc)

	return {"success_users": success_users, "failed_users": failed_users}


@frappe.whitelist(methods=["POST"])
def invite_user(email: str, first_name: str = None, last_name: str = None):
	"""
	Invites a user to Raven. If the user exists in Frappe, they are added to Raven.
	"""

	existing_user = frappe.db.exists("User", {"email": email})

	if existing_user:
		user_doc = frappe.get_doc("User", existing_user)
		if user_doc.role_profile_name:
			frappe.throw(_("User has a role profile set. Please set the role to Raven User manually."))

		elif hasattr(user_doc, "role_profiles") and len(user_doc.role_profiles) > 0:
			frappe.throw(_("User has a role profile set. Please set the role to Raven User manually."))

		user_doc.append("roles", {"role": "Raven User"})
		user_doc.save()
		return {"success": True, "message": "User added to Raven"}
	else:
		user_doc = frappe.new_doc("User")
		user_doc.email = email
		user_doc.first_name = first_name
		user_doc.last_name = last_name
		user_doc.send_welcome_email = 1
		user_doc.append("roles", {"role": "Raven User"})
		user_doc.insert()
		return {"success": True, "message": "User added to Raven"}


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
