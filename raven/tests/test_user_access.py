import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_users import get_user_access, update_user_access

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestUserAccess(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		frappe.get_doc("User", "test1@example.com").add_roles("Raven User")
		self.workspace = frappe.get_doc(
			{"doctype": "Raven Workspace", "workspace_name": "Access Test Workspace", "type": "Private"}
		).insert()
		# Administrator becomes a member on create, so they can add others to it.
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "access-test-channel",
				"type": "Private",
				"workspace": self.workspace.name,
			}
		).insert()

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.delete("Raven Channel Member", {"channel_id": self.channel.name})
		frappe.db.delete("Raven Workspace Member", {"workspace": self.workspace.name})
		self.channel.delete()
		self.workspace.delete()

	def test_add_then_remove(self):
		user = "test1@example.com"
		access = update_user_access(
			user, add_workspaces=[self.workspace.name], add_channels=[self.channel.name]
		)
		self.assertIn(self.workspace.name, access["workspaces"])
		self.assertIn(self.channel.name, access["channels"])

		access = update_user_access(user, remove_channels=[self.channel.name])
		self.assertIn(self.workspace.name, access["workspaces"])
		self.assertNotIn(self.channel.name, access["channels"])

	def test_removing_workspace_removes_its_channels(self):
		user = "test1@example.com"
		update_user_access(user, add_workspaces=[self.workspace.name], add_channels=[self.channel.name])
		access = update_user_access(user, remove_workspaces=[self.workspace.name])
		self.assertNotIn(self.workspace.name, access["workspaces"])
		self.assertNotIn(self.channel.name, access["channels"])

	def test_private_access_hidden_from_admin_outside_it(self):
		# test1 is in the private workspace and channel; test@example.com is a System
		# Manager who is in neither, so must not learn about them.
		user = "test1@example.com"
		update_user_access(user, add_workspaces=[self.workspace.name], add_channels=[self.channel.name])
		frappe.get_doc("User", "test@example.com").add_roles("System Manager", "Raven User")
		try:
			frappe.set_user("test@example.com")
			access = get_user_access(user)
			self.assertNotIn(self.workspace.name, access["workspaces"])
			self.assertNotIn(self.channel.name, access["channels"])
			with self.assertRaises(frappe.PermissionError):
				update_user_access(user, remove_channels=[self.channel.name])
		finally:
			frappe.set_user("Administrator")

	def test_get_user_access_requires_admin(self):
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			get_user_access("test@example.com")
