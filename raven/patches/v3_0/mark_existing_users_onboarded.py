import frappe


def execute():
	"""Everyone already using Raven skips the first-open profile step."""
	frappe.db.set_value("Raven User", {"onboarded": 0}, "onboarded", 1, update_modified=False)
