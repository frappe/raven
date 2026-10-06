import frappe
import requests

from raven.raven_cloud_notifications import get_site_name

# Frappe Cloud puts the push relay URL in the common site config of every server it creates.
SERVER_URL_CONFIG_KEY = "raven_push_notification_server_url"
REGISTERED_HOST_KEY = "raven_cloud_registered_host"
ATTEMPTED_CACHE_KEY = "raven_frappe_cloud_push_attempted"


def is_on_frappe_cloud_push(settings) -> bool:
	"""Frappe Cloud gave this site a relay URL, and the owner did not choose Frappe's own relay."""
	return (
		bool(frappe.conf.get(SERVER_URL_CONFIG_KEY))
		and settings.push_notification_service != "Frappe Cloud"
	)


def is_push_setup_pending(settings) -> bool:
	"""No keys yet, or registered under another hostname, and no attempt within the hour."""
	if not is_on_frappe_cloud_push(settings) or frappe.cache.get_value(ATTEMPTED_CACHE_KEY):
		return False
	return (
		not settings.push_notification_api_key
		or frappe.db.get_default(REGISTERED_HOST_KEY) != get_site_name()
	)


def queue_push_setup(*args, refresh_keys: bool = False) -> None:
	"""Runs in the background, so installs, setup and page loads do not wait."""
	frappe.enqueue(
		"raven.frappe_cloud_push.setup_push",
		refresh_keys=refresh_keys,
		queue="short",
		job_id="raven-frappe-cloud-push",
		deduplicate=True,
	)


def setup_push(refresh_keys: bool = False) -> None:
	"""Get the team's Raven Cloud keys, then register the site's current hostname.
	`refresh_keys` replaces keys Raven Cloud refused."""
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
		# A background job runs as whoever queued it, which may be any user of the site.
		settings.save(ignore_permissions=True)

	registered_host = frappe.db.get_default(REGISTERED_HOST_KEY)
	if registered_host == get_site_name():
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
	)
	response.raise_for_status()
	return response.json()["message"]
