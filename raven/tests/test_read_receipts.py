from datetime import timedelta

import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_message import get_message_readers

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestReadReceipts(IntegrationTestCase):
	def setUp(self):
		for email in ("test@example.com", "test1@example.com", "test3@example.com"):
			frappe.get_doc("User", email).add_roles("Raven User")
		frappe.set_user("test@example.com")

		self.workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": "RR Test Workspace",
				"type": "Public",
			}
		).insert()

		# Private channel so membership is explicit (no implicit open-channel members)
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "rr-test-channel",
				"type": "Private",
				"workspace": self.workspace.name,
			}
		).insert()

		# Add test1 and test3 as members (test is added automatically as creator/admin)
		for email in ("test1@example.com", "test3@example.com"):
			frappe.get_doc(
				{"doctype": "Raven Channel Member", "channel_id": self.channel.name, "user_id": email}
			).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def _send(self, text="hello"):
		return frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel.name,
				"message_type": "Text",
				"text": text,
			}
		).insert()

	def _set_last_visit(self, email, when):
		name = frappe.db.get_value(
			"Raven Channel Member", {"channel_id": self.channel.name, "user_id": email}, "name"
		)
		frappe.db.set_value("Raven Channel Member", name, "last_visit", when)

	def test_returns_members_whose_watermark_covers_message(self):
		frappe.set_user("test@example.com")
		message = self._send("a message")

		# test1 has read up to now (>= message.creation), test3 has not
		self._set_last_visit("test1@example.com", frappe.utils.add_to_date(message.creation, seconds=1))
		self._set_last_visit(
			"test3@example.com", frappe.utils.add_to_date(message.creation, seconds=-60)
		)

		readers = get_message_readers(message.name)
		reader_ids = {r["user_id"] for r in readers}

		self.assertIn("test1@example.com", reader_ids)
		self.assertNotIn("test3@example.com", reader_ids)

	def test_excludes_message_author(self):
		frappe.set_user("test@example.com")
		message = self._send("by test")
		# author's own membership watermark covers the message
		self._set_last_visit("test@example.com", frappe.utils.add_to_date(message.creation, seconds=1))
		# test1 also has read the message
		self._set_last_visit("test1@example.com", frappe.utils.add_to_date(message.creation, seconds=1))

		readers = get_message_readers(message.name)
		reader_ids = {r["user_id"] for r in readers}
		self.assertNotIn("test@example.com", reader_ids)
		self.assertIn("test1@example.com", reader_ids)

	def test_set_channel_unread_anchors_to_message(self):
		from raven.api.raven_message import get_unread_count_for_channel
		from raven.utils import set_channel_unread

		frappe.set_user("test@example.com")
		m1 = self._send("first")
		m2 = self._send("second")
		m3 = self._send("third")

		# test1 has read everything
		self._set_last_visit("test1@example.com", frappe.utils.add_to_date(m3.creation, seconds=5))

		# test1 marks the channel unread from m2 -> m2 and m3 become unread (2)
		frappe.set_user("test1@example.com")
		set_channel_unread(self.channel.name, message_id=m2.name)

		# unread counts exclude the user's own messages; m1,m2,m3 authored by `test`
		self.assertEqual(get_unread_count_for_channel(self.channel.name), 2)

	def test_set_channel_unread_no_message_uses_latest(self):
		from raven.api.raven_message import get_unread_count_for_channel
		from raven.utils import set_channel_unread

		frappe.set_user("test@example.com")
		self._send("first")
		self._send("second")
		m3 = self._send("third")

		self._set_last_visit("test1@example.com", frappe.utils.add_to_date(m3.creation, seconds=5))

		frappe.set_user("test1@example.com")
		set_channel_unread(self.channel.name)  # latest message only

		self.assertEqual(get_unread_count_for_channel(self.channel.name), 1)

	def test_set_channel_unread_creates_member_record(self):
		from raven.utils import set_channel_unread

		# Open channel, test3 never joined -> no member record
		frappe.set_user("test@example.com")
		open_channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "rr-open-channel",
				"type": "Open",
				"workspace": self.workspace.name,
			}
		).insert()
		message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": open_channel.name,
				"message_type": "Text",
				"text": "hi open",
			}
		).insert()

		frappe.set_user("test3@example.com")
		self.assertIsNone(
			frappe.db.get_value(
				"Raven Channel Member",
				{"channel_id": open_channel.name, "user_id": "test3@example.com"},
				"name",
			)
		)
		set_channel_unread(open_channel.name, message_id=message.name)

		self.assertIsNotNone(
			frappe.db.get_value(
				"Raven Channel Member",
				{"channel_id": open_channel.name, "user_id": "test3@example.com"},
				"name",
			)
		)
		# Anchor is the channel's only message, so the watermark sits one
		# microsecond below it — the whole channel reads as unread, no sentinel.
		stored = frappe.utils.get_datetime(
			frappe.db.get_value(
				"Raven Channel Member",
				{"channel_id": open_channel.name, "user_id": "test3@example.com"},
				"last_visit",
			)
		)
		self.assertEqual(stored, frappe.utils.get_datetime(message.creation) - timedelta(microseconds=1))

	def test_mark_channel_as_unread_endpoint(self):
		from raven.api.raven_channel_member import mark_channel_as_unread
		from raven.api.raven_message import get_unread_count_for_channel

		frappe.set_user("test@example.com")
		self._send("first")
		m2 = self._send("second")

		self._set_last_visit("test1@example.com", frappe.utils.add_to_date(m2.creation, seconds=5))

		frappe.set_user("test1@example.com")
		result = mark_channel_as_unread(self.channel.name, message_id=m2.name)

		self.assertEqual(result, 1)
		self.assertEqual(get_unread_count_for_channel(self.channel.name), 1)

	def test_mark_channel_as_unread_requires_permission(self):
		from raven.api.raven_channel_member import mark_channel_as_unread

		frappe.set_user("test@example.com")
		message = self._send("secret")

		# test2 is not a Raven User and not a member of this private channel
		frappe.set_user("test2@example.com")
		with self.assertRaises(frappe.PermissionError):
			mark_channel_as_unread(self.channel.name, message_id=message.name)

	def test_mark_channel_as_unread_returns_count(self):
		from raven.api.raven_channel_member import mark_channel_as_unread

		frappe.set_user("test@example.com")
		self._send("first")
		m2 = self._send("second")
		self._send("third")

		self._set_last_visit("test1@example.com", frappe.utils.add_to_date(m2.creation, seconds=10))

		# test1 marks unread from m2 -> m2 + third are unread (2), authored by `test`
		frappe.set_user("test1@example.com")
		count = mark_channel_as_unread(self.channel.name, message_id=m2.name)

		self.assertEqual(count, 2)

	def test_set_channel_unread_noop_for_non_open_non_member(self):
		"""
		set_channel_unread must NOT insert a Raven Channel Member record (and must
		NOT emit a spurious "X joined." System message) when the channel is not
		Open and the calling user has no existing member record.
		"""
		from raven.utils import set_channel_unread

		# Create a Private channel and a message as admin/test
		frappe.set_user("test@example.com")
		private_channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "rr-noop-private-channel",
				"type": "Private",
				"workspace": self.workspace.name,
			}
		).insert()
		message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": private_channel.name,
				"message_type": "Text",
				"text": "noop test message",
			}
		).insert(ignore_permissions=True)

		# Count system messages before
		system_msg_count_before = frappe.db.count(
			"Raven Message",
			{"channel_id": private_channel.name, "message_type": "System"},
		)

		# test3 has NO member record for this private channel
		frappe.set_user("test3@example.com")
		self.assertIsNone(
			frappe.db.get_value(
				"Raven Channel Member",
				{"channel_id": private_channel.name, "user_id": "test3@example.com"},
				"name",
			)
		)

		# Call set_channel_unread — should be a no-op (returns early)
		set_channel_unread(private_channel.name, message_id=message.name)

		# Assert no member record was created
		self.assertIsNone(
			frappe.db.get_value(
				"Raven Channel Member",
				{"channel_id": private_channel.name, "user_id": "test3@example.com"},
				"name",
			),
			"set_channel_unread must not create a member record for a non-Open channel",
		)

		# Assert no spurious System message was emitted
		system_msg_count_after = frappe.db.count(
			"Raven Message",
			{"channel_id": private_channel.name, "message_type": "System"},
		)
		self.assertEqual(
			system_msg_count_before,
			system_msg_count_after,
			"set_channel_unread must not emit a 'joined' System message for a non-Open channel",
		)
