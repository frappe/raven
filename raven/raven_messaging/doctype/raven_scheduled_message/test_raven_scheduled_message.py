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
				# Generated names: the sweep commits per row, so fixtures outlive the test rollback.
				"workspace_name": frappe.generate_hash("sched-send-ws", 8),
				"type": "Public",
			}
		).insert()

		# Private channel so membership is explicit
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": frappe.generate_hash("sched-send", 8),
				"type": "Private",
				"workspace": self.workspace.name,
			}
		).insert()

		self.file_url = self._upload_file()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def _schedule(self, minutes=60, channel=None, text="<p>later</p>", **fields):
		return frappe.get_doc(
			{
				"doctype": "Raven Scheduled Message",
				"channel_id": channel or self.channel.name,
				"text": text,
				"scheduled_time": add_to_date(now_datetime(), minutes=minutes),
				**fields,
			}
		).insert()

	def _upload_file(self, content=None):
		"""A private file uploaded by the session user, the way the composer does.
		Unique content: Frappe reuses the URL of an existing file with the same bytes."""
		return (
			frappe.get_doc(
				{
					"doctype": "File",
					"file_name": f"{frappe.generate_hash(length=8)}.txt",
					"content": content or frappe.generate_hash(),
					"is_private": 1,
					"attached_to_doctype": "Raven Message",
				}
			)
			.insert(ignore_permissions=True)
			.file_url
		)

	def _message(self, channel=None):
		return frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": channel or self.channel.name,
				"text": "<p>original</p>",
				"message_type": "Text",
			}
		).insert()

	def _other_channel(self):
		return frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": frappe.generate_hash("sched-send-other", 8),
				"type": "Private",
				"workspace": self.workspace.name,
			}
		).insert()

	def test_files_only_row_accepted(self):
		doc = self._schedule(text="", files=[{"file_url": self.file_url, "file_size": 9}])
		self.assertEqual(len(doc.files), 1)

	def test_empty_row_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			self._schedule(text="<p> </p>")

	def test_doc_only_row_accepted(self):
		doc = self._schedule(text="", link_doctype="User", link_document="test@example.com")
		self.assertEqual(doc.link_document, "test@example.com")

	def test_other_users_file_rejected(self):
		frappe.set_user("test1@example.com")
		other_url = self._upload_file()
		frappe.set_user("test@example.com")
		with self.assertRaises(frappe.PermissionError):
			self._schedule(files=[{"file_url": other_url}])

	def test_reply_in_other_channel_rejected(self):
		elsewhere = self._message(channel=self._other_channel().name)
		with self.assertRaises(frappe.ValidationError):
			self._schedule(linked_message=elsewhere.name)

	def test_nonexistent_linked_doc_rejected(self):
		with self.assertRaises(frappe.LinkValidationError):
			self._schedule(link_doctype="User", link_document="nobody@example.com")

	def test_update_rejects_missing_file(self):
		doc = self._schedule(files=[{"file_url": self.file_url}])
		file_name = frappe.db.get_value("File", {"file_url": self.file_url})
		frappe.set_user("Administrator")
		frappe.delete_doc("File", file_name, force=1, ignore_permissions=True)
		frappe.set_user("test@example.com")

		doc.reload()
		doc.text = "<p>edited</p>"
		with self.assertRaisesRegex(frappe.ValidationError, "no longer available"):
			doc.save()

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

		stale_sent = self._schedule(files=[{"file_url": self.file_url}])
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
		self.assertFalse(frappe.db.exists("Raven Scheduled Message File", {"parent": stale_sent.name}))
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

		# The sweep commits after each row it sends and rolls back after each row that
		# fails. The first row must send: its commit also saves this test's fixtures,
		# which the failed row's rollback would otherwise discard.
		first = self._schedule()
		first.db_set("scheduled_time", add_to_date(now_datetime(), minutes=-3))
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
				"channel_name": frappe.generate_hash("sched-send-other", 8),
				"type": "Private",
				"workspace": self.workspace.name,
			}
		).insert()
		first.db_set("channel_id", other_channel.name)
		good.db_set("channel_id", other_channel.name)
		frappe.set_user("Administrator")
		frappe.delete_doc("Raven Channel Member", member_name)

		send_due_messages()

		first.reload()
		bad.reload()
		good.reload()
		self.assertEqual(first.status, "Sent")
		self.assertEqual(bad.status, "Failed")
		self.assertTrue(bad.error)
		self.assertEqual(good.status, "Sent")

	def _batch(self, row):
		return frappe.get_all(
			"Raven Message",
			filters={"message_batch_id": f"sched-{row.name}"},
			fields=["name", "message_type", "is_reply", "linked_message", "link_document"],
			order_by="creation asc",
		)

	def _due(self, row, minutes=-1):
		row.db_set("scheduled_time", add_to_date(now_datetime(), minutes=minutes))

	def test_deliver_full_payload(self):
		from raven.api.scheduled_message import send_now

		original = self._message()
		row = self._schedule(
			files=[{"file_url": self.file_url, "file_size": 9}],
			linked_message=original.name,
			link_doctype="User",
			link_document="test@example.com",
		)
		send_now(row.name)

		batch = self._batch(row)
		self.assertEqual(len(batch), 2)
		last = batch[-1]
		self.assertEqual(last.message_type, "Text")
		self.assertEqual(last.is_reply, 1)
		self.assertEqual(last.linked_message, original.name)
		self.assertEqual(last.link_document, "test@example.com")
		row.reload()
		self.assertEqual(row.sent_message, last.name)

	def test_deliver_files_only(self):
		from raven.api.scheduled_message import send_now

		row = self._schedule(text="", files=[{"file_url": self.file_url, "file_size": 9}])
		send_now(row.name)

		batch = self._batch(row)
		self.assertEqual(len(batch), 1)
		self.assertIn(batch[0].message_type, ("File", "Image"))
		row.reload()
		self.assertEqual(row.status, "Sent")

	def test_deliver_if_pending_skips_sent(self):
		from raven.api.scheduled_message import deliver_if_pending, send_now

		row = self._schedule()
		send_now(row.name)
		self.assertFalse(deliver_if_pending(row.name))
		self.assertEqual(len(self._batch(row)), 1)

	def test_deliver_if_pending_skips_deleted_row(self):
		from raven.api.scheduled_message import deliver_if_pending

		row = self._schedule()
		row.delete()
		self.assertFalse(deliver_if_pending(row.name))

	def test_failure_reason_ignores_other_users_copy_of_file(self):
		from raven.api.scheduled_message import failure_reason

		content = frappe.generate_hash()
		own_url = self._upload_file(content)
		row = self._schedule(files=[{"file_url": own_url}])
		frappe.set_user("test1@example.com")
		self.assertEqual(self._upload_file(content), own_url)
		frappe.set_user("Administrator")
		own_file = frappe.db.get_value("File", {"file_url": own_url, "owner": "test@example.com"})
		frappe.delete_doc("File", own_file, force=1, ignore_permissions=True)

		reason = failure_reason(
			row, frappe.PermissionError("You can only send files that you uploaded.")
		)
		self.assertEqual(reason, "An attached file is no longer available.")

	def test_deliver_is_idempotent(self):
		from raven.api.scheduled_message import deliver

		row = self._schedule()
		deliver(row)
		deliver(row)
		self.assertEqual(len(self._batch(row)), 1)

	def test_should_send_silently(self):
		from raven.api.scheduled_message import should_send_silently

		frappe.db.set_single_value(
			"Raven Settings",
			{"enable_quiet_hours": 1, "working_hours_start": "09:00:00", "working_hours_end": "18:00:00"},
		)
		night = now_datetime().replace(hour=23, minute=0)
		day = now_datetime().replace(hour=10, minute=0)
		row = self._schedule()

		def prefer(value):
			frappe.db.set_value("Raven User", "test@example.com", "quiet_hours_nudge", value)

		prefer("Nudge")
		self.assertFalse(should_send_silently(row, night))
		row.send_silently = 1
		self.assertTrue(should_send_silently(row, day))
		row.send_silently = 0
		prefer("Auto Silent")
		self.assertTrue(should_send_silently(row, night))
		self.assertFalse(should_send_silently(row, day))

	def _sweep_with_failure(self, break_row):
		"""Sweep a row that sends, then `break_row`. The first commit saves the fixtures,
		which the failed row's rollback would otherwise discard."""
		from raven.scheduler.send_scheduled_messages import send_due_messages

		first = self._schedule()
		self._due(first, minutes=-3)
		self._due(break_row, minutes=-2)
		frappe.set_user("Administrator")
		send_due_messages()
		first.reload()
		break_row.reload()
		self.assertEqual(first.status, "Sent")
		return break_row

	def test_deleted_reply_marks_failed_with_reason(self):
		original = self._message()
		row = self._schedule(linked_message=original.name)
		frappe.delete_doc("Raven Message", original.name, ignore_permissions=True)

		row = self._sweep_with_failure(row)
		self.assertEqual(row.status, "Failed")
		self.assertEqual(row.error, "The message you replied to was deleted.")

	def test_deleted_file_marks_failed_with_reason(self):
		row = self._schedule(files=[{"file_url": self.file_url}])
		file_name = frappe.db.get_value("File", {"file_url": self.file_url})
		frappe.delete_doc("File", file_name, force=1, ignore_permissions=True)

		row = self._sweep_with_failure(row)
		self.assertEqual(row.status, "Failed")
		self.assertEqual(row.error, "An attached file is no longer available.")

	def test_unreadable_reference_fails_row_without_stopping_sweep(self):
		from raven.scheduler.send_scheduled_messages import send_due_messages

		first = self._schedule()
		self._due(first, minutes=-3)
		# A linked document whose DocType has since been removed: the failure path
		# must still record the row, not raise and block every row behind it.
		bad = self._schedule(link_doctype="User", link_document="test@example.com")
		bad.db_set(
			{"link_doctype": "No Such DocType", "scheduled_time": add_to_date(now_datetime(), minutes=-2)}
		)
		after = self._schedule()
		self._due(after, minutes=-1)

		frappe.set_user("Administrator")
		send_due_messages()

		for row in (first, bad, after):
			row.reload()
		self.assertEqual(first.status, "Sent")
		self.assertEqual(bad.status, "Failed")
		self.assertTrue(bad.error)
		self.assertEqual(after.status, "Sent")

	def test_create_with_payload(self):
		from raven.api.scheduled_message import create_scheduled_message

		original = self._message()
		doc = create_scheduled_message(
			channel_id=self.channel.name,
			scheduled_time=str(add_to_date(now_datetime(), minutes=60)),
			text="<p>later</p>",
			files=frappe.as_json([{"file_url": self.file_url, "file_size": 9}]),
			linked_message=original.name,
			send_silently=True,
		)
		self.assertEqual(len(doc.files), 1)
		self.assertEqual(doc.files[0].file_size, 9)
		self.assertEqual(doc.send_silently, 1)
		self.assertEqual(doc.linked_message, original.name)

	def test_list_returns_render_data(self):
		from raven.api.scheduled_message import get_scheduled_messages
		from raven.api.threads import create_thread

		root = self._message()
		create_thread(root.name)
		thread_id = frappe.db.get_value("Raven Channel", {"channel_name": root.name, "is_thread": 1})
		in_thread = self._message(channel=thread_id)
		row = self._schedule(
			channel=thread_id,
			files=[{"file_url": self.file_url, "file_size": 9}],
			linked_message=in_thread.name,
		)

		listed = next(r for r in get_scheduled_messages() if r.name == row.name)
		self.assertEqual(listed.thread_parent_channel, self.channel.name)
		self.assertEqual([f.file_url for f in listed.files], [self.file_url])
		self.assertEqual(listed.reply_preview["owner"], "test@example.com")
		self.assertFalse(listed.channel_deleted)

	def test_list_hides_reply_preview_after_leaving_channel(self):
		from raven.api.scheduled_message import get_scheduled_messages

		row = self._schedule(linked_message=self._message().name)
		frappe.db.delete(
			"Raven Channel Member", {"channel_id": self.channel.name, "user_id": "test@example.com"}
		)

		listed = next(r for r in get_scheduled_messages() if r.name == row.name)
		self.assertIsNone(listed.reply_preview)

	def test_send_now(self):
		from raven.api.scheduled_message import send_now

		doc = self._schedule()
		send_now(doc.name)
		doc.reload()
		self.assertEqual(doc.status, "Sent")
		self.assertTrue(doc.sent_message)

	def test_deleting_sent_message_cleans_up_scheduled_row(self):
		# Raven Message.on_trash drops the Sent row and its file rows with the message.
		from raven.api.scheduled_message import send_now

		doc = self._schedule(files=[{"file_url": self.file_url}])
		send_now(doc.name)
		doc.reload()
		frappe.delete_doc("Raven Message", doc.sent_message)
		self.assertFalse(frappe.db.exists("Raven Scheduled Message", doc.name))
		self.assertFalse(frappe.db.exists("Raven Scheduled Message File", {"parent": doc.name}))

	def test_deleting_channel_fails_pending_rows(self):
		from raven.api.scheduled_message import get_scheduled_messages, send_now

		channel = self._other_channel()
		sent = self._schedule(channel=channel.name, files=[{"file_url": self.file_url}])
		send_now(sent.name)
		pending = self._schedule(channel=channel.name, files=[{"file_url": self._upload_file()}])
		frappe.delete_doc("Raven Channel", channel.name, ignore_permissions=True)

		self.assertFalse(frappe.db.exists("Raven Scheduled Message", sent.name))
		self.assertFalse(frappe.db.exists("Raven Scheduled Message File", {"parent": sent.name}))
		pending.reload()
		self.assertEqual(pending.status, "Failed")
		self.assertEqual(pending.error, "The channel was deleted.")
		self.assertEqual(len(pending.files), 1)
		listed = next(r for r in get_scheduled_messages() if r.name == pending.name)
		self.assertTrue(listed.channel_deleted)

	def test_deleting_channel_fails_rows_in_its_threads(self):
		from raven.api.scheduled_message import get_scheduled_messages
		from raven.api.threads import create_thread

		channel = self._other_channel()
		root = self._message(channel=channel.name)
		create_thread(root.name)
		thread_id = frappe.db.get_value("Raven Channel", {"channel_name": root.name, "is_thread": 1})
		row = self._schedule(channel=thread_id)
		frappe.delete_doc("Raven Channel", channel.name, ignore_permissions=True)

		row.reload()
		self.assertEqual(row.status, "Failed")
		self.assertEqual(row.error, "The channel was deleted.")
		listed = next(r for r in get_scheduled_messages() if r.name == row.name)
		self.assertTrue(listed.channel_deleted)

	def test_deleting_thread_fails_its_rows(self):
		from raven.api.threads import create_thread

		root = self._message()
		create_thread(root.name)
		thread_id = frappe.db.get_value("Raven Channel", {"channel_name": root.name, "is_thread": 1})
		row = self._schedule(channel=thread_id)
		frappe.delete_doc("Raven Message", root.name)

		row.reload()
		self.assertEqual(row.status, "Failed")
		self.assertEqual(row.error, "The thread was deleted.")

	def test_owner_cannot_be_reassigned(self):
		# A re-owned row would be sent by the sweep as the other user.
		from frappe.client import save

		row = self._schedule()
		data = row.as_dict()
		data["owner"] = "test1@example.com"
		try:
			save(data)
		except frappe.PermissionError:
			pass
		self.assertEqual(
			frappe.db.get_value("Raven Scheduled Message", row.name, "owner"), "test@example.com"
		)

	def test_send_now_rejects_other_users_rows(self):
		from raven.api.scheduled_message import send_now

		doc = self._schedule()
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			send_now(doc.name)

	def test_get_scheduled_messages_only_own(self):
		from raven.api.scheduled_message import get_scheduled_messages

		# Look for this row rather than counting: the sweep test commits its rows,
		# and a Failed one it leaves behind is rightly listed for its owner.
		doc = self._schedule()
		self.assertIn(doc.name, [row.name for row in get_scheduled_messages()])

		frappe.set_user("test1@example.com")
		self.assertEqual(get_scheduled_messages(), [])

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
