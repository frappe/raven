from contextlib import contextmanager
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from raven.api.native import APP_HEADER, APP_ORIGINS, boot, set_cors
from raven.api.raven_mobile import MIN_APP_VERSION, NATIVE_REDIRECT_URI, get_client_id


class TestNative(IntegrationTestCase):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.previous_client = frappe.db.get_single_value("Raven Settings", "oauth_client")
		self.client = frappe.get_doc(
			{
				"doctype": "OAuth Client",
				"app_name": "Raven Native Test",
				"scopes": "all openid",
				"redirect_uris": f"raven.thecommit.company: {NATIVE_REDIRECT_URI}",
				"default_redirect_uri": "raven.thecommit.company:",
				"grant_type": "Authorization Code",
				"response_type": "Code",
			}
		).insert(ignore_permissions=True)
		frappe.db.set_single_value("Raven Settings", "oauth_client", self.client.name)

	def tearDown(self):
		frappe.db.set_single_value("Raven Settings", "oauth_client", self.previous_client)
		frappe.db.rollback()
		super().tearDown()

	def test_client_info_reports_client_and_versions(self):
		data = get_client_id()
		self.assertEqual(data["client_id"], self.client.name)
		self.assertEqual(data["min_app_version"], MIN_APP_VERSION)
		self.assertEqual(data["sitename"], frappe.local.site)
		self.assertTrue(data["raven_version"])
		self.assertTrue(data["app_name"])
		# No favicon of its own set: the app shows its initial, not Raven's artwork twice.
		self.assertIsNone(data["logo"])

	def test_client_info_hides_client_without_native_redirect(self):
		self.client.redirect_uris = "raven.thecommit.company:"
		self.client.save(ignore_permissions=True)
		self.assertIsNone(get_client_id()["client_id"])

	def test_client_info_without_client(self):
		frappe.db.set_single_value("Raven Settings", "oauth_client", None)
		self.assertIsNone(get_client_id()["client_id"])

	@contextmanager
	def _request(self, origin=None, developer_mode=0, app=True, method="GET"):
		"""A request context like the one init_request builds, with a controlled conf."""
		headers = {"Origin": origin} if origin else {}
		# The app's marker: on the request itself, or in what a preflight asks to send.
		if origin and app:
			headers.update(
				{"Access-Control-Request-Headers": f"authorization, {APP_HEADER.lower()}"}
				if method == "OPTIONS"
				else {APP_HEADER: "1"}
			)
		frappe.local.request = frappe._dict(headers=headers, method=method)
		if hasattr(frappe.local, "allow_cors"):
			del frappe.local.allow_cors
		try:
			with patch("frappe.conf", frappe._dict(dict(frappe.conf), developer_mode=developer_mode)):
				yield
		finally:
			del frappe.local.request

	def test_boot_carries_session_and_raven_fields(self):
		with self._request():
			data = boot()
		self.assertEqual(data["user"]["name"], "Administrator")
		self.assertEqual(data["sitename"], frappe.local.site)
		self.assertIn("__messages", data)
		self.assertIn("chat_style", data)
		self.assertIn("server_script_enabled", data)
		self.assertNotIn("csrf_token", data)

	def test_boot_rejects_guest(self):
		frappe.set_user("Guest")
		self.assertRaises(frappe.PermissionError, boot)

	def _cors_for(self, origin, developer_mode=0, app=True, method="GET"):
		with self._request(origin, developer_mode, app, method):
			set_cors()
		return getattr(frappe.local, "allow_cors", None)

	def test_cors_allows_app_origins(self):
		for origin in APP_ORIGINS:
			self.assertEqual(self._cors_for(origin), origin)

	def test_cors_ignores_foreign_origin(self):
		self.assertIsNone(self._cors_for("https://evil.example"))

	def test_cors_needs_the_app_header(self):
		# A browser page at https://localhost sends the origin but cannot add the app's header.
		self.assertIsNone(self._cors_for("https://localhost", app=False))
		self.assertEqual(self._cors_for("https://localhost", method="OPTIONS"), "https://localhost")
		self.assertIsNone(self._cors_for("https://localhost", app=False, method="OPTIONS"))

	def test_cors_allows_http_localhost_in_developer_mode_only(self):
		self.assertIsNone(self._cors_for("http://localhost"))
		self.assertEqual(self._cors_for("http://localhost", developer_mode=1), "http://localhost")
