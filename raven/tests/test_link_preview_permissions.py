import frappe
from frappe.tests import IntegrationTestCase

from raven.api.preview_links import get_preview_link
from raven.links import normalize_url

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]

SECRET_URL = "https://example.com/invite?token=posted-in-a-private-dm"


class TestLinkPreviewPermissions(IntegrationTestCase):
	def setUp(self):
		# test1 is a Raven User, test2 is not
		frappe.get_doc("User", "test1@example.com").add_roles("Raven User")
		frappe.get_doc("User", "test2@example.com").remove_roles("Raven User")
		frappe.get_doc(
			{
				"doctype": "Raven Link Preview",
				"url": normalize_url(SECRET_URL),
				"title": "Private invite",
				"status": "Fetched",
			}
		).insert(ignore_permissions=True)

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def test_raven_user_cannot_list_every_preview(self):
		# The audit's case: /api/resource/Raven Link Preview listed links from every channel and DM.
		frappe.set_user("test1@example.com")
		self.assertFalse(frappe.has_permission("Raven Link Preview", ptype="read"))
		with self.assertRaises(frappe.PermissionError):
			frappe.get_list("Raven Link Preview", fields=["url"])

	def test_get_preview_link_needs_the_raven_user_role(self):
		frappe.set_user("test2@example.com")
		with self.assertRaises(frappe.PermissionError):
			get_preview_link([SECRET_URL])

		# The old mobile app still reads previews this way.
		frappe.set_user("test1@example.com")
		self.assertEqual(get_preview_link([SECRET_URL])[0]["title"], "Private invite")
