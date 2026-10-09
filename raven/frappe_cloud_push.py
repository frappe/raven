import frappe
import requests
from redis.exceptions import ConnectionError as RedisConnectionError

from raven.raven_cloud_notifications import get_site_name

# Frappe Cloud puts the push relay URL in the common site config of every server it creates.
SERVER_URL_CONFIG_KEY = "raven_push_notification_server_url"
REGISTERED_HOST_KEY = "raven_cloud_registered_host"
ATTEMPTED_CACHE_KEY = "raven_frappe_cloud_push_attempted"


def is_on_frappe_cloud_push(settings) -> bool:
	"""Frappe Cloud gave this site a relay URL, and the owner did not choose another relay."""
	server_url = (frappe.conf.get(SERVER_URL_CONFIG_KEY) or "").rstrip("/")
	configured_url = (settings.push_notification_server_url or "").rstrip("/")
	return (
		bool(server_url)
		and settings.push_notification_service != "Frappe Cloud"
		and (not configured_url or configured_url == server_url)
	)


def has_recent_attempt() -> bool:
	"""An attempt for the current hostname ran within the hour. A renamed site tries at once."""
	return bool(frappe.cache.get_value(f"{ATTEMPTED_CACHE_KEY}:{get_site_name()}"))


def is_push_setup_pending(settings) -> bool:
	"""No keys or push settings yet, or the site has a new hostname, and no recent attempt."""
	if not is_on_frappe_cloud_push(settings) or has_recent_attempt():
		return False
	return (
		not settings.push_notification_api_key
		or not settings.config
		or not settings.vapid_public_key
		or frappe.db.get_default(REGISTERED_HOST_KEY) != get_site_name()
	)


def queue_push_setup(after_commit: bool = False) -> None:
	"""Runs in the background, so installs, setup and page loads do not wait."""
	if not frappe.conf.get(SERVER_URL_CONFIG_KEY):
		return

	try:
		frappe.enqueue(
			"raven.frappe_cloud_push.setup_push",
			queue="short",
			job_id="raven-frappe-cloud-push",
			deduplicate=True,
			enqueue_after_commit=after_commit,
		)
	except RedisConnectionError:
		# A later page load retries, so a queue outage must not fail the page.
		frappe.logger("raven").warning("Could not queue the Raven Cloud push setup", exc_info=True)


def queue_initial_push_setup(*args) -> None:
	"""Install and setup must commit their records before the worker reads them."""
	queue_push_setup(after_commit=True)


def retry_after_refusal() -> None:
	"""Raven Cloud refused the keys, for example after a rotation. Get them again, at most once an hour."""
	if is_on_frappe_cloud_push(frappe.get_single("Raven Settings")) and not has_recent_attempt():
		queue_push_setup()


def setup_push() -> None:
	"""Register the site's current hostname for its team. Save the team's keys and the push settings."""
	settings = frappe.get_single("Raven Settings")
	if not is_on_frappe_cloud_push(settings):
		return

	site_name = get_site_name()
	try:
		register_site(settings, site_name)
	finally:
		# Written last, because saving a default clears the cache.
		frappe.cache.set_value(f"{ATTEMPTED_CACHE_KEY}:{site_name}", 1, expires_in_sec=60 * 60)


def register_site(settings, site_name: str) -> None:
	"""Save the team's keys and the push settings, and send the device tokens for a new hostname."""
	server_url = frappe.conf.get(SERVER_URL_CONFIG_KEY).rstrip("/")
	registration = register_with_raven_cloud(server_url, site_name)
	settings.update(
		{
			"push_notification_service": "Raven",
			"push_notification_server_url": server_url,
			"push_notification_api_key": registration["api_key"],
			"push_notification_api_secret": registration["api_secret"],
			"config": registration["config"],
			"vapid_public_key": registration["vapid_public_key"],
		}
	)
	# A background job runs as whoever queued it, which may be any user of the site.
	settings.save(ignore_permissions=True)

	if frappe.db.get_default(REGISTERED_HOST_KEY) != site_name:
		from raven.raven_cloud_notifications import sync_users_tokens_to_raven_cloud

		# Raven Cloud keeps device tokens by hostname, so a new hostname sends them again.
		sync_users_tokens_to_raven_cloud()
		frappe.db.set_default(REGISTERED_HOST_KEY, site_name)


def register_with_raven_cloud(server_url: str, site_name: str) -> dict:
	"""Exchange a Frappe Cloud team token for the team's keys and the push settings."""
	from frappe.integrations.frappe_providers.cloud_settings import PilotClient

	client = PilotClient()
	identity = client.post(
		client.site_path("central/central.api.pilot.get_team_identity_token"), {"audience": server_url}
	)
	response = requests.post(
		f"{server_url}/api/method/raven_cloud.api.frappe_cloud.exchange_frappe_cloud_token",
		json={"token": identity["token"], "site_name": site_name},
		timeout=15,
		allow_redirects=False,
	)
	response.raise_for_status()
	return response.json()["message"]
