import frappe


def execute():
	"""Sites already running Raven skip the first-admin setup flow. A fresh install never runs this."""
	frappe.db.set_single_value("Raven Settings", "setup_completed", 1)
