# Copyright (c) 2024, The Commit Company (Algocode Technologies Pvt. Ltd.) and Contributors
# See license.txt

import frappe
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
