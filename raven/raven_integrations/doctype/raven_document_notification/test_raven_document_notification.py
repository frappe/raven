# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase

from raven.raven_integrations.doctype.raven_document_notification.raven_document_notification import (
	evaluate_condition,
	get_context,
)

# On IntegrationTestCase, the doctype test records and all
# link-field test record depdendencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class UnitTestRavenDocumentNotification(UnitTestCase):
	"""
	Unit tests for RavenDocumentNotification.
	Use this class for testing individual functions and methods.
	"""

	pass


class IntegrationTestRavenDocumentNotification(IntegrationTestCase):
	"""
	Integration tests for RavenDocumentNotification.
	Use this class for testing interactions between multiple components.
	"""

	def tearDown(self):
		frappe.db.rollback()

	def evaluate(self, condition):
		context = get_context(frappe._dict(status="Open", total=500))
		return evaluate_condition(context, condition, "test-notification")

	def test_simple_conditions_still_work(self):
		self.assertTrue(self.evaluate('doc.status == "Open"'))
		self.assertTrue(self.evaluate("frappe.utils.flt(doc.total) > 100"))

	def test_condition_cannot_write_data(self):
		# The audit's case: a Raven Admin wrote data through the condition.
		first_name = frappe.db.get_value("User", "Administrator", "first_name")
		with self.assertRaises(frappe.ValidationError):
			self.evaluate('frappe.db.set_value("User", "Administrator", "first_name", "Changed")')
		self.assertEqual(frappe.db.get_value("User", "Administrator", "first_name"), first_name)
