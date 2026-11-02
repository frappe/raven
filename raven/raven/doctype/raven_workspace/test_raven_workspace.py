# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase

from raven.api.workspaces import get_workspace_names

# On IntegrationTestCase, the doctype test records and all
# link-field test record depdendencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class TestRavenWorkspace(UnitTestCase):
	"""
	Unit tests for RavenWorkspace.
	Use this class for testing individual functions and methods.
	"""

	pass


class TestRavenWorkspace(IntegrationTestCase):
	"""
	Integration tests for RavenWorkspace.
	Use this class for testing interactions between multiple components.
	"""

	def test_create_workspace_member_for_owner(self):
		"""
		Test that when a workspace is created, a member is created for the owner.
		"""

		workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": "Test Workspace",
				"type": "Public",
			}
		)

		workspace.insert()

		member = frappe.get_doc(
			"Raven Workspace Member", {"workspace": workspace.name, "user": workspace.owner}
		)
		self.assertTrue(member.is_admin)

		workspace.delete()

	def test_delete_workspace(self):
		"""
		Test that when a workspace is deleted, all its members and channels are also deleted.
		"""
		workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": "Test Workspace",
				"type": "Public",
			}
		)

		workspace.insert()

		member = frappe.get_doc(
			"Raven Workspace Member", {"workspace": workspace.name, "user": workspace.owner}
		)

		# Create a channel
		channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "Test Channel",
				"workspace": workspace.name,
			}
		)

		channel.insert()

		workspace.delete()

		self.assertRaises(frappe.DoesNotExistError, frappe.get_doc, "Raven Channel", channel.name)
		self.assertRaises(
			frappe.DoesNotExistError, frappe.get_doc, "Raven Workspace Member", member.name
		)

	def test_workspace_cache_follows_insert_rename_and_delete(self):
		self.addCleanup(frappe.db.rollback)
		# Filled before the changes, so each step has to clear it.
		get_workspace_names()

		workspace = frappe.get_doc(
			{"doctype": "Raven Workspace", "workspace_name": "Cache North", "type": "Public"}
		).insert()
		self.assertEqual(get_workspace_names().get(workspace.name), "Cache North")

		frappe.rename_doc("Raven Workspace", workspace.name, "Cache South")
		self.assertNotIn(workspace.name, get_workspace_names())
		self.assertIn("Cache South", get_workspace_names())

		frappe.delete_doc("Raven Workspace", "Cache South")
		self.assertNotIn("Cache South", get_workspace_names())
