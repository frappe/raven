import frappe
import requests

from raven.raven_cloud_notifications import get_site_name

# Frappe Cloud puts the push relay URL in the common site config of every server it creates.
SERVER_URL_CONFIG_KEY = "raven_push_notification_server_url"
REGISTERED_HOST_KEY = "raven_cloud_registered_host"
ATTEMPTED_CACHE_KEY = "raven_frappe_cloud_push_attempted"


def is_on_frappe_cloud_push(settings) -> bool:
    """Frappe Cloud gave this site a relay URL, and the owner did not choose Frappe's own relay."""
    server_url = (frappe.conf.get(SERVER_URL_CONFIG_KEY) or "").rstrip("/")
    configured_url = (settings.push_notification_server_url or "").rstrip("/")
    return (
        bool(server_url)
        and settings.push_notification_service != "Frappe Cloud"
        and (not configured_url or configured_url == server_url)
    )


def is_push_setup_pending(settings) -> bool:
    """No keys yet, or registered under another hostname, and no attempt within the hour."""
    if not is_on_frappe_cloud_push(settings) or frappe.cache.get_value(ATTEMPTED_CACHE_KEY):
        return False
    return (
        not settings.push_notification_api_key
        or not settings.config
        or not settings.vapid_public_key
        or frappe.db.get_default(REGISTERED_HOST_KEY) != get_site_name()
    )


def queue_push_setup(*args, refresh_keys: bool = False, after_commit: bool = False) -> None:
    """Runs in the background, so installs, setup and page loads do not wait."""
    frappe.enqueue(
        "raven.frappe_cloud_push.setup_push",
        refresh_keys=refresh_keys,
        queue="short",
        job_id="raven-frappe-cloud-push",
        deduplicate=True,
        enqueue_after_commit=after_commit,
    )


def queue_initial_push_setup(*args) -> None:
    """Install and setup must commit their records before the worker reads them."""
    queue_push_setup(after_commit=True)


def setup_push(refresh_keys: bool = False) -> None:
    """Get the team's Raven Cloud keys, then register the site's current hostname.
    `refresh_keys` replaces keys Raven Cloud refused."""
    user = frappe.session.user
    # This private background integration configures the site, independent of who loaded Raven.
    # nosemgrep: frappe-setuser -- private, fixed-site system job; no caller-controlled resource or identity.
    frappe.set_user("Administrator")
    try:
        _setup_push(refresh_keys)
    finally:
        # nosemgrep: frappe-setuser -- restore the original identity even when setup fails.
        frappe.set_user(user)


def _setup_push(refresh_keys: bool) -> None:
    settings = frappe.get_single("Raven Settings")
    if not is_on_frappe_cloud_push(settings):
        return

    # Page loads retry a failed attempt, at most once an hour.
    frappe.cache.set_value(ATTEMPTED_CACHE_KEY, 1, expires_in_sec=60 * 60)
    if refresh_keys or not settings.push_notification_api_key:
        server_url = frappe.conf.get(SERVER_URL_CONFIG_KEY).rstrip("/")
        keys = get_keys_for_team(server_url)
        settings.push_notification_service = "Raven"
        settings.push_notification_server_url = server_url
        settings.push_notification_api_key = keys["api_key"]
        settings.push_notification_api_secret = keys["api_secret"]
        settings.save()

    registered_host = frappe.db.get_default(REGISTERED_HOST_KEY)
    if (
        registered_host == get_site_name()
        and not refresh_keys
        and settings.config
        and settings.vapid_public_key
    ):
        return

    from raven.api.notification import register_site
    from raven.raven_cloud_notifications import sync_users_tokens_to_raven_cloud

    register_site()
    if registered_host:
        # Raven Cloud keeps tokens by hostname, so a renamed site sends them again.
        sync_users_tokens_to_raven_cloud()
    frappe.db.set_default(REGISTERED_HOST_KEY, get_site_name())


def get_keys_for_team(server_url: str) -> dict:
    """Exchange a Frappe Cloud team token for the team's keys at the relay."""
    from frappe.integrations.frappe_providers.cloud_settings import PilotClient

    client = PilotClient()
    identity = client.post(
        client.site_path("central/central.api.pilot.get_team_identity_token"), {"audience": server_url}
    )
    response = requests.post(
        f"{server_url}/api/method/raven_cloud.api.frappe_cloud.exchange_frappe_cloud_token",
        json={"token": identity["token"]},
        timeout=15,
        allow_redirects=False,
    )
    response.raise_for_status()
    return response.json()["message"]
