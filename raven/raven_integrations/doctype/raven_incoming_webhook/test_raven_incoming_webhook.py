# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# For license information, please see license.txt

# import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase

# On IntegrationTestCase, the doctype test records and all
# link-field test record dependencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class UnitTestRavenIncomingWebhook(UnitTestCase):
	"""
	Unit tests for RavenIncomingWebhook.
	Use this class for testing individual functions and methods.
	"""

	pass


class IntegrationTestRavenIncomingWebhook(IntegrationTestCase):
	"""
	Integration tests for RavenIncomingWebhook.
	Use this class for testing interactions between multiple components.
	"""

	pass
