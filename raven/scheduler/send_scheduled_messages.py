import frappe
from frappe.utils import now_datetime


def send_due_messages():
	"""Cron entrypoint: deliver every due scheduled message. One row failing
	must not block the rest (_dispatch handles its own rollback + Failed state)."""
	from raven.api.scheduled_message import _dispatch

	due = frappe.get_all(
		"Raven Scheduled Message",
		filters={"status": "Scheduled", "scheduled_time": ["<=", now_datetime()]},
		pluck="name",
		order_by="scheduled_time asc",
	)
	for name in due:
		_dispatch(frappe.get_doc("Raven Scheduled Message", name))
