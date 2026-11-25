import frappe

from raven.api.raven_users import get_users


def execute():
	"""Fill `email` on the Raven Users made before it was fetched from the User."""
	raven_users = frappe.get_all(
		"Raven User", filters={"type": "User"}, fields=["name", "user.email as email"]
	)
	for raven_user in raven_users:
		frappe.db.set_value(
			"Raven User", raven_user.name, "email", raven_user.email, update_modified=False
		)
	get_users.clear_cache()
