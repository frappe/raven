from unittest.mock import MagicMock, patch

import frappe
import requests
from frappe.tests import IntegrationTestCase
from redis.exceptions import ConnectionError as RedisConnectionError

from raven.api.notification import get_push_notification_config, register_site_on_raven_cloud
from raven.frappe_cloud_push import (
	ATTEMPTED_CACHE_KEY,
	REGISTERED_HOST_KEY,
	SERVER_URL_CONFIG_KEY,
	is_push_setup_pending,
	queue_initial_push_setup,
	queue_push_setup,
	register_with_raven_cloud,
	retry_after_refusal,
	setup_push,
)

SERVER_URL = "https://cloud.example.test"
SITE = "acme.example.test"
RENAMED_SITE = "renamed.example.test"
REGISTRATION = {
	"api_key": "team-key",
	"api_secret": "team-secret",
	"config": '{"projectId":"test"}',
	"vapid_public_key": "public",
}


def clear_attempts():
	for site in (SITE, RENAMED_SITE):
		frappe.cache.delete_value(f"{ATTEMPTED_CACHE_KEY}:{site}")


class TestSetupPush(IntegrationTestCase):
	"""On Frappe Cloud, Raven registers itself with Raven Cloud under its team."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.addCleanup(frappe.db.rollback)
		self.addCleanup(frappe.set_user, "Administrator")
		self.addCleanup(clear_attempts)
		clear_attempts()
		frappe.db.set_default(REGISTERED_HOST_KEY, None)
		settings = frappe.get_single("Raven Settings")
		settings.push_notification_service = "Raven"
		settings.push_notification_server_url = None
		settings.push_notification_api_key = None
		settings.config = None
		settings.vapid_public_key = None
		settings.flags.ignore_validate = True
		settings.save()

		self.register = self.enterContext(
			patch("raven.frappe_cloud_push.register_with_raven_cloud", return_value=dict(REGISTRATION))
		)
		self.sync_tokens = self.enterContext(
			patch("raven.raven_cloud_notifications.sync_users_tokens_to_raven_cloud")
		)
		self.site_name = self.enterContext(
			patch("raven.frappe_cloud_push.get_site_name", return_value=SITE)
		)
		self.enterContext(patch.dict(frappe.conf, {SERVER_URL_CONFIG_KEY: SERVER_URL}))

	def is_pending(self) -> bool:
		return is_push_setup_pending(frappe.get_single("Raven Settings"))

	def test_a_new_site_saves_the_team_keys_and_push_settings(self):
		setup_push()

		settings = frappe.get_single("Raven Settings")
		self.register.assert_called_once_with(SERVER_URL, SITE)
		self.assertEqual(settings.push_notification_server_url, SERVER_URL)
		self.assertEqual(settings.get_password("push_notification_api_secret"), "team-secret")
		self.assertEqual(settings.vapid_public_key, "public")
		self.assertEqual(frappe.db.get_default(REGISTERED_HOST_KEY), SITE)
		self.sync_tokens.assert_called_once()

	def test_a_set_up_site_is_not_pending(self):
		setup_push()
		clear_attempts()

		self.assertFalse(self.is_pending())

	def test_a_renamed_site_registers_at_once_and_sends_its_tokens_again(self):
		setup_push()
		self.site_name.return_value = RENAMED_SITE

		self.assertTrue(self.is_pending())
		setup_push()

		self.register.assert_called_with(SERVER_URL, RENAMED_SITE)
		self.assertEqual(self.sync_tokens.call_count, 2)

	def test_refused_keys_are_fetched_again_at_most_once_an_hour(self):
		setup_push()
		with patch("raven.frappe_cloud_push.frappe.enqueue") as enqueue:
			retry_after_refusal()
			enqueue.assert_not_called()

			clear_attempts()
			retry_after_refusal()
			enqueue.assert_called_once()

		self.register.return_value = dict(REGISTRATION, api_secret="rotated-secret")
		setup_push()
		settings = frappe.get_single("Raven Settings")
		self.assertEqual(settings.get_password("push_notification_api_secret"), "rotated-secret")
		self.sync_tokens.assert_called_once()

	def test_a_failed_registration_is_retried_after_an_hour(self):
		self.register.side_effect = requests.ConnectionError("Unavailable")
		with self.assertRaises(requests.ConnectionError):
			setup_push()

		self.assertFalse(frappe.db.get_default(REGISTERED_HOST_KEY))
		self.assertFalse(self.is_pending())
		clear_attempts()
		self.assertTrue(self.is_pending())

	def test_sites_without_a_relay_url_and_the_frappe_cloud_service_are_left_alone(self):
		with (
			patch.dict(frappe.conf, {SERVER_URL_CONFIG_KEY: None}),
			patch("raven.frappe_cloud_push.frappe.enqueue") as enqueue,
		):
			queue_initial_push_setup()
			setup_push()
		enqueue.assert_not_called()

		frappe.db.set_single_value("Raven Settings", "push_notification_service", "Frappe Cloud")
		setup_push()
		self.register.assert_not_called()

	def test_a_custom_relay_is_left_alone(self):
		frappe.db.set_single_value(
			"Raven Settings", "push_notification_server_url", "https://custom.test"
		)
		setup_push()
		self.register.assert_not_called()

	def test_setup_saves_the_settings_whoever_loaded_the_page(self):
		frappe.set_user("Guest")
		setup_push()
		self.assertEqual(frappe.get_single("Raven Settings").push_notification_api_key, "team-key")

	def test_setup_is_queued_only_after_the_transaction_commits(self):
		with patch("raven.frappe_cloud_push.frappe.enqueue") as enqueue:
			queue_initial_push_setup()
		self.assertTrue(enqueue.call_args.kwargs["enqueue_after_commit"])
		self.assertTrue(enqueue.call_args.kwargs["deduplicate"])

	def test_a_page_load_retry_does_not_wait_for_a_get_request_to_commit(self):
		with patch("raven.frappe_cloud_push.frappe.enqueue") as enqueue:
			queue_push_setup()
		self.assertFalse(enqueue.call_args.kwargs["enqueue_after_commit"])

	def test_a_queue_outage_does_not_fail_the_page(self):
		with patch("raven.frappe_cloud_push.frappe.enqueue", side_effect=RedisConnectionError):
			queue_push_setup()

	def test_a_system_manager_retries_a_failed_setup_at_once(self):
		self.register.side_effect = requests.ConnectionError("Unavailable")
		with self.assertRaises(requests.ConnectionError):
			setup_push()
		self.register.side_effect = None

		register_site_on_raven_cloud()

		self.assertEqual(self.register.call_count, 2)
		self.assertEqual(frappe.get_single("Raven Settings").push_notification_api_key, "team-key")

	def test_the_browser_configuration_contains_no_relay_credentials(self):
		frappe.db.set_single_value(
			"Raven Settings", {"config": '{"projectId":"test"}', "vapid_public_key": "public"}
		)
		self.assertEqual(
			get_push_notification_config(),
			{"firebase_client_config": '{"projectId":"test"}', "vapid_public_key": "public"},
		)

	def test_guests_cannot_read_the_browser_configuration(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			frappe.is_whitelisted(get_push_notification_config)


class TestRegisterWithRavenCloud(IntegrationTestCase):
	def test_the_token_and_hostname_go_to_the_relay_the_token_is_for(self):
		client = MagicMock()
		client.post.return_value = {"token": "signed-token"}
		response = MagicMock()
		response.json.return_value = {"message": REGISTRATION}

		with (
			patch("frappe.integrations.frappe_providers.cloud_settings.PilotClient", return_value=client),
			patch("raven.frappe_cloud_push.requests.post", return_value=response) as post,
		):
			registration = register_with_raven_cloud(SERVER_URL, SITE)

		self.assertEqual(registration, REGISTRATION)
		self.assertEqual(client.post.call_args.args[1], {"audience": SERVER_URL})
		post.assert_called_once_with(
			f"{SERVER_URL}/api/method/raven_cloud.api.frappe_cloud.exchange_frappe_cloud_token",
			json={"token": "signed-token", "site_name": SITE},
			timeout=15,
			allow_redirects=False,
		)
