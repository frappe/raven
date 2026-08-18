from typing import TYPE_CHECKING

import frappe
from frappe import _

if TYPE_CHECKING:
	from raven.raven_messaging.doctype.raven_scheduled_message.raven_scheduled_message import (
		RavenScheduledMessage,
	)

from raven.raven_messaging.doctype.raven_scheduled_message.raven_scheduled_message import (
	notify_owner_updated,
)


@frappe.whitelist(methods=["POST"])
def create_scheduled_message(channel_id: str, text: str, scheduled_time: str):
	"""Schedule a text message for later delivery. Validation (membership, future
	time) lives on the DocType."""
	doc = frappe.get_doc(
		{
			"doctype": "Raven Scheduled Message",
			"channel_id": channel_id,
			"text": text,
			"scheduled_time": scheduled_time,
		}
	)
	doc.insert()
	return doc


@frappe.whitelist()
def get_scheduled_messages(channel_id: str | None = None):
	"""The session user's pending (Scheduled) and Failed rows, oldest first.
	Sent rows are invisible to the UI."""
	filters = {
		"owner": frappe.session.user,
		"status": ["in", ["Scheduled", "Failed"]],
	}
	if channel_id:
		filters["channel_id"] = channel_id
	return frappe.get_all(
		"Raven Scheduled Message",
		filters=filters,
		fields=["name", "channel_id", "text", "scheduled_time", "status", "error"],
		order_by="scheduled_time asc",
	)


@frappe.whitelist()
def get_scheduled_message_count():
	"""Count of the session user's pending (Scheduled + Failed) rows — drives the sidebar badge."""
	return frappe.db.count(
		"Raven Scheduled Message",
		{"owner": frappe.session.user, "status": ["in", ["Scheduled", "Failed"]]},
	)


@frappe.whitelist(methods=["POST"])
def send_now(name: str):
	"""Deliver a scheduled message immediately. Raises on failure so the caller
	sees why (unlike the cron path, which records the failure on the row)."""
	doc = frappe.get_doc("Raven Scheduled Message", name)
	if doc.owner != frappe.session.user:
		frappe.throw(_("You can only send your own scheduled messages."), frappe.PermissionError)
	if doc.status == "Sent":
		frappe.throw(_("This message has already been sent."))
	_dispatch(doc, raise_on_failure=True)


def _dispatch(doc: "RavenScheduledMessage", raise_on_failure: bool = False):
	"""Insert the real Raven Message as the row's owner. Success -> Sent (+link);
	failure -> Failed (+reason), with the partial message insert rolled back."""
	# Re-read under lock: cron tick and a concurrent Send Now must not both dispatch this row.
	current_status = frappe.db.get_value(
		"Raven Scheduled Message", doc.name, "status", for_update=True
	)
	if current_status not in ("Scheduled", "Failed"):
		if raise_on_failure:
			frappe.throw(_("This message has already been sent."))
		return
	original_user = frappe.session.user
	# Impersonation guard: only the scheduler (Administrator) or the owner
	# themself may reach the set_user below — never a switch to someone else.
	if original_user not in ("Administrator", doc.owner):
		frappe.throw(_("Not permitted."), frappe.PermissionError)
	frappe.db.savepoint("raven_scheduled_send")
	try:
		# Act as the owner: the message's permission checks and `owner` must be
		# theirs, and the full insert path (broadcast, unread counts, mentions,
		# notifications) fires exactly like a live send. Scoped by the finally
		# below, which always restores the original session user.
		frappe.set_user(doc.owner)  # nosemgrep: frappe-semgrep-rules.rules.security.frappe-setuser
		message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": doc.channel_id,
				"text": doc.text,
				"message_type": "Text",
			}
		)
		message.insert()
	except Exception as e:
		frappe.db.rollback(save_point="raven_scheduled_send")
		# frappe.PermissionError carries its reason in flags, not the exception
		# message (which is empty), so fall back to that for a truthy reason.
		error = str(e) or frappe.flags.get("error_message") or type(e).__name__
		doc.db_set({"status": "Failed", "error": error})
		# db_set skips controller hooks, so publish the revalidate signal manually.
		notify_owner_updated(doc)
		if raise_on_failure:
			raise
	else:
		doc.db_set({"status": "Sent", "sent_message": message.name})
		# db_set skips controller hooks, so publish the revalidate signal manually.
		notify_owner_updated(doc)
	finally:
		frappe.set_user(original_user)  # nosemgrep: frappe-semgrep-rules.rules.security.frappe-setuser
