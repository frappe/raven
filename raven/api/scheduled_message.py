from datetime import datetime

import frappe
from frappe import _
from frappe.utils import add_days, get_datetime, getdate, now_datetime

from raven.api.raven_message import create_message_batch
from raven.quiet_hours import is_in_quiet_hours
from raven.raven_messaging.doctype.raven_scheduled_message.raven_scheduled_message import (
	missing_file_urls,
	notify_owner_updated,
)

FILE_FIELDS = ("file_url", "file_size", "width", "height")


@frappe.whitelist(methods=["POST"])
def create_scheduled_message(
	channel_id: str,
	scheduled_time: str,
	text: str | None = None,
	files: list[dict] | str | None = None,
	linked_message: str | None = None,
	send_silently: bool = False,
	link_doctype: str | None = None,
	link_document: str | int | None = None,
):
	"""Schedule a message for later delivery. Takes what the composer's live send
	takes; validation (membership, future time, files, reply) lives on the DocType."""
	if isinstance(files, str):
		files = frappe.parse_json(files)
	doc = frappe.get_doc(
		{
			"doctype": "Raven Scheduled Message",
			"channel_id": channel_id,
			"text": text,
			"scheduled_time": scheduled_time,
			"files": [{field: f.get(field) for field in FILE_FIELDS} for f in files or []],
			"linked_message": linked_message,
			"send_silently": send_silently,
			"link_doctype": link_doctype,
			"link_document": link_document,
		}
	)
	doc.insert()
	return doc


@frappe.whitelist()
def get_scheduled_messages(channel_id: str | None = None):
	"""The session user's pending (Scheduled) and Failed rows, oldest first, with
	what the list card renders. Sent rows are invisible to the UI."""
	filters = {
		"owner": frappe.session.user,
		"status": ["in", ["Scheduled", "Failed"]],
	}
	if channel_id:
		filters["channel_id"] = channel_id
	rows = frappe.get_all(
		"Raven Scheduled Message",
		filters=filters,
		fields=[
			"name",
			"channel_id",
			"text",
			"scheduled_time",
			"status",
			"error",
			"send_silently",
			"linked_message",
			"link_doctype",
			"link_document",
		],
		order_by="scheduled_time asc",
	)
	if rows:
		_attach_render_data(rows)
	return rows


def _attach_render_data(rows):
	"""Files, reply preview and thread parent per row: a fixed number of queries, not per row."""
	files = frappe.get_all(
		"Raven Scheduled Message File",
		filters={"parent": ["in", [r.name for r in rows]], "parenttype": "Raven Scheduled Message"},
		fields=["parent", *FILE_FIELDS],
		order_by="idx asc",
	)
	channel_ids = list({r.channel_id for r in rows})
	channels = frappe.get_all(
		"Raven Channel",
		filters={"name": ["in", channel_ids]},
		fields=["name", "is_thread", "channel_name"],
	)
	existing = {c.name for c in channels}
	# A thread channel is named after its root message, which sits in the parent channel.
	thread_roots = {c.name: c.channel_name for c in channels if c.is_thread}
	# A reply quote is channel content: show it only while the user is still a member.
	member_of = set(
		frappe.get_all(
			"Raven Channel Member",
			filters={"user_id": frappe.session.user, "channel_id": ["in", channel_ids]},
			pluck="channel_id",
		)
	)
	replies = {r.linked_message for r in rows if r.linked_message and r.channel_id in member_of}
	message_names = replies | set(thread_roots.values())
	messages = {}
	if message_names:
		for m in frappe.get_all(
			"Raven Message",
			filters={"name": ["in", list(message_names)]},
			fields=["name", "channel_id", "content", "file", "message_type", "owner", "creation"],
		):
			messages[m.name] = m

	files_by_row = {}
	for f in files:
		files_by_row.setdefault(f.pop("parent"), []).append(f)

	for row in rows:
		row.files = files_by_row.get(row.name, [])
		row.reply_preview = messages.get(row.linked_message) if row.linked_message in replies else None
		root = messages.get(thread_roots.get(row.channel_id))
		row.thread_parent_channel = root.channel_id if root else None
		# A thread whose root message is gone went with its parent channel.
		row.channel_deleted = row.channel_id not in existing or (
			row.channel_id in thread_roots and not root
		)


