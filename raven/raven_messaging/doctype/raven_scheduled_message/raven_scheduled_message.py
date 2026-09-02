# Copyright (c) 2026, The Commit Company and contributors
# For license information, please see license.txt

from datetime import timedelta

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_datetime, now_datetime

from raven.utils import is_channel_member


class RavenScheduledMessage(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		channel_id: DF.Link
		error: DF.SmallText | None
		scheduled_time: DF.Datetime
		sent_message: DF.Link | None
		status: DF.Literal["Scheduled", "Sent", "Failed"]
		text: DF.LongText
	# end: auto-generated types

	def validate(self):
		self.validate_status_transition()
		self.validate_channel_membership()
		self.validate_scheduled_time()
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

	@staticmethod
	def clear_old_logs(days=30):
		"""Log-clearing hook (30d). Only dispatched rows are logs — future Scheduled
		rows must survive, and Failed rows stay user-visible until acted on."""
		from frappe.query_builder import Interval
		from frappe.query_builder.functions import Now

		table = frappe.qb.DocType("Raven Scheduled Message")
		frappe.db.delete(
			table,
			filters=(table.status == "Sent") & (table.scheduled_time < (Now() - Interval(days=days))),
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
