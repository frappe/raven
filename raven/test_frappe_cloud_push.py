from unittest.mock import MagicMock, patch

import frappe
from frappe.tests import IntegrationTestCase

from raven.frappe_cloud_push import (
	ATTEMPTED_CACHE_KEY,
	REGISTERED_HOST_KEY,
	SERVER_URL_CONFIG_KEY,
	get_keys_for_team,
	is_push_setup_pending,
	setup_push,
)

SERVER_URL = "https://cloud.example.test"
KEYS = {"api_key": "team-key", "api_secret": "team-secret"}


class TestSetupPush(IntegrationTestCase):
	"""On Frappe Cloud, Raven sets push up with the team's Raven Cloud keys by itself."""

	def setUp(self):
		super().setUp()
		self.addCleanup(frappe.db.rollback)
		frappe.cache.delete_value(ATTEMPTED_CACHE_KEY)
		frappe.db.set_default(REGISTERED_HOST_KEY, None)
		settings = frappe.get_single("Raven Settings")
		settings.push_notification_service = "Raven"
		settings.push_notification_server_url = None
		settings.push_notification_api_key = None
		settings.flags.ignore_validate = True
		settings.save(ignore_permissions=True)

		self.get_keys = self.enterContext(
			patch("raven.frappe_cloud_push.get_keys_for_team", return_value=dict(KEYS))
		)
		self.register = self.enterContext(patch("raven.api.notification.register_site"))
		self.sync_tokens = self.enterContext(
			patch("raven.raven_cloud_notifications.sync_users_tokens_to_raven_cloud")
		)
		self.site_name = self.enterContext(
			patch("raven.frappe_cloud_push.get_site_name", return_value="acme.example.test")
		)
		self.enterContext(patch.dict(frappe.conf, {SERVER_URL_CONFIG_KEY: SERVER_URL}))

	def test_a_new_site_gets_the_team_keys_and_registers(self):
		setup_push()

		settings = frappe.get_single("Raven Settings")
		self.get_keys.assert_called_once_with(SERVER_URL)
		self.assertEqual(settings.push_notification_server_url, SERVER_URL)
		self.assertEqual(settings.get_password("push_notification_api_secret"), "team-secret")
		self.register.assert_called_once()
		self.sync_tokens.assert_not_called()

	def test_a_set_up_site_does_nothing(self):
		setup_push()
		setup_push()

		self.get_keys.assert_called_once()
		self.register.assert_called_once()

	def test_a_renamed_site_registers_its_new_hostname_with_its_tokens(self):
		setup_push()
		self.site_name.return_value = "renamed.example.test"
		frappe.cache.delete_value(ATTEMPTED_CACHE_KEY)

		self.assertTrue(is_push_setup_pending(frappe.get_single("Raven Settings")))
		setup_push()

		self.get_keys.assert_called_once()
		self.assertEqual(self.register.call_count, 2)
		self.sync_tokens.assert_called_once()

	def test_refused_keys_are_replaced_with_the_current_ones(self):
		setup_push()
		self.get_keys.return_value = dict(KEYS, api_secret="rotated-secret")

		setup_push(refresh_keys=True)

		settings = frappe.get_single("Raven Settings")
		self.assertEqual(settings.get_password("push_notification_api_secret"), "rotated-secret")

	def test_keys_an_owner_entered_are_kept(self):
		frappe.db.set_single_value("Raven Settings", "push_notification_api_key", "owner-key")

		setup_push()

		self.get_keys.assert_not_called()

	def test_sites_without_a_relay_url_and_the_frappe_cloud_service_are_left_alone(self):
		with patch.dict(frappe.conf, {SERVER_URL_CONFIG_KEY: None}):
			setup_push(refresh_keys=True)
		frappe.db.set_single_value("Raven Settings", "push_notification_service", "Frappe Cloud")
		setup_push(refresh_keys=True)

		self.get_keys.assert_not_called()
		self.register.assert_not_called()


class TestGetKeysForTeam(IntegrationTestCase):
	def test_the_token_is_addressed_to_the_push_relay_it_is_exchanged_at(self):
		client = MagicMock()
		client.post.return_value = {"token": "signed-token"}
		response = MagicMock()
		response.json.return_value = {"message": KEYS}

		with (
			patch("frappe.integrations.frappe_providers.cloud_settings.PilotClient", return_value=client),
			patch("raven.frappe_cloud_push.requests.post", return_value=response) as post,
		):
			keys = get_keys_for_team(SERVER_URL)

		self.assertEqual(keys, KEYS)
		self.assertEqual(client.post.call_args.args[1], {"audience": SERVER_URL})
		post.assert_called_once_with(
			f"{SERVER_URL}/api/method/raven_cloud.api.frappe_cloud.exchange_frappe_cloud_token",
			json={"token": "signed-token"},
			timeout=15,
		)
