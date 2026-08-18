import frappe
from frappe import _

from raven.utils import get_raven_user


def _owned_reminder(reminder: str):
	"""Load a reminder, throwing PermissionError unless it belongs to the current user."""
	doc = frappe.get_doc("Raven Reminder", reminder)
	current = get_raven_user(frappe.session.user)
	if not current or doc.user != current:
		frappe.throw(_("You do not have access to this reminder."), frappe.PermissionError)
	return doc


@frappe.whitelist(methods=["POST"])
def create_reminder(message_id: str, remind_at: str, description: str | None = None) -> str:
	channel_id = frappe.db.get_value("Raven Message", message_id, "channel_id")
	if not channel_id:
		frappe.throw(_("Message not found."))
	if not frappe.has_permission("Raven Channel", doc=channel_id, ptype="read"):
		frappe.throw(_("You do not have access to this channel."), frappe.PermissionError)

	reminder = frappe.get_doc(
		{
			"doctype": "Raven Reminder",
			"message": message_id,
			"remind_at": remind_at,
			"description": description,
		}
	)
	reminder.insert()
	return reminder.name


@frappe.whitelist()
def get_reminders() -> list[dict]:
	"""All of the user's reminders + message previews (30-day retention bounds size).
	Rows whose channel the user can no longer read are dropped — same containment
	rule the delivery path applies."""
	reminder = frappe.qb.DocType("Raven Reminder")
	message = frappe.qb.DocType("Raven Message")
	rows = (
		frappe.qb.from_(reminder)
		.left_join(message)
		.on(reminder.message == message.name)
		.select(
			reminder.name,
			reminder.message,
			reminder.channel_id,
			reminder.remind_at,
			reminder.description,
			reminder.notified,
			reminder.is_read,
			message.text.as_("message_text"),
			message.message_type,
			message.owner.as_("message_owner"),
			message.creation.as_("message_creation"),
			message.file.as_("message_file"),
		)
		.where(reminder.user == get_raven_user(frappe.session.user))
		.orderby(reminder.remind_at)
		.run(as_dict=True)
	)
	# Per-channel has_permission is fine at this size (dozens of rows, 30d retention).
	readable = {}
	for row in rows:
		if row.channel_id not in readable:
			readable[row.channel_id] = frappe.has_permission(
				"Raven Channel", doc=row.channel_id, ptype="read"
			)
	return [row for row in rows if readable[row.channel_id]]


@frappe.whitelist(methods=["POST"])
def snooze_reminder(reminder: str, remind_at: str) -> str:
	"""Re-arm a reminder — works pre-fire (postpone) and post-fire (remind me again)."""
	doc = _owned_reminder(reminder)
	doc.remind_at = remind_at
	doc.notified = 0
	doc.is_read = 0
	doc.save()
	return doc.name


@frappe.whitelist(methods=["POST"])
def update_reminder(reminder: str, remind_at: str, description: str | None = None) -> str:
	"""Edit an UPCOMING reminder's time and note. Fired reminders can't be edited —
	snooze re-arms them instead."""
	doc = _owned_reminder(reminder)
	if doc.notified:
		frappe.throw(_("This reminder has already been delivered."))
	doc.remind_at = remind_at
	doc.description = description
	doc.save()  # validate() rejects past times
	return doc.name


@frappe.whitelist(methods=["POST"])
def delete_reminder(reminder: str) -> None:
	_owned_reminder(reminder)
	frappe.delete_doc("Raven Reminder", reminder)


@frappe.whitelist(methods=["POST"])
def mark_reminder_read(message_id: str) -> None:
	"""Mark the user's fired reminders on this message read (open = complete)."""
	filters = {
		"user": get_raven_user(frappe.session.user),
		"message": message_id,
		"notified": 1,
		"is_read": 0,
	}
	names = frappe.get_all("Raven Reminder", filters=filters, pluck="name")
	if names:
		frappe.db.set_value("Raven Reminder", filters, "is_read", 1, update_modified=False)
		# Other open clients drop the unread state.
		frappe.publish_realtime(
			"raven_reminders_updated", {}, user=frappe.session.user, after_commit=True
		)


@frappe.whitelist()
def get_unread_reminder_count() -> int:
	"""Fired-but-unread reminders — drives the Later sidebar badge."""
	return frappe.db.count(
		"Raven Reminder",
		{"user": get_raven_user(frappe.session.user), "notified": 1, "is_read": 0},
	)
