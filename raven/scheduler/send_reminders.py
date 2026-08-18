import frappe
from frappe.utils.data import now_datetime

# Bounds one sweep's work; overflow is picked up oldest-first next run.
REMINDER_BATCH_SIZE = 500


def send_due_reminders():
	"""Cron entrypoint. No lower time bound — after a scheduler outage, late
	delivery beats silently dropping."""
	due = frappe.get_all(
		"Raven Reminder",
		filters=[
			["notified", "=", 0],
			["remind_at", "<=", now_datetime()],
		],
		pluck="name",
		order_by="remind_at asc",  # oldest-overdue first when capped
		limit_page_length=REMINDER_BATCH_SIZE,
	)

	for name in due:
		try:
			frappe.get_doc("Raven Reminder", name).send_reminder()
			frappe.db.commit()
		except Exception:
			frappe.db.rollback()
			frappe.log_error(title=f"Failed to send Raven reminder {name}", message=frappe.get_traceback())
