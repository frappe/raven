import frappe


def execute():
	"""Creating Raven Users for existing users with the "Raven User" role."""

	# In Raven v1.2, we introduced the "Raven User" doctype.
	#  Reference: [#427](https://github.com/frappe/Raven/issues/427)
	# This doctype is used to store the user's profile picture and full name.
	# However, existing users with the "Raven User" role will not have a corresponding Raven User record.
	# This patch creates Raven Users for all users with the "Raven User" role.
	users = frappe.get_all(
		"User",
		filters=[["name", "not in", ["Guest"]], ["Has Role", "role", "=", "Raven User"]],
	)

	for user in users:
		if not frappe.db.exists("Raven User", {"user": user.name}):
			raven_user = frappe.new_doc("Raven User")
			raven_user.user = user.name
			raven_user.insert()
