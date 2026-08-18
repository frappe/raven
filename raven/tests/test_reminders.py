import json
from datetime import timedelta

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_to_date, get_datetime, now_datetime

from raven.utils import get_raven_user


def _ceil_grid(dt):
	"""Mirror of validate's 5-minute-grid ceiling, for asserting stored times."""
	dt = get_datetime(dt)
	floored = dt.replace(minute=dt.minute - dt.minute % 5, second=0, microsecond=0)
	return floored if floored == dt else floored + timedelta(minutes=5)


class TestReminders(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

		# Ensure the test user has the Raven User role and a Raven User record
		user = frappe.get_doc("User", "test@example.com")
		user.add_roles("Raven User")

		if not frappe.db.exists("Raven User", {"user": "test@example.com"}):
			frappe.get_doc(
				{
					"doctype": "Raven User",
					"user": "test@example.com",
					"type": "User",
					"enabled": 1,
				}
			).insert(ignore_permissions=True)

		frappe.set_user("test@example.com")
		self.raven_user = get_raven_user("test@example.com")
		# Sweep tests commit per row, so prior runs' reminders survive rollback; purge for isolation.
		frappe.db.delete("Raven Reminder", {"user": self.raven_user})
		self.channel, self.message = _make_channel_and_message(self.raven_user)

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def _make_reminder(self, remind_at, description="Follow up"):
		return frappe.get_doc(
			{
				"doctype": "Raven Reminder",
				"message": self.message,
				"remind_at": remind_at,
				"description": description,
			}
		).insert()

	def _make_fired_fixture(self, remind_at=None, message=None, notified=0, is_read=0):
		"""Insert a reminder row directly (skipping validate) — for past/fired fixtures."""
		reminder = frappe.get_doc(
			{
				"doctype": "Raven Reminder",
				"user": self.raven_user,
				"message": message or self.message,
				"channel_id": frappe.db.get_value("Raven Message", message or self.message, "channel_id"),
				"remind_at": remind_at
				or add_to_date(now_datetime(), minutes=-1, as_string=True, as_datetime=True),
				"description": "Ping me",
				"notified": notified,
				"is_read": is_read,
			}
		)
		reminder.flags.ignore_validate = True
		reminder.insert(ignore_permissions=True)
		return reminder

	def _liked_by(self, message=None):
		return json.loads(
			frappe.db.get_value("Raven Message", message or self.message, "_liked_by") or "[]"
		)

	def test_validate_forces_user_and_derives_channel(self):
		future = add_to_date(now_datetime(), hours=1, as_string=True, as_datetime=True)
		reminder = self._make_reminder(future)
		self.assertEqual(reminder.user, self.raven_user)
		self.assertEqual(reminder.channel_id, self.channel)
		self.assertEqual(reminder.notified, 0)
		self.assertEqual(reminder.is_read, 0)

	def test_validate_rejects_past(self):
		past = add_to_date(now_datetime(), hours=-1, as_string=True, as_datetime=True)
		with self.assertRaises(frappe.ValidationError):
			self._make_reminder(past)

	def test_validate_rounds_remind_at_up_to_grid(self):
		base = now_datetime().replace(minute=0, second=0, microsecond=0) + timedelta(hours=2)

		off_grid = self._make_reminder(base + timedelta(minutes=7))
		self.assertEqual(get_datetime(off_grid.remind_at), base + timedelta(minutes=10))

		aligned = self._make_reminder(base + timedelta(hours=1))
		self.assertEqual(get_datetime(aligned.remind_at), base + timedelta(hours=1))

	def test_clear_old_logs_deletes_only_stale_rows(self):
		from raven.raven.doctype.raven_reminder.raven_reminder import RavenReminder

		old = self._make_fired_fixture(
			remind_at=add_to_date(now_datetime(), days=-40, as_string=True, as_datetime=True),
			notified=1,
		)
		fresh = self._make_reminder(
			add_to_date(now_datetime(), hours=1, as_string=True, as_datetime=True)
		)

		RavenReminder.clear_old_logs(days=30)

		self.assertFalse(frappe.db.exists("Raven Reminder", old.name))
		self.assertTrue(frappe.db.exists("Raven Reminder", fresh.name))

	def test_sweep_delivers_due_reminder_once(self):
		from raven.scheduler.send_reminders import send_due_reminders

		reminder = self._make_fired_fixture()

		frappe.set_user("Administrator")
		send_due_reminders()

		self.assertEqual(frappe.db.get_value("Raven Reminder", reminder.name, "notified"), 1)
		self.assertEqual(frappe.db.get_value("Raven Reminder", reminder.name, "is_read"), 0)
		# Delivery is decoupled from saved messages — firing must NOT auto-save.
		self.assertNotIn("test@example.com", self._liked_by())

		# Idempotent: a second sweep changes nothing (row is now notified).
		send_due_reminders()
		self.assertEqual(frappe.db.get_value("Raven Reminder", reminder.name, "notified"), 1)

	def test_sweep_skips_future_reminders(self):
		from raven.scheduler.send_reminders import send_due_reminders

		future = add_to_date(now_datetime(), hours=2, as_string=True, as_datetime=True)
		reminder = self._make_reminder(future)

		frappe.set_user("Administrator")
		send_due_reminders()

		self.assertEqual(frappe.db.get_value("Raven Reminder", reminder.name, "notified"), 0)
		self.assertNotIn("test@example.com", self._liked_by())

	def test_sweep_delivers_stale_reminder(self):
		from raven.scheduler.send_reminders import send_due_reminders

		stale = add_to_date(now_datetime(), hours=-3, as_string=True, as_datetime=True)
		reminder = self._make_fired_fixture(remind_at=stale)

		frappe.set_user("Administrator")
		send_due_reminders()

		# Overdue-by-hours reminder still delivered (no lower time bound).
		self.assertEqual(frappe.db.get_value("Raven Reminder", reminder.name, "notified"), 1)

	def test_sweep_handles_deleted_source_message(self):
		from raven.scheduler.send_reminders import send_due_reminders

		reminder = self._make_fired_fixture()
		frappe.set_user("Administrator")
		frappe.db.delete("Raven Message", self.message)

		send_due_reminders()  # must not raise

		# Terminal: marked notified so it never retries; nothing delivered.
		self.assertEqual(frappe.db.get_value("Raven Reminder", reminder.name, "notified"), 1)

	def test_sweep_skips_when_user_cannot_read_channel(self):
		from raven.scheduler.send_reminders import send_due_reminders

		frappe.set_user("Administrator")
		# A private channel the test user is NOT a member of.
		private_channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": frappe.generate_hash("test-private", 8),
				"workspace": frappe.db.get_value("Raven Channel", self.channel, "workspace"),
				"type": "Private",
			}
		).insert(ignore_permissions=True)
		secret_message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": private_channel.name,
				"text": "<p>secret</p>",
				"message_type": "Text",
			}
		).insert(ignore_permissions=True)

		reminder = self._make_fired_fixture(message=secret_message.name)

		send_due_reminders()

		# Terminal skip: notified (no retry loop), and nothing delivered for a channel
		# the user can no longer read.
		self.assertEqual(frappe.db.get_value("Raven Reminder", reminder.name, "notified"), 1)

	def test_create_and_list_reminder(self):
		from raven.api.reminders import create_reminder, get_reminders

		future = add_to_date(now_datetime(), hours=1, as_string=True, as_datetime=True)
		name = create_reminder(self.message, future, description="Review PR")

		rows = get_reminders()
		self.assertIn(name, [r["name"] for r in rows])
		row = next(r for r in rows if r["name"] == name)
		self.assertEqual(row["channel_id"], self.channel)
		self.assertEqual(row["notified"], 0)
		# Message preview fields ride along for the Reminders tab rows.
		self.assertEqual(row["message_text"], "<p>anchor</p>")
		self.assertEqual(row["message_type"], "Text")

	def test_get_reminders_returns_pending_and_fired(self):
		from raven.api.reminders import create_reminder, get_reminders

		future = add_to_date(now_datetime(), hours=1, as_string=True, as_datetime=True)
		pending = create_reminder(self.message, future, description="pending")
		fired = self._make_fired_fixture(notified=1)

		rows = {r["name"]: r for r in get_reminders()}
		self.assertIn(pending, rows)
		self.assertIn(fired.name, rows)
		self.assertEqual(rows[pending]["notified"], 0)
		self.assertEqual(rows[fired.name]["notified"], 1)

	def test_snooze_rearms_reminder(self):
		from raven.api.reminders import snooze_reminder

		reminder = self._make_fired_fixture(notified=1, is_read=1)

		later = add_to_date(now_datetime(), hours=3, as_string=True, as_datetime=True)
		snooze_reminder(reminder.name, later)

		self.assertEqual(frappe.db.get_value("Raven Reminder", reminder.name, "notified"), 0)
		self.assertEqual(frappe.db.get_value("Raven Reminder", reminder.name, "is_read"), 0)
		self.assertEqual(
			get_datetime(frappe.db.get_value("Raven Reminder", reminder.name, "remind_at")),
			_ceil_grid(later),
		)

	def test_cannot_snooze_or_delete_others_reminder(self):
		from raven.api.reminders import delete_reminder, snooze_reminder

		future = add_to_date(now_datetime(), hours=1, as_string=True, as_datetime=True)
		reminder = self._make_reminder(future)

		frappe.set_user("Administrator")
		if not frappe.db.exists("Raven User", {"user": "test1@example.com"}):
			frappe.get_doc(
				{
					"doctype": "Raven User",
					"user": "test1@example.com",
					"type": "User",
					"enabled": 1,
				}
			).insert(ignore_permissions=True)
		frappe.get_doc("User", "test1@example.com").add_roles("Raven User")

		original_user = frappe.session.user
		try:
			frappe.set_user("test1@example.com")
			later = add_to_date(now_datetime(), hours=2, as_string=True, as_datetime=True)
			with self.assertRaises(frappe.PermissionError):
				snooze_reminder(reminder.name, later)
			with self.assertRaises(frappe.PermissionError):
				delete_reminder(reminder.name)
		finally:
			frappe.set_user(original_user)

	def test_delete_reminder(self):
		from raven.api.reminders import delete_reminder

		future = add_to_date(now_datetime(), hours=1, as_string=True, as_datetime=True)
		reminder = self._make_reminder(future)
		delete_reminder(reminder.name)
		self.assertFalse(frappe.db.exists("Raven Reminder", reminder.name))

	def test_mark_read_and_unread_count(self):
		from raven.api.reminders import get_unread_reminder_count, mark_reminder_read

		self._make_fired_fixture(notified=1, is_read=0)
		self.assertEqual(get_unread_reminder_count(), 1)

		mark_reminder_read(self.message)
		self.assertEqual(get_unread_reminder_count(), 0)

	def test_delete_message_with_reminder_succeeds(self):
		future = add_to_date(now_datetime(), hours=1, as_string=True, as_datetime=True)
		reminder = self._make_reminder(future)

		frappe.set_user("Administrator")
		frappe.get_doc("Raven Message", self.message).delete()

		self.assertFalse(frappe.db.exists("Raven Reminder", reminder.name))

	def test_get_reminders_hides_rows_after_channel_access_lost(self):
		from raven.api.reminders import get_reminders

		frappe.set_user("Administrator")
		# A private channel the test user is NOT a member of — same containment
		# case the delivery path terminal-skips.
		private_channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": frappe.generate_hash("test-hidden", 8),
				"workspace": frappe.db.get_value("Raven Channel", self.channel, "workspace"),
				"type": "Private",
			}
		).insert(ignore_permissions=True)
		secret_message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": private_channel.name,
				"text": "<p>secret</p>",
				"message_type": "Text",
			}
		).insert(ignore_permissions=True)

		hidden = self._make_fired_fixture(message=secret_message.name, notified=1)
		visible = self._make_fired_fixture(notified=1)

		frappe.set_user("test@example.com")
		names = [r["name"] for r in get_reminders()]
		self.assertNotIn(hidden.name, names)  # preview must not leak past lost access
		self.assertIn(visible.name, names)

		# The badge count applies the same containment — a row the list hides
		# must not leave a phantom badge.
		from raven.api.reminders import get_unread_reminder_count

		self.assertEqual(get_unread_reminder_count(), 1)

	def test_send_reminder_skips_row_rearmed_meanwhile(self):
		"""A future remind_at at delivery time means an edit/snooze raced the sweep —
		the fresh-read guard must leave the row armed instead of silencing it."""
		future = add_to_date(now_datetime(), hours=1, as_string=True, as_datetime=True)
		reminder = self._make_fired_fixture(remind_at=future)

		frappe.get_doc("Raven Reminder", reminder.name).send_reminder()

		self.assertEqual(frappe.db.get_value("Raven Reminder", reminder.name, "notified"), 0)

	def test_send_reminder_unlinked_user_is_terminal(self):
		reminder = self._make_fired_fixture()

		frappe.set_user("Administrator")
		frappe.db.set_value("Raven User", self.raven_user, "user", None, update_modified=False)

		frappe.get_doc("Raven Reminder", reminder.name).send_reminder()  # must not raise

		self.assertEqual(frappe.db.get_value("Raven Reminder", reminder.name, "notified"), 1)
		self.assertNotIn("test@example.com", self._liked_by())

	def test_update_reminder_changes_time_and_note(self):
		from raven.api.reminders import update_reminder

		future = add_to_date(now_datetime(), hours=1, as_string=True, as_datetime=True)
		reminder = self._make_reminder(future, description="old note")

		later = add_to_date(now_datetime(), hours=3, as_string=True, as_datetime=True)
		update_reminder(reminder.name, later, description="new note")

		self.assertEqual(
			get_datetime(frappe.db.get_value("Raven Reminder", reminder.name, "remind_at")),
			_ceil_grid(later),
		)
		self.assertEqual(frappe.db.get_value("Raven Reminder", reminder.name, "description"), "new note")

	def test_update_reminder_rejects_past_time(self):
		from raven.api.reminders import update_reminder

		future = add_to_date(now_datetime(), hours=1, as_string=True, as_datetime=True)
		reminder = self._make_reminder(future)

		past = add_to_date(now_datetime(), hours=-1, as_string=True, as_datetime=True)
		with self.assertRaises(frappe.ValidationError):
			update_reminder(reminder.name, past)

	def test_update_reminder_rejects_delivered(self):
		from raven.api.reminders import update_reminder

		fired = self._make_fired_fixture(notified=1)

		later = add_to_date(now_datetime(), hours=2, as_string=True, as_datetime=True)
		with self.assertRaises(frappe.ValidationError):
			update_reminder(fired.name, later)

	def test_update_reminder_ownership_guard(self):
		from raven.api.reminders import update_reminder

		future = add_to_date(now_datetime(), hours=1, as_string=True, as_datetime=True)
		reminder = self._make_reminder(future)

		frappe.set_user("Administrator")
		if not frappe.db.exists("Raven User", {"user": "test1@example.com"}):
			frappe.get_doc(
				{
					"doctype": "Raven User",
					"user": "test1@example.com",
					"type": "User",
					"enabled": 1,
				}
			).insert(ignore_permissions=True)
		frappe.get_doc("User", "test1@example.com").add_roles("Raven User")

		original_user = frappe.session.user
		try:
			frappe.set_user("test1@example.com")
			later = add_to_date(now_datetime(), hours=2, as_string=True, as_datetime=True)
			with self.assertRaises(frappe.PermissionError):
				update_reminder(reminder.name, later)
		finally:
			frappe.set_user(original_user)


def _make_channel_and_message(raven_user):
	"""Create a workspace + public channel, plus one message to anchor reminders on."""
	workspace = frappe.get_doc(
		{
			"doctype": "Raven Workspace",
			"workspace_name": frappe.generate_hash("test-reminder-ws", 8),
			"type": "Public",
		}
	).insert(ignore_permissions=True)
	channel = frappe.get_doc(
		{
			"doctype": "Raven Channel",
			"channel_name": frappe.generate_hash("test-rem", 8),
			"workspace": workspace.name,
			"type": "Public",
		}
	).insert(ignore_permissions=True)
	message = frappe.get_doc(
		{
			"doctype": "Raven Message",
			"channel_id": channel.name,
			"text": "<p>anchor</p>",
			"message_type": "Text",
		}
	).insert(ignore_permissions=True)
	return channel.name, message.name
