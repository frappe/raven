import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_message import forward_message, send_message_with_attachments

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestSendAttachments(IntegrationTestCase):
	def setUp(self):
		# test1 and test3 are both in the channel
		for user in ("test@example.com", "test1@example.com", "test3@example.com"):
			frappe.get_doc("User", user).add_roles("Raven User")

		frappe.set_user("test@example.com")
		workspace = frappe.get_doc(
			{"doctype": "Raven Workspace", "workspace_name": "Attachments Workspace", "type": "Public"}
		).insert()
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "attachments",
				"type": "Public",
				"workspace": workspace.name,
			}
		).insert()
		for user in ("test1@example.com", "test3@example.com"):
			frappe.get_doc(
				{"doctype": "Raven Workspace Member", "user": user, "workspace": workspace.name}
			).insert(ignore_permissions=True)
			frappe.get_doc(
				{"doctype": "Raven Channel Member", "channel_id": self.channel.name, "user_id": user}
			).insert(ignore_permissions=True)

		# test1 uploads a private file, the way the composer does
		frappe.set_user("test1@example.com")
		self.file_url = (
			frappe.get_doc(
				{
					"doctype": "File",
					"file_name": "salary-slip.txt",
					"content": "private",
					"is_private": 1,
					"attached_to_doctype": "Raven Message",
				}
			)
			.insert(ignore_permissions=True)
			.file_url
		)
		frappe.clear_cache()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def send(self):
		return send_message_with_attachments(
			channel_id=self.channel.name, files=[{"file_url": self.file_url, "file_size": 7}]
		)

	def test_cannot_send_someone_elses_file(self):
		# The audit's case: test3 sends test1's private file to take it over.
		frappe.set_user("test3@example.com")
		with self.assertRaises(frappe.PermissionError):
			self.send()

	def test_can_send_your_own_file(self):
		frappe.set_user("test1@example.com")
		messages = self.send()
		self.assertEqual(messages[0].file, self.file_url)

	def test_cannot_forward_a_made_up_message(self):
		# The audit's case: an old-client forward with someone else's file and no real message.
		frappe.set_user("test3@example.com")
		with self.assertRaises(frappe.ValidationError):
			forward_message(
				message_receivers=[{"type": "Channel", "name": self.channel.name}],
				forwarded_message={"message_type": "File", "file": self.file_url},
			)

	def test_old_clients_forward_the_saved_message(self):
		frappe.set_user("test1@example.com")
		original = self.send()[0]

		# test3 forwards it the old way, with a tampered copy. Only the name is used.
		frappe.set_user("test3@example.com")
		forward_message(
			message_receivers=[{"type": "Channel", "name": self.channel.name}],
			forwarded_message={
				"name": original.name,
				"is_bot_message": 1,
				"file": "/private/files/other.txt",
			},
		)
		copy = frappe.get_all(
			"Raven Message",
			filters={"is_forwarded": 1, "owner": "test3@example.com"},
			fields=["file", "is_bot_message"],
		)[0]
		self.assertEqual(copy.file, self.file_url)
		self.assertFalse(copy.is_bot_message)
