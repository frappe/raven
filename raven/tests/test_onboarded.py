import frappe
from frappe.tests import IntegrationTestCase

from raven.boot import boot_session
from raven.patches.v3_0 import mark_existing_users_onboarded

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]

EXISTING = "onboarded-existing@example.com"
NEWCOMER = "onboarded-new@example.com"


def _make_raven_user(email: str):
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Onboard",
				"send_welcome_email": 0,
				"roles": [{"role": "Raven User"}],
			}
		).insert(ignore_permissions=True)


class TestOnboarded(IntegrationTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_new_raven_user_is_not_onboarded(self):
		_make_raven_user(NEWCOMER)
		self.assertEqual(frappe.db.get_value("Raven User", NEWCOMER, "onboarded"), 0)

	def test_patch_marks_existing_users_onboarded(self):
		_make_raven_user(EXISTING)
		mark_existing_users_onboarded.execute()
		self.assertEqual(frappe.db.get_value("Raven User", EXISTING, "onboarded"), 1)
		_make_raven_user(NEWCOMER)
		self.assertEqual(frappe.db.get_value("Raven User", NEWCOMER, "onboarded"), 0)

	def test_boot_reports_onboarded(self):
		_make_raven_user(NEWCOMER)
		frappe.set_user(NEWCOMER)
		bootinfo = frappe._dict()
		boot_session(bootinfo)
		self.assertEqual(bootinfo.raven_onboarded, 0)
		frappe.set_user("Administrator")
		frappe.db.set_value("Raven User", NEWCOMER, "onboarded", 1)
		frappe.set_user(NEWCOMER)
		bootinfo = frappe._dict()
		boot_session(bootinfo)
		self.assertEqual(bootinfo.raven_onboarded, 1)

	def test_boot_without_raven_user_counts_as_onboarded(self):
		frappe.set_user("Guest")
		bootinfo = frappe._dict()
		boot_session(bootinfo)
		self.assertEqual(bootinfo.raven_onboarded, 1)
