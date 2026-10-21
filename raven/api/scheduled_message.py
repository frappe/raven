import frappe
from frappe import _
from frappe.utils import add_days, getdate

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


@frappe.whitelist(methods=["POST"])
def send_now(name: str):
	"""Deliver one of the session user's scheduled messages right away. Runs as the
	user themself, so a failure raises back to them like any other send."""
	doc = frappe.get_doc("Raven Scheduled Message", name)
	if doc.owner != frappe.session.user:
		frappe.throw(_("You can only send your own scheduled messages."), frappe.PermissionError)
	if doc.status == "Sent":
		frappe.throw(_("This message has already been sent."))
	deliver(doc)


def deliver(doc):
	"""Post the chat message for a scheduled row and mark the row Sent.

	Must run as the row's owner: Frappe stamps the message owner from the session
	user, and the insert hooks (realtime payload, unread counts, push) fire with it.
	Send Now already runs as the owner. The cron sweep switches user first.
	"""
	message = frappe.get_doc(
		{
			"doctype": "Raven Message",
			"channel_id": doc.channel_id,
			"text": doc.text,
			"message_type": "Text",
		}
	).insert()
	doc.db_set({"status": "Sent", "sent_message": message.name})
	# db_set skips controller hooks, so publish the revalidate signal by hand.
	notify_owner_updated(doc)


@frappe.whitelist()
def get_next_working_day():
	"""ISO date of the first working day after today — the schedule menu's
	next-working-day preset (shown only when that day isn't tomorrow)."""
	return str(next_working_day(getdate(), get_holidays()))


def get_holiday_list() -> str | None:
	"""The session user's Holiday List: their Employee's list (HRMS), else the
	default company's (ERPNext). None when neither app is installed."""
	apps = frappe.get_installed_apps()
	if "hrms" in apps:
		from hrms.hr.utils import get_holiday_list_for_employee

		employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user, "status": "Active"})
		# A user without an Employee record (an admin, a contractor) still gets the
		# company list below instead of the weekend fallback.
		if employee:
			holiday_list = get_holiday_list_for_employee(employee, raise_exception=False)
			if holiday_list:
				return holiday_list
	if "erpnext" in apps:
		company = frappe.db.get_single_value("Global Defaults", "default_company")
		return frappe.get_cached_value("Company", company, "default_holiday_list") if company else None
	return None


def get_holidays() -> set | None:
	"""Off-days from the resolved Holiday List; None (weekend fallback) without one."""
	holiday_list = get_holiday_list()
	if not holiday_list:
		return None
	return set(frappe.get_all("Holiday", filters={"parent": holiday_list}, pluck="holiday_date"))


def next_working_day(after, holidays: set | None = None):
	"""First working day strictly after `after`. A holiday set is authoritative
	(weekly offs live in it too); without one, Saturday/Sunday are off."""
	day = getdate(after)
	for _i in range(366):
		day = add_days(day, 1)
		off = day in holidays if holidays is not None else day.weekday() >= 5
		if not off:
			return day
	return day
