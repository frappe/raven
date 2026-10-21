# Copyright (c) 2024, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestRavenBot(FrappeTestCase):
	def setUp(self):
		self.bot = frappe.get_doc(
			{"doctype": "Raven Bot", "bot_name": frappe.generate_hash("bot", 8)}
		).insert()

	def tearDown(self):
		frappe.db.rollback()

	def test_direct_message_to_a_disabled_user_is_skipped_quietly(self):
		frappe.db.set_value("Raven User", "test1@example.com", "enabled", 0)

		self.assertIsNone(self.bot.send_direct_message("test1@example.com", text="hello"))
		self.assertFalse(frappe.db.exists("Raven Message", {"bot": self.bot.name}))

	def test_direct_message_to_an_enabled_user_is_sent(self):
		message_id = self.bot.send_direct_message("test1@example.com", text="hello")

		self.assertTrue(frappe.db.exists("Raven Message", message_id))
