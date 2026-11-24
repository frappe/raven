import frappe
from frappe.utils import now_datetime


def send_due_messages():
	"""Cron entrypoint: deliver every due scheduled message, oldest first."""
	from raven.api.scheduled_message import deliver_if_pending, failure_reason
	from raven.raven_messaging.doctype.raven_scheduled_message.raven_scheduled_message import (
		notify_owner_updated,
	)

	now = now_datetime()
	due = frappe.get_all(
		"Raven Scheduled Message",
		filters={"status": "Scheduled", "scheduled_time": ["<=", now]},
		fields=["name", "owner"],
		order_by="scheduled_time asc",
	)

	# One transaction per row, on purpose: a failed send is rolled back and recorded
	# on its own row without touching the others. Same shape as the reminders sweep.
	for row in due:
		try:
			# Act as the owner so the message and everything its insert triggers carry
			# the right sender. A scheduler job has no browser session, so switching
			# user is safe here (it is not inside a web request).
			frappe.set_user(row.owner)  # nosemgrep: frappe-semgrep-rules.rules.security.frappe-setuser
			deliver_if_pending(row.name, due_by=now)
			frappe.db.commit()  # nosemgrep
		except Exception as e:
			frappe.db.rollback()
			# Locked and re-read: a concurrent Send now may have delivered it meanwhile.
			doc = frappe.get_doc("Raven Scheduled Message", row.name, for_update=True)
			if doc.status == "Scheduled":
				doc.db_set({"status": "Failed", "error": failure_reason(doc, e)})
				notify_owner_updated(doc)
			frappe.db.commit()  # nosemgrep
		finally:
			# nosemgrep: frappe-semgrep-rules.rules.security.frappe-setuser
			frappe.set_user("Administrator")
