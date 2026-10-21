import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_message import get_all_files_shared_in_channel

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestChannelFiles(IntegrationTestCase):
	def setUp(self):
		# test1 joins the workspace, test3 does not. Both are Raven Users.
		frappe.get_doc("User", "test@example.com").add_roles("Raven Admin", "Raven User")
		frappe.get_doc("User", "test1@example.com").add_roles("Raven User")
		frappe.get_doc("User", "test3@example.com").add_roles("Raven User")

		frappe.set_user("test@example.com")
		workspace = frappe.get_doc(
			{"doctype": "Raven Workspace", "workspace_name": "Files Workspace", "type": "Public"}
		).insert()
		frappe.get_doc(
			{"doctype": "Raven Workspace Member", "user": "test1@example.com", "workspace": workspace.name}
		).insert(ignore_permissions=True)
		self.channels = {
			channel_type: frappe.get_doc(
				{
					"doctype": "Raven Channel",
					"channel_name": f"files-{channel_type.lower()}",
					"type": channel_type,
					"workspace": workspace.name,
				}
			)
			.insert()
			.name
			for channel_type in ("Public", "Open")
		}
		frappe.clear_cache()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def test_workspace_member_can_list_files(self):
		frappe.set_user("test1@example.com")
		for channel in self.channels.values():
			self.assertEqual(get_all_files_shared_in_channel(channel), [])

	def test_outsider_cannot_list_files(self):
		# The audit's case: a user outside the workspace read Public/Open channel files.
		frappe.set_user("test3@example.com")
		for channel in self.channels.values():
			with self.assertRaises(frappe.PermissionError):
				get_all_files_shared_in_channel(channel)
