import frappe


def execute():
	"""Sites already running Raven skip the first-admin setup flow. A fresh install never runs this."""
	# Runs before model sync: a Single stores values without a column, so a migrate that fails
	# after this leaves the field unset in the schema but set in the data.
	frappe.db.set_single_value("Raven Settings", "setup_completed", 1)
