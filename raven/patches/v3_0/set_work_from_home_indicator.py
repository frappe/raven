import frappe


def execute():
	"""Existing sites start with the work-from-home indicator matching the leave indicator."""
	show_leave = frappe.db.get_single_value("Raven Settings", "show_if_a_user_is_on_leave")
	frappe.db.set_single_value(
		"Raven Settings", "show_if_a_user_is_working_from_home", 1 if show_leave else 0
	)
