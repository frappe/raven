import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_users import invite_user

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestInviteUser(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": "Invite Test Workspace",
				"type": "Private",
			}
		).insert()
		self.other_workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": "Invite Test Workspace 2",
				"type": "Public",
			}
		).insert()

		# Administrator becomes a member on create, so they can add others to it.
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "invite-test-channel",
				"type": "Private",
				"workspace": self.workspace.name,
			}
		).insert()

	def tearDown(self):
		frappe.set_user("Administrator")
		# Workspaces first: deleting them clears their member rows, so the
		# invitee's Raven User has no links left when the User goes.
		self.channel.delete()
		self.workspace.delete()
		self.other_workspace.delete()
		for email in ("invitee@example.com",):
			if frappe.db.exists("User", email):
				frappe.delete_doc("User", email, force=True)

	def _is_member(self, user, workspace):
		return bool(frappe.db.exists("Raven Workspace Member", {"workspace": workspace, "user": user}))

	def test_new_user_is_added_to_workspaces(self):
		invite_user(
			"invitee@example.com",
			"Invitee",
			"Person",
			workspaces=[self.workspace.name, self.other_workspace.name],
		)
		self.assertTrue(frappe.db.exists("Raven User", "invitee@example.com"))
		self.assertTrue(self._is_member("invitee@example.com", self.workspace.name))
		self.assertTrue(self._is_member("invitee@example.com", self.other_workspace.name))

	def test_existing_frappe_user_is_added_to_workspaces(self):
		# test1@example.com exists as a Frappe user but must not be a Raven user yet.
		frappe.db.delete("Raven Workspace Member", {"user": "test1@example.com"})
		frappe.db.delete("Raven User", {"user": "test1@example.com"})
		user = frappe.get_doc("User", "test1@example.com")
		user.roles = [r for r in user.roles if r.role != "Raven User"]
		user.save()

		invite_user("test1@example.com", workspaces=[self.workspace.name])
		self.assertTrue(frappe.db.exists("Raven User", "test1@example.com"))
		self.assertTrue(self._is_member("test1@example.com", self.workspace.name))

	def test_new_user_is_added_to_channels(self):
		invite_user(
			"invitee@example.com",
			"Invitee",
			"Person",
			workspaces=[self.workspace.name],
			channels=[self.channel.name],
		)
		self.assertTrue(
			frappe.db.exists(
				"Raven Channel Member", {"channel_id": self.channel.name, "user_id": "invitee@example.com"}
			)
		)

	def test_workspaces_accepts_json_string(self):
		invite_user("invitee@example.com", "Invitee", "Person", workspaces=f'["{self.workspace.name}"]')
		self.assertTrue(self._is_member("invitee@example.com", self.workspace.name))

	def test_no_workspaces_still_invites(self):
		invite_user("invitee@example.com", "Invitee", "Person")
		self.assertTrue(frappe.db.exists("Raven User", "invitee@example.com"))
		self.assertFalse(self._is_member("invitee@example.com", self.workspace.name))
