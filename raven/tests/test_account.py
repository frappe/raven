from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_to_date, now_datetime
from frappe.utils.password import check_password, update_password

from raven.api.account import change_password, get_request_bearer_token, send_password_reset_link
from raven.api.raven_mobile import NATIVE_REDIRECT_URI
from raven.boot import boot_session
from raven.raven.doctype.raven_push_token.raven_push_token import RavenPushToken

HAS_AUTH_METHOD = frappe.get_meta("OAuth Client").has_field("token_endpoint_auth_method")

USER = "test@example.com"
OTHER_USER = "test1@example.com"
OLD = "Old-Passw0rd#2026"
NEW = "N3w-Strong-Passw0rd!2026"


def make_client(app_name):
	client = frappe.get_doc(
		{
			"doctype": "OAuth Client",
			"app_name": app_name,
			"scopes": "all openid",
			"redirect_uris": f"raven.thecommit.company: {NATIVE_REDIRECT_URI}",
			"default_redirect_uri": "raven.thecommit.company:",
			"grant_type": "Authorization Code",
			"response_type": "Code",
		}
	)
	if HAS_AUTH_METHOD:
		client.token_endpoint_auth_method = "None"
	return client.insert(ignore_permissions=True)


def make_token(user, client, access_token):
	return frappe.get_doc(
		{
			"doctype": "OAuth Bearer Token",
			"client": client.name,
			"user": user,
			"scopes": "all openid",
			"access_token": access_token,
			"refresh_token": f"refresh-{access_token}",
			"expires_in": 3600,
			"expiration_time": add_to_date(now_datetime(), days=1),
			"status": "Active",
		}
	).insert(ignore_permissions=True)


def make_push_token(user, fcm_token):
	frappe.set_user(user)
	with patch.object(RavenPushToken, "after_insert"):
		doc = frappe.get_doc(
			{"doctype": "Raven Push Token", "fcm_token": fcm_token, "environment": "Mobile"}
		).insert()
	frappe.set_user("Administrator")
	return doc


def push_tokens(user):
	return set(frappe.get_all("Raven Push Token", {"user": user}, pluck="fcm_token"))


def status(token):
	return frappe.db.get_value("OAuth Bearer Token", token.name, "status")


@contextmanager
def logout_on_password_reset(value):
	# Patched rather than stored: saving the User clears the cached System Settings mid-call.
	original = frappe.get_system_settings
	with patch(
		"frappe.get_system_settings",
		side_effect=lambda key: value if key == "logout_on_password_reset" else original(key),
	):
		yield


