from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import cint

from raven.boot import boot_session
from raven.patches.v3_0 import mark_existing_sites_set_up

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


def _drop_field_from_meta(doctype: str, fieldname: str):
	"""The schema a migrate that never ran leaves: code reads a field the DocType lacks."""
	frappe.db.delete("DocField", {"parent": doctype, "fieldname": fieldname})
	frappe.clear_cache(doctype=doctype)


def _get_value_without_column(column: str):
	"""frappe.db.get_value on a table that lacks the column: selecting it raises like the DB does."""
	real_get_value = frappe.db.get_value

	def get_value(doctype, filters=None, fieldname="name", *args, **kwargs):
		requested = [fieldname] if isinstance(fieldname, str) else list(fieldname)
		if column in requested:
			raise Exception(f"Unknown column '{column}' in 'field list'")
		return real_get_value(doctype, filters, fieldname, *args, **kwargs)

	return get_value


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

	def test_marking_a_site_set_up_needs_no_schema(self):
		"""The patch runs before model sync, so it must write the value with the field still unknown."""
		_drop_field_from_meta("Raven Settings", "setup_completed")
		frappe.db.delete("Singles", {"doctype": "Raven Settings", "field": "setup_completed"})

		mark_existing_sites_set_up.execute()

		stored = frappe.db.sql(
			"select value from tabSingles where doctype=%s and field=%s",
			("Raven Settings", "setup_completed"),
		)
		self.assertEqual(cint(stored[0][0]), 1)

	def test_a_raven_user_field_the_schema_lacks_counts_as_done(self):
		frappe.get_doc("User", "test1@example.com").add_roles("Raven User")
		frappe.db.set_value("Raven User", "test1@example.com", "onboarded", 0)
		_drop_field_from_meta("Raven User", "onboarded")
		frappe.set_user("test1@example.com")

		bootinfo = frappe._dict()
		with patch.object(frappe.local.db, "get_value", _get_value_without_column("onboarded")):
			boot_session(bootinfo)

		# mark_existing_users_onboarded marks users that predate the field as onboarded.
		self.assertEqual(bootinfo.raven_onboarded, 1)
