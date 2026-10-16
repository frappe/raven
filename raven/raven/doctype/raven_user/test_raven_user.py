# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.core.doctype.user.user import User
from frappe.tests import IntegrationTestCase, UnitTestCase

# On IntegrationTestCase, the doctype test records and all
# link-field test record depdendencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class TestRavenUser(UnitTestCase):
	"""
	Unit tests for RavenUser.
	Use this class for testing individual functions and methods.
	"""

	pass


class TestRavenUser(IntegrationTestCase):
	"""
	Integration tests for RavenUser.
	Use this class for testing interactions between multiple components.
	"""

	def tearDown(self):
		frappe.db.rollback()

	def _user_with_raven(self):
		"""A fresh User with the Raven User role. The hook creates its Raven User."""
		user = frappe.get_doc(
			{
				"doctype": "User",
				"email": f"{frappe.generate_hash('raven', 8)}@example.com",
				"first_name": "Deleted",
				"send_welcome_email": 0,
				"roles": [{"role": "Raven User"}],
			}
		).insert()
		self.assertTrue(frappe.db.exists("Raven User", user.name))
		return user

	def test_deleting_a_user_does_not_save_the_user_again(self):
		# A save mid-delete runs every app's on_update hooks on the dying User,
		# which let other apps recreate their records and fail the deletion.
		user = self._user_with_raven()
		with patch.object(User, "save") as save:
			user.delete()
		save.assert_not_called()
		self.assertFalse(frappe.db.exists("Raven User", user.name))
		self.assertFalse(frappe.db.exists("User", user.name))

	def test_deleting_a_raven_user_removes_the_role_without_a_user_save(self):
		user = self._user_with_raven()
		with patch.object(User, "save") as save:
			frappe.delete_doc("Raven User", user.name)
		save.assert_not_called()
		self.assertNotIn("Raven User", frappe.get_roles(user.name))

	def test_user_name(self):
		user = frappe.get_doc("Raven User", "test@example.com")
		self.assertEqual(user.name, "test@example.com")
		self.assertEqual(user.full_name, "_Test")

	def test_first_name_follows_full_name_change(self):
		"""A profile rename writes only full_name; the derived first_name must
		follow it, or short displays (e.g. the typing indicator) show the old name."""
		user = frappe.get_doc("Raven User", "test@example.com")
		user.full_name = "Renamed Person"
		user.save()
		self.assertEqual(user.first_name, "Renamed")

	def test_explicit_first_name_edit_wins(self):
		user = frappe.get_doc("Raven User", "test@example.com")
		user.full_name = "Renamed Person"
		user.first_name = "Custom"
		user.save()
		self.assertEqual(user.first_name, "Custom")
