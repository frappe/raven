# Copyright (c) 2026, The Commit Company and contributors
# For license information, please see license.txt

from datetime import timedelta

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils.data import get_datetime, now_datetime

from raven.utils import get_raven_user


class RavenReminder(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		channel_id: DF.Link | None
		description: DF.SmallText | None
		is_read: DF.Check
		message: DF.Link
		notified: DF.Check
		remind_at: DF.Datetime
		user: DF.Link
	# end: auto-generated types

	@staticmethod
	def clear_old_logs(days=30):
		"""Log-clearing hook (30d). An un-notified row that old would already have
		fired under the 5-minute sweep, so a blanket remind_at cutoff is safe."""
		from frappe.query_builder import Interval
		from frappe.query_builder.functions import Now

		table = frappe.qb.DocType("Raven Reminder")
		frappe.db.delete(table, filters=(table.remind_at < (Now() - Interval(days=days))))

	def validate(self):
		# The creator owns the reminder. Later saves keep that owner: the API endpoints check
		# ownership before saving, and an admin editing the row in desk must not take it over.
		if self.is_new():
			self.user = get_raven_user(frappe.session.user)

		if get_datetime(self.remind_at) < now_datetime():
			frappe.throw(_("Reminder cannot be set in the past."))

		# Ceil onto the sweep's 5-min grid so reminders fire exactly on time —
		# safety net for direct API callers (the UI only offers aligned slots).
		remind_at = get_datetime(self.remind_at)
		floored = remind_at.replace(
			minute=remind_at.minute - remind_at.minute % 5, second=0, microsecond=0
		)
		self.remind_at = floored if floored == remind_at else floored + timedelta(minutes=5)

		# The channel always comes from the message. A client could otherwise pair a channel
		# it can read with a message from one it cannot: delivery and the list authorise by
		# channel, and the push body loads the message, so the mismatch would leak content.
		channel_id = frappe.db.get_value("Raven Message", self.message, "channel_id")
		if not channel_id:
			frappe.throw(_("The reminder's message does not belong to any channel."))
		if self.channel_id and self.channel_id != channel_id:
			frappe.throw(_("The reminder's channel does not match its message."))
		self.channel_id = channel_id

		# Direct inserts skip the create_reminder endpoint, so its access check lives here too.
		if self.is_new() and not frappe.has_permission(
			"Raven Channel", doc=self.channel_id, ptype="read"
		):
			frappe.throw(_("You do not have access to this channel."), frappe.PermissionError)

	def send_reminder(self):
		"""Deliver: flag fired + unread, ping open clients, push. Idempotent."""
		if self.notified:
			return

		# Re-read under lock — an edit/snooze racing the sweep must not be
		# clobbered (db_set notified=1 on a re-dated row would silence it forever).
		current = frappe.db.get_value(
			"Raven Reminder", self.name, ["notified", "remind_at"], for_update=True, as_dict=True
		)
		if not current or current.notified or get_datetime(current.remind_at) > now_datetime():
			return

		# No linked frappe user: terminal skip, else the sweep retries every run.
		user_id = frappe.db.get_value("Raven User", self.user, "user")
		if not user_id:
			frappe.log_error(
				title=f"Raven Reminder {self.name}: no linked frappe User",
				message=f"Raven User {self.user!r} has no linked frappe User",
			)
			self.db_set("notified", 1, update_modified=False)
			return

		# Source message deleted since: mark notified (no retry-forever), skip.
		if not frappe.db.exists("Raven Message", self.message):
			frappe.log_error(
				title=f"Raven Reminder {self.name}: source message deleted",
				message=f"Reminder {self.name} references missing Raven Message {self.message}",
			)
			self.db_set("notified", 1, update_modified=False)
			return

		# Access re-check: never deliver content the user can no longer read. Losing
		# access is a normal event, not an error, so it is a quiet skip. The sweep only
		# reaches a row once it is due, so access regained before then still delivers.
		# A row skipped here is marked notified and stays hidden until retention clears it.
		if not frappe.has_permission("Raven Channel", doc=self.channel_id, ptype="read", user=user_id):
			self.db_set("notified", 1, update_modified=False)
			return

		self.db_set({"notified": 1, "is_read": 0}, update_modified=False)

		# Pure signal — open clients refetch badge + lists.
		frappe.publish_realtime("raven_reminders_updated", {}, user=user_id, after_commit=True)

		from raven.notification import send_reminder_push

		send_reminder_push(self, user_id)


def on_doctype_update():
	"""Composite index for the due sweep (notified + remind_at)."""
	frappe.db.add_index("Raven Reminder", ["notified", "remind_at"])