@frappe.whitelist(methods=["POST"])
def send_now(name: str):
	"""Deliver one of the session user's scheduled messages right away. Runs as the
	user themself, so a failure raises back to them like any other send."""
	doc = frappe.get_doc("Raven Scheduled Message", name)
	if doc.owner != frappe.session.user:
		frappe.throw(_("You can only send your own scheduled messages."), frappe.PermissionError)
	if not deliver_if_pending(name, ("Scheduled", "Failed")):
		frappe.throw(_("This message has already been sent."))


def deliver_if_pending(
	name: str, allowed: tuple[str, ...] = ("Scheduled",), due_by: datetime | None = None
) -> bool:
	"""Deliver the row if its status is still in `allowed` and, when `due_by` is given, it is
	still due by then. The row lock makes a concurrent Send now and cron sweep take turns;
	the second sees Sent and skips."""
	try:
		doc = frappe.get_doc("Raven Scheduled Message", name, for_update=True)
	except frappe.DoesNotExistError:
		# Deleted after the caller found it.
		return False
	if doc.status not in allowed:
		return False
	# An edit may have moved the time later after the sweep found the row due.
	if due_by and get_datetime(doc.scheduled_time) > due_by:
		return False
	deliver(doc)
	return True


def deliver(doc):
	"""Send the row's message through the live send path and mark the row Sent.

	Must run as the row's owner: Frappe stamps the message owner from the session
	user, and the insert hooks (realtime payload, unread counts, push) fire with it.
	Send Now already runs as the owner. The cron sweep switches user first.
	"""
	messages = create_message_batch(
		doc.channel_id,
		doc.text,
		[{field: f.get(field) for field in FILE_FIELDS} for f in doc.files],
		# Row-keyed, so a repeat delivery returns the batch instead of sending again.
		client_id=f"sched-{doc.name}",
		linked_message=doc.linked_message,
		send_silently=should_send_silently(doc, now_datetime()),
		link_doctype=doc.link_doctype,
		link_document=doc.link_document,
	)
	# The batch's last message carries the reply and linked document.
	doc.db_set({"status": "Sent", "sent_message": messages[-1].name})
	# db_set skips controller hooks, so publish the revalidate signal by hand.
	notify_owner_updated(doc)


def should_send_silently(doc, at) -> bool:
	"""An explicit choice wins; otherwise quiet hours decide, at delivery time, for
	owners on Auto Silent."""
	if doc.send_silently:
		return True
	if frappe.get_cached_value("Raven User", doc.owner, "quiet_hours_nudge") != "Auto Silent":
		return False
	return is_in_quiet_hours(at)


def failure_reason(doc, error: Exception) -> str:
	"""A readable reason for a failed delivery. Checks what the row points at, since
	the exception text names fields, not what went missing."""
	if doc.linked_message and not frappe.db.exists("Raven Message", doc.linked_message):
		return _("The message you replied to was deleted.")
	if missing_file_urls([f.file_url for f in doc.files], owner=doc.owner):
		return _("An attached file is no longer available.")
	if (
		doc.link_doctype
		and doc.link_document
		and not frappe.db.exists(doc.link_doctype, doc.link_document)
	):
		return _("The linked document is no longer available.")
	# A PermissionError keeps its reason in flags, not in the exception text.
	return str(error) or frappe.flags.get("error_message") or type(error).__name__


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
		# Newer HRMS versions have the helper in hrms.utils.holiday_list; version 15 in hrms.hr.utils.
		try:
			from hrms.utils.holiday_list import get_holiday_list_for_employee
		except ImportError:
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
