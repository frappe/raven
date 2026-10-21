# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# See license.txt

import json

import frappe
from frappe.tests import IntegrationTestCase

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestRavenChannelMember(IntegrationTestCase):
	def setUp(self):
		for email in ("test@example.com", "test1@example.com"):
			frappe.get_doc("User", email).add_roles("Raven User")
		frappe.set_user("test@example.com")

		self.workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": frappe.generate_hash("member-ws", 8),
				"type": "Public",
			}
		).insert()

		# Only workspace members can be added to a channel.
		frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"workspace": self.workspace.name,
				"user": "test1@example.com",
			}
		).insert()

		# The creator becomes the only admin. The second member is who admin passes to.
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": frappe.generate_hash("member", 8),
				"type": "Private",
				"workspace": self.workspace.name,
			}
		).insert()
		frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": self.channel.name,
				"user_id": "test1@example.com",
			}
		).insert()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def _latest_system_message(self):
		message = frappe.get_last_doc(
			"Raven Message", {"channel_id": self.channel.name, "message_type": "System"}
		)
		return message.text, json.loads(message.json)

	def _member(self, user):
		return frappe.get_doc("Raven Channel Member", {"channel_id": self.channel.name, "user_id": user})

	def test_leaving_as_the_only_admin_says_left_not_removed(self):
		"""A member who removes themselves "left"; nobody removed them."""
		self._member("test@example.com").delete()

		text, event = self._latest_system_message()
		self.assertIn(" left and ", text)
		self.assertNotIn("removed", text)
		self.assertEqual(event["event"], "user_left")
		self.assertEqual(event["user"], "test@example.com")
		self.assertEqual(event["new_admin"], "test1@example.com")
		self.assertTrue(self._member("test1@example.com").is_admin)

	def test_removing_the_only_admin_names_who_removed_them(self):
		frappe.set_user("Administrator")
		self._member("test@example.com").delete()

		text, event = self._latest_system_message()
		self.assertIn(" was removed by ", text)
		self.assertEqual(event["event"], "member_removed")
		self.assertEqual(event["removed_by"], "Administrator")
		self.assertEqual(event["new_admin"], "test1@example.com")
