import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_users import enable_user

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestEnableUser(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.user = frappe.get_doc("User", "test1@example.com")
		self.user.add_roles("Raven User")

	def tearDown(self):
		frappe.db.rollback()

	def raven_enabled(self):
		return frappe.db.get_value("Raven User", "test1@example.com", "enabled")

	def test_enables_a_disabled_account(self):
		self.user.enabled = 0
		self.user.save()
		self.assertEqual(self.raven_enabled(), 0)

		enable_user("test1@example.com")

		self.assertEqual(frappe.db.get_value("User", "test1@example.com", "enabled"), 1)
		self.assertEqual(self.raven_enabled(), 1)

	def test_restores_a_removed_raven_user_role(self):
		# The review's case: the account is active, only the role is gone.
		self.user.remove_roles("Raven User")
		self.user.save()
		self.assertEqual(self.raven_enabled(), 0)

		enable_user("test1@example.com")

		self.assertIn("Raven User", frappe.get_roles("test1@example.com"))
		self.assertEqual(self.raven_enabled(), 1)
