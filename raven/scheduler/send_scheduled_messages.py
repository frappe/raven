import frappe
from frappe.utils import now_datetime


def send_due_messages():
	"""Cron entrypoint: deliver every due scheduled message, oldest first."""
	from raven.api.scheduled_message import deliver
	from raven.raven_messaging.doctype.raven_scheduled_message.raven_scheduled_message import (
		notify_owner_updated,
	)

	due = frappe.get_all(
		"Raven Scheduled Message",
		filters={"status": "Scheduled", "scheduled_time": ["<=", now_datetime()]},
		pluck="name",
		order_by="scheduled_time asc",
	)

	# One transaction per row, on purpose: a failed send is rolled back and recorded
	# on its own row without touching the others. Same shape as the reminders sweep.
	for name in due:
		doc = frappe.get_doc("Raven Scheduled Message", name)
		try:
			# Act as the owner so the message and everything its insert triggers carry
			# the right sender. A scheduler job has no browser session, so switching
			# user is safe here (it is not inside a web request).
			frappe.set_user(doc.owner)  # nosemgrep: frappe-semgrep-rules.rules.security.frappe-setuser
			deliver(doc)
			frappe.db.commit()  # nosemgrep
		except Exception as e:
			frappe.db.rollback()
			# A PermissionError keeps its reason in flags, not in the exception text.
			error = str(e) or frappe.flags.get("error_message") or type(e).__name__
			doc.db_set({"status": "Failed", "error": error})
			notify_owner_updated(doc)
			frappe.db.commit()  # nosemgrep
		finally:
			frappe.set_user(
				"Administrator"
			)  # nosemgrep: frappe-semgrep-rules.rules.security.frappe-setuser
