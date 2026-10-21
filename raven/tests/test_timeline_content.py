from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_message import get_timeline_message_content
from raven.api.threads import create_thread

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestTimelineContent(IntegrationTestCase):
	def setUp(self):
		# test is the workspace admin. test1 is a workspace member, test3 is not.
		frappe.get_doc("User", "test@example.com").add_roles("Raven Admin", "Raven User")
		frappe.get_doc("User", "test1@example.com").add_roles("Raven User")
		frappe.get_doc("User", "test3@example.com").add_roles("Raven User")

		# The document the messages talk about.
		self.todo = frappe.get_doc({"doctype": "ToDo", "description": "Timeline test"}).insert()

		frappe.set_user("test@example.com")
		workspace = frappe.get_doc(
			{"doctype": "Raven Workspace", "workspace_name": "Timeline Workspace", "type": "Public"}
		).insert()
		frappe.get_doc(
			{"doctype": "Raven Workspace Member", "user": "test1@example.com", "workspace": workspace.name}
		).insert(ignore_permissions=True)
		channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "timeline-public",
				"type": "Public",
				"workspace": workspace.name,
			}
		).insert()

		self.channel_message = self.send_linked_message(channel.name)
		thread = create_thread(message_id=self.channel_message)
		self.thread_message = self.send_linked_message(thread["thread_id"])
		frappe.clear_cache()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def send_linked_message(self, channel_id):
		return (
			frappe.get_doc(
				{
					"doctype": "Raven Message",
					"channel_id": channel_id,
					"message_type": "Text",
					"text": "About this ToDo",
					"link_doctype": "ToDo",
					"link_document": self.todo.name,
				}
			)
			.insert()
			.name
		)

	def timeline_message_ids(self, can_read_document=True):
		# Who can read a ToDo differs between Frappe versions, so stub that one check.
		# The channel rules below it run for real.
		with patch("frappe.has_permission", return_value=can_read_document) as has_permission:
			entries = get_timeline_message_content("ToDo", self.todo.name)
		has_permission.assert_called_once_with(doctype="ToDo", ptype="read", doc=self.todo.name)
		return {entry["template_data"]["name"] for entry in entries}

	def test_workspace_member_sees_channel_and_thread_messages(self):
		frappe.set_user("test1@example.com")
		self.assertEqual(self.timeline_message_ids(), {self.channel_message, self.thread_message})

	def test_user_outside_the_workspace_sees_nothing(self):
		# The audit's case: a Public channel in someone else's workspace.
		frappe.set_user("test3@example.com")
		self.assertEqual(self.timeline_message_ids(), set())

	def test_user_who_cannot_read_the_document_sees_nothing(self):
		# test1 can read the channel, but not the document.
		frappe.set_user("test1@example.com")
		self.assertEqual(self.timeline_message_ids(can_read_document=False), set())
