from unittest.mock import MagicMock, patch

import frappe
import requests
from frappe.tests import IntegrationTestCase

from raven.api.notification import get_push_notification_config
from raven.frappe_cloud_push import (
    ATTEMPTED_CACHE_KEY,
    REGISTERED_HOST_KEY,
    SERVER_URL_CONFIG_KEY,
    get_keys_for_team,
    is_push_setup_pending,
    queue_initial_push_setup,
    queue_push_setup,
    setup_push,
)

SERVER_URL = "https://cloud.example.test"
KEYS = {"api_key": "team-key", "api_secret": "team-secret"}


class TestSetupPush(IntegrationTestCase):
    """On Frappe Cloud, Raven sets push up with the team's Raven Cloud keys by itself."""

    def setUp(self):
        super().setUp()
        frappe.set_user("Administrator")
        self.addCleanup(frappe.db.rollback)
        self.addCleanup(frappe.set_user, "Administrator")
        self.addCleanup(frappe.cache.delete_value, ATTEMPTED_CACHE_KEY)
        frappe.cache.delete_value(ATTEMPTED_CACHE_KEY)
        frappe.db.set_default(REGISTERED_HOST_KEY, None)
        settings = frappe.get_single("Raven Settings")
        settings.push_notification_service = "Raven"
        settings.push_notification_server_url = None
        settings.push_notification_api_key = None
        settings.config = None
        settings.vapid_public_key = None
        settings.flags.ignore_validate = True
        settings.save()

        self.get_keys = self.enterContext(
            patch("raven.frappe_cloud_push.get_keys_for_team", return_value=dict(KEYS))
        )
        self.register = self.enterContext(
            patch("raven.api.notification.register_site", side_effect=self.record_browser_config)
        )
        self.sync_tokens = self.enterContext(
            patch("raven.raven_cloud_notifications.sync_users_tokens_to_raven_cloud")
        )
        self.site_name = self.enterContext(
            patch("raven.frappe_cloud_push.get_site_name", return_value="acme.example.test")
        )
        self.enterContext(patch.dict(frappe.conf, {SERVER_URL_CONFIG_KEY: SERVER_URL}))

    def record_browser_config(self):
        frappe.db.set_single_value(
            "Raven Settings", {"config": '{"projectId":"test"}', "vapid_public_key": "public"}
        )

    def test_missing_browser_configuration_re_registers_without_replacing_keys(self):
        setup_push()
        frappe.db.set_single_value("Raven Settings", "vapid_public_key", None)
        frappe.cache.delete_value(ATTEMPTED_CACHE_KEY)
        self.assertTrue(is_push_setup_pending(frappe.get_single("Raven Settings")))
        setup_push()
        self.get_keys.assert_called_once()
        self.assertEqual(self.register.call_count, 2)
        self.assertEqual(frappe.db.get_single_value("Raven Settings", "vapid_public_key"), "public")

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
        self.assertEqual(self.register.call_count, 2)
        self.sync_tokens.assert_called_once()

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

    def test_a_custom_relay_is_not_replaced_or_refreshed(self):
        frappe.db.set_single_value("Raven Settings", "push_notification_server_url", "https://custom.test")
        setup_push(refresh_keys=True)
        self.get_keys.assert_not_called()
        self.register.assert_not_called()

    def test_background_setup_restores_the_request_user(self):
        frappe.set_user("Guest")
        setup_push()
        self.assertEqual(frappe.session.user, "Guest")
        self.register.assert_called_once()

    def test_a_failed_registration_is_not_recorded_as_registered(self):
        self.register.side_effect = requests.ConnectionError("Unavailable")
        with self.assertRaises(requests.ConnectionError):
            setup_push()
        self.assertFalse(frappe.db.get_default(REGISTERED_HOST_KEY))
        self.assertFalse(is_push_setup_pending(frappe.get_single("Raven Settings")))
        frappe.cache.delete_value(ATTEMPTED_CACHE_KEY)
        self.assertTrue(is_push_setup_pending(frappe.get_single("Raven Settings")))

    def test_setup_is_queued_only_after_the_transaction_commits(self):
        with patch("raven.frappe_cloud_push.frappe.enqueue") as enqueue:
            queue_initial_push_setup()
        self.assertTrue(enqueue.call_args.kwargs["enqueue_after_commit"])
        self.assertTrue(enqueue.call_args.kwargs["deduplicate"])

    def test_a_page_load_retry_does_not_wait_for_a_get_request_to_commit(self):
        with patch("raven.frappe_cloud_push.frappe.enqueue") as enqueue:
            queue_push_setup()
        self.assertFalse(enqueue.call_args.kwargs["enqueue_after_commit"])

    def test_setup_restores_the_request_user_after_a_failure(self):
        self.get_keys.side_effect = requests.ConnectionError("Unavailable")
        frappe.set_user("Guest")
        with self.assertRaises(requests.ConnectionError):
            setup_push()
        self.assertEqual(frappe.session.user, "Guest")

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
            allow_redirects=False,
        )
