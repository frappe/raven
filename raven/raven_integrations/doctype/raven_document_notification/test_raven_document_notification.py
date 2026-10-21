# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase

from raven.raven_integrations.doctype.raven_document_notification.raven_document_notification import (
	evaluate_condition,
	get_context,
	run_document_notification,
	send_raven_notifications,
)

# On IntegrationTestCase, the doctype test records and all
# link-field test record depdendencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = ["Raven Workspace"]
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
		frappe.cache().hdel("raven_doc_notifications", "Error Log")
		frappe.flags.raven_sending_notification = False

	def notification_on(self, document_type):
		bot = frappe.get_doc(
			{"doctype": "Raven Bot", "bot_name": frappe.generate_hash("bot", 8)}
		).insert()
		return frappe.get_doc(
			{
				"doctype": "Raven Document Notification",
				"notification_name": frappe.generate_hash("notification", 8),
				"document_type": document_type,
				"send_alert_on": "New Document",
				"sender": bot.name,
				"message": "Hi",
				"recipients": [
					{"channel_type": "Channel", "variable_type": "Jinja", "value": "{{ doc.name }}"}
				],
			}
		)

	def test_a_notification_whose_channel_is_gone_can_be_disabled(self):
		channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": frappe.generate_hash("gone", 8),
				"type": "Public",
				"workspace": "Public Workspace",
			}
		).insert()
		notification = self.notification_on("ToDo")
		notification.recipients[0].variable_type = "Static"
		notification.recipients[0].value = channel.name
		notification.insert()
		# A channel deleted before the delete guard existed. Bypass the guard.
		frappe.db.delete("Raven Channel", {"name": channel.name})

		notification.reload()
		with self.assertRaises(frappe.ValidationError):
			notification.save()

		notification.enabled = 0
		notification.save()
		self.assertEqual(
			frappe.db.get_value("Raven Document Notification", notification.name, "enabled"), 0
		)

	def test_cannot_notify_on_raven_message(self):
		with self.assertRaises(frappe.ValidationError):
			self.notification_on("Raven Message").insert()

	def seed_error_log_notification(self):
		"""Pretend an enabled notification on Error Log exists, via the cache the trigger reads."""
		frappe.cache().hset(
			"raven_doc_notifications",
			"Error Log",
			[{"name": "on-error", "send_alert_on": "New Document", "condition": None}],
		)

	def test_error_log_notification_still_fires_for_real_errors(self):
		self.seed_error_log_notification()
		with patch("frappe.enqueue") as enqueue:
			run_document_notification(frappe.new_doc("Error Log"), "after_insert")
		enqueue.assert_called_once()

	def test_failed_send_does_not_fire_the_error_log_notification(self):
		# The issue's case: the recipient channel is gone, so the send fails.
		self.seed_error_log_notification()
		notification = self.notification_on("ToDo")
		notification.recipients[0].value = "deleted-channel"
		notification.insert()

		with patch("frappe.enqueue") as enqueue:
			send_raven_notifications(frappe.new_doc("ToDo"), [notification], "ToDo", "x")

		enqueue.assert_not_called()
		self.assertTrue(
			frappe.db.exists(
				"Error Log",
				{"reference_doctype": "Raven Document Notification", "reference_name": notification.name},
			)
		)

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
