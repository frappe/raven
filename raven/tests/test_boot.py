import frappe
from frappe.tests import IntegrationTestCase

from raven.boot import boot_session

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


def _drop_field_from_meta(doctype: str, fieldname: str):
	"""The schema a migrate that never ran leaves: code reads a field the DocType lacks."""
	frappe.db.delete("DocField", {"parent": doctype, "fieldname": fieldname})
	frappe.clear_cache(doctype=doctype)


class TestBootBeforeMigrate(IntegrationTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()
		frappe.clear_cache(doctype="Raven Settings")
		frappe.clear_cache(doctype="Raven User")

	def test_a_settings_field_the_schema_lacks_counts_as_done(self):
		_drop_field_from_meta("Raven Settings", "setup_completed")
		# A Single loads every stored value; that site never stored this one.
		frappe.db.delete("Singles", {"doctype": "Raven Settings", "field": "setup_completed"})

		bootinfo = frappe._dict()
		boot_session(bootinfo)

		# mark_existing_sites_set_up marks a site that predates the field as set up.
		self.assertEqual(bootinfo.raven_setup_pending, 0)

	def test_a_raven_user_field_the_schema_lacks_counts_as_done(self):
		frappe.get_doc("User", "test1@example.com").add_roles("Raven User")
		frappe.db.set_value("Raven User", "test1@example.com", "onboarded", 0)
		_drop_field_from_meta("Raven User", "onboarded")
		frappe.set_user("test1@example.com")

		bootinfo = frappe._dict()
		boot_session(bootinfo)

		# mark_existing_users_onboarded marks users that predate the field as onboarded.
		self.assertEqual(bootinfo.raven_onboarded, 1)
