import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_channel import transfer_channel_to_workspace
from raven.utils import delete_workspace_members_cache

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestTransferChannel(IntegrationTestCase):
	def setUp(self):
		for email in ("test@example.com", "test1@example.com", "test3@example.com"):
			frappe.get_doc("User", email).add_roles("Raven User")
		frappe.set_user("test@example.com")

		# Two workspaces; `test` is admin of both (creator is auto-admin).
		self.ws_a = frappe.get_doc(
			{"doctype": "Raven Workspace", "workspace_name": "TC Workspace A", "type": "Public"}
		).insert()
		self.ws_b = frappe.get_doc(
			{"doctype": "Raven Workspace", "workspace_name": "TC Workspace B", "type": "Public"}
		).insert()

		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "tc-channel",
				"type": "Private",
				"workspace": self.ws_a.name,
			}
		).insert()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def _make_admin(self, email, workspace):
		name = frappe.db.get_value(
			"Raven Workspace Member", {"workspace": workspace, "user": email}, "name"
		)
		if name:
			frappe.db.set_value("Raven Workspace Member", name, "is_admin", 1)
		else:
			frappe.get_doc(
				{"doctype": "Raven Workspace Member", "workspace": workspace, "user": email, "is_admin": 1}
			).insert(ignore_permissions=True)

	def test_moves_channel_workspace_field(self):
		frappe.set_user("test@example.com")
		transfer_channel_to_workspace(self.channel.name, self.ws_b.name)
		self.assertEqual(
			frappe.db.get_value("Raven Channel", self.channel.name, "workspace"), self.ws_b.name
		)
		# PK is unchanged (opaque).
		self.assertTrue(frappe.db.exists("Raven Channel", self.channel.name))

	def test_requires_admin_of_both_workspaces(self):
		# test1 is a Raven User but admin of neither workspace.
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			transfer_channel_to_workspace(self.channel.name, self.ws_b.name)

	def test_rejects_open_channel(self):
		frappe.set_user("test@example.com")
		open_channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "tc-open",
				"type": "Open",
				"workspace": self.ws_a.name,
			}
		).insert()
		with self.assertRaises(frappe.ValidationError):
			transfer_channel_to_workspace(open_channel.name, self.ws_b.name)

	def test_rejects_same_workspace(self):
		frappe.set_user("test@example.com")
		with self.assertRaises(frappe.ValidationError):
			transfer_channel_to_workspace(self.channel.name, self.ws_a.name)

	def test_rejects_name_collision_in_target(self):
		frappe.set_user("test@example.com")
		# B already has a channel named "tc-channel".
		frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "tc-channel",
				"type": "Private",
				"workspace": self.ws_b.name,
			}
		).insert()
		with self.assertRaises(frappe.ValidationError):
			transfer_channel_to_workspace(self.channel.name, self.ws_b.name)

	def test_member_not_in_target_is_dropped_when_not_adding(self):
		frappe.set_user("test@example.com")
		# test1 is a member of the channel but NOT of workspace B.
		frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": self.channel.name,
				"user_id": "test1@example.com",
			}
		).insert(ignore_permissions=True)

		transfer_channel_to_workspace(
			self.channel.name, self.ws_b.name, add_missing_members_to_workspace=False
		)

		self.assertIsNone(
			frappe.db.get_value(
				"Raven Channel Member",
				{"channel_id": self.channel.name, "user_id": "test1@example.com"},
				"name",
			)
		)

	def test_member_not_in_target_is_added_to_workspace_when_opted_in(self):
		frappe.set_user("test@example.com")
		frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": self.channel.name,
				"user_id": "test1@example.com",
			}
		).insert(ignore_permissions=True)

		transfer_channel_to_workspace(
			self.channel.name, self.ws_b.name, add_missing_members_to_workspace=True
		)

		# Added to workspace B...
		self.assertTrue(
			frappe.db.exists(
				"Raven Workspace Member", {"workspace": self.ws_b.name, "user": "test1@example.com"}
			)
		)
		# ...and kept as a channel member.
		self.assertTrue(
			frappe.db.exists(
				"Raven Channel Member", {"channel_id": self.channel.name, "user_id": "test1@example.com"}
			)
		)

	def test_non_member_admin_can_transfer(self):
		# test1 is admin of BOTH workspaces but NOT a member of the Private channel.
		# Granting admin and clearing cache so get_workspace_members sees the new rows.
		frappe.set_user("Administrator")
		self._make_admin("test1@example.com", self.ws_a.name)
		self._make_admin("test1@example.com", self.ws_b.name)
		delete_workspace_members_cache(self.ws_a.name)
		delete_workspace_members_cache(self.ws_b.name)

		frappe.set_user("test1@example.com")
		transfer_channel_to_workspace(self.channel.name, self.ws_b.name)
		self.assertEqual(
			frappe.db.get_value("Raven Channel", self.channel.name, "workspace"), self.ws_b.name
		)

	def test_child_threads_follow_to_target(self):
		frappe.set_user("test@example.com")
		# A message in the channel, and a thread channel spawned from it
		# (a thread is a Raven Channel whose channel_name == the message id).
		message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel.name,
				"message_type": "Text",
				"text": "root",
			}
		).insert(ignore_permissions=True)
		thread = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": message.name,
				"type": "Private",
				"is_thread": 1,
				"workspace": self.ws_a.name,
			}
		).insert(ignore_permissions=True)

		transfer_channel_to_workspace(self.channel.name, self.ws_b.name)

		self.assertEqual(frappe.db.get_value("Raven Channel", thread.name, "workspace"), self.ws_b.name)

	def test_dropping_members_posts_no_system_message(self):
		# Pruning a member during transfer must NOT emit a "X left."/"removed X"
		# system message (after_delete side effect) — they're pruned for workspace
		# access, not leaving the channel socially.
		frappe.set_user("test@example.com")
		frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": self.channel.name,
				"user_id": "test1@example.com",
			}
		).insert(ignore_permissions=True)

		before = frappe.db.count(
			"Raven Message", {"channel_id": self.channel.name, "message_type": "System"}
		)
		transfer_channel_to_workspace(
			self.channel.name, self.ws_b.name, add_missing_members_to_workspace=False
		)
		after = frappe.db.count(
			"Raven Message", {"channel_id": self.channel.name, "message_type": "System"}
		)
		self.assertEqual(before, after)