class TestChangePassword(IntegrationTestCase):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		frappe.get_doc("User", USER).add_roles("Raven User")
		update_password(USER, OLD)

		self.previous_client = frappe.db.get_single_value("Raven Settings", "oauth_client")
		self.raven_client = make_client("Raven Account Test")
		self.other_client = make_client("Other Integration Test")
		frappe.db.set_single_value("Raven Settings", "oauth_client", self.raven_client.name)

		self.current = make_token(USER, self.raven_client, "tok-current")
		self.other_device = make_token(USER, self.raven_client, "tok-other")
		self.integration = make_token(USER, self.other_client, "tok-integration")
		self.other_user = make_token(OTHER_USER, self.raven_client, "tok-user1")

		make_push_token(USER, "fcm-this-device")
		make_push_token(USER, "fcm-lost-phone")
		make_push_token(OTHER_USER, "fcm-someone-else")

		# clear_sessions commits, which would outlive the rollback; on_trash calls the push service.
		self.patches = [
			patch("frappe.sessions.clear_sessions"),
			patch.object(RavenPushToken, "on_trash"),
		]
		for p in self.patches:
			p.start()

		frappe.set_user(USER)

	def tearDown(self):
		for p in self.patches:
			p.stop()
		frappe.set_user("Administrator")
		frappe.db.set_single_value("Raven Settings", "oauth_client", self.previous_client)
		frappe.db.rollback()
		super().tearDown()

	def test_sets_the_new_password_without_the_current_one(self):
		with logout_on_password_reset(0):
			change_password(NEW, 0)
		check_password(USER, NEW)

	def test_unticked_keeps_tokens_and_sessions(self):
		with logout_on_password_reset(0):
			change_password(NEW, 0, keep_push_token="fcm-this-device")
		self.assertFalse(frappe.sessions.clear_sessions.called)
		for token in (self.current, self.other_device, self.integration, self.other_user):
			self.assertEqual(status(token), "Active")
		self.assertEqual(push_tokens(USER), {"fcm-this-device", "fcm-lost-phone"})

	def test_ticked_revokes_own_raven_tokens_only(self):
		change_password(NEW, 1)
		self.assertEqual(status(self.other_device), "Revoked")
		# No bearer token on this request, so no device is kept.
		self.assertEqual(status(self.current), "Revoked")
		self.assertEqual(status(self.integration), "Active")
		self.assertEqual(status(self.other_user), "Active")

	def test_ticked_keeps_the_requesting_devices_token(self):
		with patch("raven.api.account.get_request_bearer_token", return_value="tok-current"):
			change_password(NEW, 1)
		self.assertEqual(status(self.current), "Active")
		self.assertEqual(status(self.other_device), "Revoked")

	def test_ticked_removes_other_push_tokens_but_this_devices(self):
		change_password(NEW, 1, keep_push_token="fcm-this-device")
		self.assertEqual(push_tokens(USER), {"fcm-this-device"})
		self.assertEqual(push_tokens(OTHER_USER), {"fcm-someone-else"})

	def test_site_forced_logout_applies_when_unticked(self):
		with logout_on_password_reset(1):
			change_password(NEW, 0)
		self.assertEqual(status(self.other_device), "Revoked")
		# Frappe's own path only reads the box, so the forced setting has to reach it too.
		self.assertTrue(frappe.sessions.clear_sessions.called)

	def test_no_oauth_client_is_a_no_op(self):
		frappe.db.set_single_value("Raven Settings", "oauth_client", None)
		change_password(NEW, 1)
		check_password(USER, NEW)
		self.assertEqual(status(self.other_device), "Active")

	def test_logging_out_other_devices_failing_still_changes_the_password(self):
		with (
			patch("raven.api.account.revoke_app_tokens", side_effect=Exception("db down")),
			patch("frappe.log_error") as log_error,
		):
			change_password(NEW, 1, keep_push_token="fcm-this-device")
		check_password(USER, NEW)
		log_error.assert_called()
		# The push step still ran after the token step failed.
		self.assertEqual(push_tokens(USER), {"fcm-this-device"})

	def test_boot_says_whether_password_login_is_on(self):
		original = frappe.get_system_settings
		for disabled, expected in ((0, 1), (1, 0)):
			bootinfo = frappe._dict()
			with patch(
				"frappe.get_system_settings",
				side_effect=lambda key, d=disabled: d if key == "disable_user_pass_login" else original(key),
			):
				boot_session(bootinfo)
			self.assertEqual(bootinfo.raven_password_login, expected)

	def test_boot_says_whether_the_site_forces_logout_on_password_change(self):
		for forced in (0, 1):
			with logout_on_password_reset(forced):
				bootinfo = frappe._dict()
				boot_session(bootinfo)
			self.assertEqual(bootinfo.raven_logout_on_password_reset, forced)

	def test_bearer_header_parsing(self):
		self.assertIsNone(get_request_bearer_token())  # no request bound

		cases = (("Bearer abc", "abc"), ("bearer abc", "abc"), ("token key:secret", None), (None, None))
		frappe.local.request = MagicMock()
		try:
			for header, expected in cases:
				with patch("frappe.get_request_header", return_value=header):
					self.assertEqual(get_request_bearer_token(), expected)
		finally:
			del frappe.local.request


class TestSendPasswordResetLink(IntegrationTestCase):
	"""A Raven admin emails a user a link to set a new password, as desk's Reset Password does."""

	ADMIN = "test@example.com"
	MEMBER = "test1@example.com"
	OUTSIDER = "test2@example.com"

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		frappe.get_doc("User", self.ADMIN).add_roles("Raven User", "Raven Admin")
		frappe.get_doc("User", self.MEMBER).add_roles("Raven User")
		self.mail = patch("frappe.core.doctype.user.user.User.password_reset_mail")
		self.sent = self.mail.start()

	def tearDown(self):
		self.mail.stop()
		frappe.set_user("Administrator")
		frappe.db.rollback()
		super().tearDown()

	def reset_key(self, user):
		return frappe.db.get_value("User", user, "reset_password_key")

	def test_raven_admin_emails_a_member_a_link(self):
		frappe.set_user(self.ADMIN)
		self.assertIsNone(send_password_reset_link(self.MEMBER))  # the link only goes by email
		self.assertTrue(self.reset_key(self.MEMBER))
		self.assertEqual(self.sent.call_count, 1)

	def test_member_cannot_send(self):
		frappe.set_user(self.MEMBER)
		with self.assertRaises(frappe.PermissionError):
			send_password_reset_link(self.ADMIN)
		self.sent.assert_not_called()

	def test_refuses_someone_not_in_raven(self):
		frappe.set_user(self.ADMIN)
		with self.assertRaises(frappe.ValidationError):
			send_password_reset_link(self.OUTSIDER)
		self.sent.assert_not_called()

	def test_refuses_a_disabled_user(self):
		frappe.db.set_value("User", self.MEMBER, "enabled", 0)
		frappe.set_user(self.ADMIN)
		with self.assertRaises(frappe.ValidationError):
			send_password_reset_link(self.MEMBER)
		self.sent.assert_not_called()

	def test_refuses_administrator(self):
		frappe.set_user(self.ADMIN)
		with self.assertRaises(frappe.ValidationError):
			send_password_reset_link("Administrator")
		self.sent.assert_not_called()
