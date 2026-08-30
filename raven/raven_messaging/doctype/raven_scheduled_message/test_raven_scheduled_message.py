from datetime import date, timedelta

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_to_date, get_datetime, now_datetime

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestRavenScheduledMessage(IntegrationTestCase):
	def setUp(self):
		for email in ("test@example.com", "test1@example.com"):
			frappe.get_doc("User", email).add_roles("Raven User")
		frappe.set_user("test@example.com")

		self.workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": "Sched Send Test Workspace",
				"type": "Public",
			}
		).insert()

		# Private channel so membership is explicit
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "sched-send-test-channel",
				"type": "Private",
				"workspace": self.workspace.name,
			}
		).insert()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def _schedule(self, minutes=60, channel=None, text="<p>later</p>"):
		return frappe.get_doc(
			{
				"doctype": "Raven Scheduled Message",
				"channel_id": channel or self.channel.name,
				"text": text,
				"scheduled_time": add_to_date(now_datetime(), minutes=minutes),
			}
		).insert()

	def test_member_can_schedule(self):
		doc = self._schedule()
		self.assertEqual(doc.status, "Scheduled")
		self.assertEqual(doc.owner, "test@example.com")

	def test_non_member_cannot_schedule(self):
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			self._schedule()

	def test_past_time_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			self._schedule(minutes=-5)

	def test_validate_rounds_scheduled_time_up_to_grid(self):
		base = now_datetime().replace(minute=0, second=0, microsecond=0) + timedelta(hours=2)

		off_grid = frappe.get_doc(
			{
				"doctype": "Raven Scheduled Message",
				"channel_id": self.channel.name,
				"text": "<p>later</p>",
				"scheduled_time": base + timedelta(minutes=7),
			}
		).insert()
		self.assertEqual(get_datetime(off_grid.scheduled_time), base + timedelta(minutes=10))

		aligned = frappe.get_doc(
			{
				"doctype": "Raven Scheduled Message",
				"channel_id": self.channel.name,
				"text": "<p>later</p>",
				"scheduled_time": base + timedelta(hours=1),
			}
		).insert()
		self.assertEqual(get_datetime(aligned.scheduled_time), base + timedelta(hours=1))

	def test_clear_old_logs_deletes_only_stale_sent_rows(self):
		from raven.raven_messaging.doctype.raven_scheduled_message.raven_scheduled_message import (
			RavenScheduledMessage,
		)

		stale_sent = self._schedule()
		stale_sent.db_set(
			{
				"status": "Sent",
				"scheduled_time": add_to_date(now_datetime(), days=-40, as_string=True, as_datetime=True),
			}
		)
		stale_failed = self._schedule()
		stale_failed.db_set(
			{
				"status": "Failed",
				"scheduled_time": add_to_date(now_datetime(), days=-40, as_string=True, as_datetime=True),
			}
		)
		upcoming = self._schedule()

		RavenScheduledMessage.clear_old_logs(days=30)

		self.assertFalse(frappe.db.exists("Raven Scheduled Message", stale_sent.name))
		# Failed rows stay user-visible; future Scheduled rows must survive.
		self.assertTrue(frappe.db.exists("Raven Scheduled Message", stale_failed.name))
		self.assertTrue(frappe.db.exists("Raven Scheduled Message", upcoming.name))

	def test_sent_rows_are_immutable(self):
		doc = self._schedule()
		doc.db_set("status", "Sent")
		doc.reload()
		doc.text = "<p>edited</p>"
		with self.assertRaises(frappe.ValidationError):
			doc.save()

	def test_failed_row_must_go_back_to_scheduled(self):
		doc = self._schedule()
		doc.db_set({"status": "Failed", "error": "boom"})
		doc.reload()
		# Editing text while leaving status Failed is rejected
		doc.text = "<p>edited</p>"
		with self.assertRaises(frappe.ValidationError):
			doc.save()
		# Rescheduling (Failed -> Scheduled) works and clears the error
		doc.reload()
		doc.status = "Scheduled"
		doc.scheduled_time = add_to_date(now_datetime(), minutes=90)
		doc.save()
		self.assertFalse(doc.error)

	def test_send_due_messages_sends_only_due(self):
		from raven.scheduler.send_scheduled_messages import send_due_messages

		due = self._schedule()
		due.db_set("scheduled_time", add_to_date(now_datetime(), minutes=-1))
		not_due = self._schedule(minutes=120)

		frappe.set_user("Administrator")
		send_due_messages()

		due.reload()
		not_due.reload()
		self.assertEqual(due.status, "Sent")
		self.assertEqual(not_due.status, "Scheduled")
		message = frappe.get_doc("Raven Message", due.sent_message)
		self.assertEqual(message.owner, "test@example.com")
		self.assertEqual(message.channel_id, self.channel.name)
		self.assertEqual(message.text, "<p>later</p>")
		# Dispatcher must restore the session user it ran as
		self.assertEqual(frappe.session.user, "Administrator")

	def test_failed_dispatch_marks_failed_and_continues(self):
		from raven.scheduler.send_scheduled_messages import send_due_messages

		bad = self._schedule()
		bad.db_set("scheduled_time", add_to_date(now_datetime(), minutes=-2))
		good = self._schedule()
		good.db_set("scheduled_time", add_to_date(now_datetime(), minutes=-1))

		# Make `bad`'s send fail: point it at a channel the owner is no longer part of.
		# Deleting the membership AFTER scheduling simulates losing access.
		member_name = frappe.db.get_value(
			"Raven Channel Member",
			{"channel_id": self.channel.name, "user_id": "test@example.com"},
			"name",
		)
		other_channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "sched-send-other-channel",
				"type": "Private",
				"workspace": self.workspace.name,
			}
		).insert()
		good.db_set("channel_id", other_channel.name)
		frappe.set_user("Administrator")
		frappe.delete_doc("Raven Channel Member", member_name)

		send_due_messages()

		bad.reload()
		good.reload()
		self.assertEqual(bad.status, "Failed")
		self.assertTrue(bad.error)
		self.assertEqual(good.status, "Sent")

	def test_send_now(self):
		from raven.api.scheduled_message import send_now

		doc = self._schedule()
		send_now(doc.name)
		doc.reload()
		self.assertEqual(doc.status, "Sent")
		self.assertTrue(doc.sent_message)

	def test_deleting_sent_message_cleans_up_scheduled_row(self):
		# The Sent row's `sent_message` link must not block deleting the chat
		# message it produced — Raven Message.on_trash drops the row first.
		from raven.api.scheduled_message import send_now

		doc = self._schedule()
		send_now(doc.name)
		doc.reload()
		frappe.delete_doc("Raven Message", doc.sent_message)
		self.assertFalse(frappe.db.exists("Raven Scheduled Message", doc.name))

	def test_send_now_rejects_other_users_rows(self):
		from raven.api.scheduled_message import send_now

		doc = self._schedule()
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			send_now(doc.name)

	def test_get_scheduled_messages_only_own(self):
		from raven.api.scheduled_message import get_scheduled_messages

		self._schedule()
		rows = get_scheduled_messages()
		self.assertEqual(len(rows), 1)

		frappe.set_user("test1@example.com")
		self.assertEqual(len(get_scheduled_messages()), 0)

	def test_next_working_day_weekend_fallback(self):
		from raven.api.scheduled_message import next_working_day

		# 2026-08-28 is a Friday: no holiday list -> Monday.
		self.assertEqual(next_working_day(date(2026, 8, 28)), date(2026, 8, 31))
		# Midweek -> the very next day.
		self.assertEqual(next_working_day(date(2026, 8, 26)), date(2026, 8, 27))

	def test_next_working_day_holiday_set_is_authoritative(self):
		from raven.api.scheduled_message import next_working_day

		# Thu + Fri off, and the weekend listed too -> Monday.
		off = {date(2026, 8, 27), date(2026, 8, 28), date(2026, 8, 29), date(2026, 8, 30)}
		self.assertEqual(next_working_day(date(2026, 8, 26), off), date(2026, 8, 31))
		# A list WITHOUT weekends means the org works Saturdays.
		self.assertEqual(next_working_day(date(2026, 8, 28), {date(2026, 8, 30)}), date(2026, 8, 29))

	def test_get_next_working_day_is_after_today(self):
		from raven.api.scheduled_message import get_next_working_day

		self.assertGreater(get_datetime(get_next_working_day()).date(), now_datetime().date())

	def test_get_holidays_is_none_without_hr_apps(self):
		from raven.api.scheduled_message import get_holidays

		if {"erpnext", "hrms"} & set(frappe.get_installed_apps()):
			self.skipTest("Holiday List source installed")
		self.assertIsNone(get_holidays())
