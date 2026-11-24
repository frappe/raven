# Copyright (c) 2026, The Commit Company and contributors
# For license information, please see license.txt

from datetime import timedelta

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_days, get_datetime, now_datetime

from raven.api.raven_message import message_has_body, validate_files_uploaded_by_user
from raven.utils import is_channel_member


def missing_file_urls(file_urls: list[str], owner: str | None = None) -> set[str]:
	"""The URLs among these with no File behind them, or none of `owner`'s when given."""
	if not file_urls:
		return set()
	filters = {"file_url": ["in", file_urls]}
	if owner:
		filters["owner"] = owner
	existing = frappe.get_all("File", filters=filters, pluck="file_url")
	return set(file_urls) - set(existing)


def delete_scheduled_messages(filters: dict):
	"""Delete matching rows without hooks. Raw deletes skip child tables, so the
	file rows go first."""
	names = frappe.get_all("Raven Scheduled Message", filters=filters, pluck="name")
	if not names:
		return
	frappe.db.delete(
		"Raven Scheduled Message File",
		{"parenttype": "Raven Scheduled Message", "parent": ["in", names]},
	)
	frappe.db.delete("Raven Scheduled Message", {"name": ["in", names]})


def fail_for_deleted_channels(channel_ids: list[str], reason: str):
	"""Pending rows turn Failed and keep their text for the owner. Sent rows are
	logs of messages deleted with the channel."""
	in_channels = {"channel_id": ["in", channel_ids]}
	delete_scheduled_messages({**in_channels, "status": "Sent"})
	owners = frappe.get_all(
		"Raven Scheduled Message", filters=in_channels, pluck="owner", distinct=True
	)
	if not owners:
		return
	frappe.db.set_value("Raven Scheduled Message", in_channels, {"status": "Failed", "error": reason})
	for owner in owners:
		notify_owner_updated(frappe._dict(owner=owner))


class RavenScheduledMessage(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from raven.raven_messaging.doctype.raven_scheduled_message_file.raven_scheduled_message_file import (
			RavenScheduledMessageFile,
		)

		channel_id: DF.Link
		error: DF.SmallText | None
		files: DF.Table[RavenScheduledMessageFile]
		link_doctype: DF.Link | None
		link_document: DF.DynamicLink | None
		linked_message: DF.Link | None
		scheduled_time: DF.Datetime
		send_silently: DF.Check
		sent_message: DF.Link | None
		status: DF.Literal["Scheduled", "Sent", "Failed"]
		text: DF.LongText | None
	# end: auto-generated types

	def validate(self):
		self.validate_status_transition()
		self.validate_channel_membership()
		self.validate_scheduled_time()
		self.validate_has_content()
		self.validate_files()
		self.validate_linked_message()
		if self.status == "Scheduled":
			# Rescheduling a failed row clears the stale failure reason.
			self.error = None

	def validate_status_transition(self):
		"""Sent rows are immutable (delete only). Failed rows can only go back to
		Scheduled (reschedule = retry)."""
		if self.is_new():
			return
		old = self.get_doc_before_save()
		if not old:
			return
		if old.status == "Sent":
			frappe.throw(_("This message has already been sent and cannot be edited."))
		if old.status == "Failed" and self.status != "Scheduled":
			frappe.throw(_("Reschedule this message to edit it."))

	def validate_channel_membership(self):
		user = self.owner or frappe.session.user
		if not is_channel_member(self.channel_id, user):
			frappe.throw(
				_("You cannot schedule a message in a channel you are not a member of."),
				frappe.PermissionError,
			)

	def validate_scheduled_time(self):
		if self.status != "Scheduled":
			return
		if self.is_new() or self.has_value_changed("scheduled_time"):
			if get_datetime(self.scheduled_time) <= now_datetime():
				frappe.throw(_("Scheduled time must be in the future."))
			# Sweep runs every 5 minutes; ceiling scheduled_time onto that grid means
			# messages go out exactly on time. UI only offers aligned slots — this
			# is the safety net for direct API callers.
			scheduled_time = get_datetime(self.scheduled_time)
			floored = scheduled_time.replace(
				minute=scheduled_time.minute - scheduled_time.minute % 5, second=0, microsecond=0
			)
			self.scheduled_time = floored if floored == scheduled_time else floored + timedelta(minutes=5)

	def validate_has_content(self):
		# Same rule as a live send: text, a file or a linked document.
		if message_has_body(self.text) or self.files or (self.link_doctype and self.link_document):
			return
		frappe.throw(_("Cannot schedule an empty message"))

	def validate_files(self):
		file_urls = [f.file_url for f in self.files]
		if missing_file_urls(file_urls):
			frappe.throw(_("An attached file is no longer available."))
		validate_files_uploaded_by_user(file_urls, user=self.owner or frappe.session.user)

	def validate_linked_message(self):
		if not self.linked_message:
			return
		# Link validation has already rejected a missing message.
		if frappe.db.get_value("Raven Message", self.linked_message, "channel_id") != self.channel_id:
			frappe.throw(_("Linked message should be in the same channel"))

	@staticmethod
	def clear_old_logs(days=30):
		"""Log-clearing hook (30d). Only dispatched rows are logs — future Scheduled
		rows must survive, and Failed rows stay user-visible until acted on."""
		delete_scheduled_messages(
			{"status": "Sent", "scheduled_time": ["<", add_days(now_datetime(), -days)]}
		)

	def on_update(self):
		notify_owner_updated(self)

	def on_trash(self):
		notify_owner_updated(self)


def notify_owner_updated(doc):
	"""Nudge the owner's open clients to revalidate their scheduled-messages list.
	Pure signal — no payload state to reconcile."""
	frappe.publish_realtime(
		"raven_scheduled_message_updated",
		{},
		user=doc.owner,
		after_commit=True,
	)


def on_doctype_update():
	# The scheduled-messages list filters by owner and status.
	frappe.db.add_index("Raven Scheduled Message", ["owner", "status"])
