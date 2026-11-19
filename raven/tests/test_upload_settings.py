from unittest.mock import patch

import frappe
from frappe.core.api.file import get_max_file_size
from frappe.core.doctype.system_settings.system_settings import clear_system_settings_cache
from frappe.tests import IntegrationTestCase

from raven.api.upload_file import get_upload_settings, set_max_file_size

EXTRA_TEST_RECORD_DEPENDENCIES = ["User"]
GB = 1024 * 1024 * 1024


class TestUploadSettings(IntegrationTestCase):
	def setUp(self):
		# test1 is a Raven Admin without System Manager, test2 has neither admin role
		user1 = frappe.get_doc("User", "test1@example.com")
		user1.add_roles("Raven Admin")
		user1.remove_roles("System Manager")
		user2 = frappe.get_doc("User", "test2@example.com")
		user2.remove_roles("Raven Admin", "System Manager")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		clear_system_settings_cache()

	def test_raven_admin_can_set_max_file_size(self):
		frappe.set_user("test1@example.com")
		self.assertEqual(set_max_file_size(40), 40 * 1024 * 1024)
		self.assertEqual(frappe.db.get_single_value("System Settings", "max_file_size"), 40)
		self.assertEqual(get_max_file_size(), 40 * 1024 * 1024)

	def test_get_upload_settings_reports_stored_and_default(self):
		frappe.set_user("test1@example.com")
		set_max_file_size(0)
		settings = get_upload_settings()
		self.assertEqual(settings["max_file_size_mb"], 0)
		self.assertEqual(settings["default_max_file_size"], get_max_file_size())
		self.assertNotIn("max_file_size", settings)

	def test_plain_user_cannot_set_or_read(self):
		frappe.set_user("test2@example.com")
		self.assertRaises(frappe.PermissionError, set_max_file_size, 40)
		self.assertRaises(frappe.PermissionError, get_upload_settings)

	def test_negative_rejected(self):
		frappe.set_user("test1@example.com")
		self.assertRaises(frappe.ValidationError, set_max_file_size, -1)

	def test_value_beyond_int_column_rejected(self):
		frappe.set_user("test1@example.com")
		self.assertRaises(frappe.ValidationError, set_max_file_size, 99999999999)

	def test_raven_admin_capped_at_1_gb(self):
		frappe.set_user("test1@example.com")
		self.assertEqual(set_max_file_size(1024), GB)
		self.assertRaises(frappe.ValidationError, set_max_file_size, 1025)

	def test_raven_admin_cannot_fall_back_to_a_default_above_the_cap(self):
		frappe.set_user("test1@example.com")
		with patch.dict(frappe.conf, {"max_file_size": 2 * GB}):
			self.assertRaises(frappe.ValidationError, set_max_file_size, 0)

	def test_system_manager_is_not_capped(self):
		self.assertEqual(set_max_file_size(2048), 2 * GB)

	def test_get_upload_settings_reports_the_cap(self):
		self.assertIsNone(get_upload_settings()["max_allowed_file_size"])
		frappe.set_user("test1@example.com")
		self.assertEqual(get_upload_settings()["max_allowed_file_size"], GB)
