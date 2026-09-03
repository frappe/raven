from urllib.parse import urlparse

import frappe
import requests
from frappe.tests import IntegrationTestCase
from frappe.utils import add_to_date, get_url, now_datetime

from raven.api.native_auth import _resolve_user, _safe_redirect


class TestNativeAuth(IntegrationTestCase):
	def setUp(self):
		self.committed = False
		super().setUp()
		frappe.set_user("Administrator")
		self.client = frappe.get_doc(
			{
				"doctype": "OAuth Client",
				"app_name": "Raven Test",
				"scopes": "all openid",
				"redirect_uris": "raven.thecommit.company:",
				"default_redirect_uri": "raven.thecommit.company:",
				"grant_type": "Authorization Code",
				"response_type": "Code",
			}
		).insert(ignore_permissions=True)
		self.other_client = frappe.copy_doc(self.client).insert(ignore_permissions=True)
		self.previous_oauth_client = frappe.db.get_single_value("Raven Settings", "oauth_client")
		frappe.db.set_single_value("Raven Settings", "oauth_client", self.client.name)
		self.tokens = []
		# Created in setUp so the HTTP worker can see it after commit.
		self.token = self.make_token()

	def make_token(self, **overrides):
		doc = {
			"doctype": "OAuth Bearer Token",
			"client": self.client.name,
			"user": "Administrator",
			"scopes": "all openid",
			"access_token": frappe.generate_hash(length=30),
			"refresh_token": frappe.generate_hash(length=30),
			"expires_in": 3600,
			"expiration_time": add_to_date(now_datetime(), hours=1),
			"status": "Active",
		}
		doc.update(overrides)
		token = frappe.get_doc(doc).insert(ignore_permissions=True)
		self.tokens.append(token.name)
		return token

	def tearDown(self):
		if self.committed:
			for name in self.tokens:
				frappe.db.delete("OAuth Bearer Token", {"name": name})
			frappe.db.delete("OAuth Client", {"name": self.client.name})
			frappe.db.delete("OAuth Client", {"name": self.other_client.name})
			frappe.db.set_single_value("Raven Settings", "oauth_client", self.previous_oauth_client)
			frappe.db.commit()
		frappe.db.rollback()
		frappe.set_user("Administrator")
		super().tearDown()

	def _login_urls(self):
		"""Candidate base URLs for the HTTP worker, best first."""
		port = frappe.conf.webserver_port or 8000
		candidates = []
		url = get_url()
		host = urlparse(url).netloc.split(":", 1)[0]
		if host in ("localhost", "127.0.0.1", frappe.local.site):
			candidates.append(url)
		candidates.extend(
			[
				f"http://{frappe.local.site}:{port}",
				f"http://localhost:{port}",
			]
		)
		return candidates

	def _post_login(self, access_token):
		for candidate in self._login_urls():
			try:
				return requests.post(
					f"{candidate}/api/method/raven.api.native_auth.login_with_token",
					data={"access_token": access_token, "redirect_to": "/raven/ws/x"},
					allow_redirects=False,
					timeout=(2, 30),
				)
			except requests.ConnectionError:
				continue
		self.skipTest(f"site not reachable over HTTP; tried: {', '.join(self._login_urls())}")

	def test_resolve_user_valid(self):
		self.assertEqual(_resolve_user(self.token.access_token), "Administrator")

	def test_resolve_user_expired(self):
		token = self.make_token(expiration_time=add_to_date(now_datetime(), hours=-1))
		with self.assertRaises(frappe.AuthenticationError):
			_resolve_user(token.access_token)

	def test_resolve_user_null_expiration(self):
		token = self.make_token()
		# validate() auto-fills a missing expiration_time on insert, so force NULL afterwards.
		frappe.db.set_value("OAuth Bearer Token", token.name, "expiration_time", None)
		with self.assertRaises(frappe.AuthenticationError):
			_resolve_user(token.access_token)

	def test_resolve_user_revoked(self):
		token = self.make_token(status="Revoked")
		with self.assertRaises(frappe.AuthenticationError):
			_resolve_user(token.access_token)

	def test_resolve_user_other_client(self):
		token = self.make_token(client=self.other_client.name)
		with self.assertRaises(frappe.AuthenticationError):
			_resolve_user(token.access_token)

	def test_resolve_user_unknown_token(self):
		with self.assertRaises(frappe.AuthenticationError):
			_resolve_user("nope")

	def test_resolve_user_disabled_user(self):
		disabled_user = frappe.get_doc(
			{
				"doctype": "User",
				"email": "disabled@raven.test",
				"first_name": "Disabled",
				"enabled": 0,
			}
		).insert(ignore_permissions=True)
		token = self.make_token(user=disabled_user.name)
		with self.assertRaises(frappe.AuthenticationError):
			_resolve_user(token.access_token)

	def test_resolve_user_missing_raven_client(self):
		frappe.db.set_single_value("Raven Settings", "oauth_client", None)
		self.addCleanup(frappe.db.set_single_value, "Raven Settings", "oauth_client", self.client.name)
		with self.assertRaises(frappe.AuthenticationError):
			_resolve_user(self.token.access_token)

	def test_safe_redirect_keeps_relative_raven_path(self):
		self.assertEqual(_safe_redirect("/raven/ws/x"), "/raven/ws/x")

	def test_safe_redirect_accepts_raven_root(self):
		self.assertEqual(_safe_redirect("/raven"), "/raven")
		self.assertEqual(_safe_redirect("/raven/"), "/raven/")

	def test_safe_redirect_rejects_absolute_url(self):
		self.assertEqual(_safe_redirect("https://evil.example/x"), "/raven")

	def test_safe_redirect_rejects_protocol_relative_url(self):
		self.assertEqual(_safe_redirect("//evil"), "/raven")

	def test_safe_redirect_rejects_path_traversal(self):
		self.assertEqual(_safe_redirect("/raven/../app/x"), "/raven")

	def test_safe_redirect_rejects_other_raven_prefixes(self):
		self.assertEqual(_safe_redirect("/ravenX"), "/raven")
		self.assertEqual(_safe_redirect("/raven_v2/x"), "/raven")

	def test_safe_redirect_rejects_crlf_injection(self):
		self.assertEqual(_safe_redirect("/raven/\r\nSet-Cookie: x"), "/raven")

	def test_safe_redirect_defaults_to_raven(self):
		self.assertEqual(_safe_redirect(None), "/raven")

	def test_http_login_with_token(self):
		frappe.db.commit()
		self.committed = True
		response = self._post_login(self.token.access_token)
		self.assertIn(response.status_code, (302, 303))
		self.assertTrue(response.headers["Location"].endswith("/raven/ws/x"))
		self.assertIn("sid", response.cookies)
		self.assertNotEqual(response.cookies["sid"], "Guest")
