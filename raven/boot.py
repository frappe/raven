from urllib.parse import urlsplit

import frappe
from frappe.utils.safe_exec import is_safe_exec_enabled

from raven.api.setup import is_setup_admin
from raven.frappe_cloud_push import (
	is_on_frappe_cloud_push,
	is_push_setup_pending,
	queue_push_setup,
)

RAVEN_USER_BOOT_FIELDS = (
	"chat_style",
	"time_format",
	"hide_read_receipts",
	"quiet_hours_nudge",
	"onboarded",
)


def boot_session(bootinfo):

	# Boot runs on every page load, also when a failed migrate left the schema behind the code.
	# as_dict holds only fields the schema has; _dict reads any other field as None.
	raven_settings = frappe._dict(frappe.get_single("Raven Settings").as_dict())

	# Scheduled messages run as Server Scripts. The settings panel warns when those are off.
	bootinfo.server_script_enabled = is_safe_exec_enabled()

	# Opens the first-admin setup flow in the web app.
	# A site that predates the field is set up (mark_existing_sites_set_up).
	setup_completed = raven_settings.get("setup_completed", 1)
	bootinfo.raven_setup_pending = 1 if not setup_completed and is_setup_admin() else 0

	if raven_settings.frappe_meet_hosted_urls:
		bootinfo.frappe_meet_hosted_urls = raven_settings.frappe_meet_hosted_urls

	# Domain-wide blocklist rows only: the client needs them to suppress
	# provider EMBEDS (a YouTube facade renders without asking the
	# server). Exact-URL rows are enforced purely server-side — cards
	# only render when get_previews returns data.
	blocked_domains = []
	for blocked in raven_settings.blocked_links or []:
		entry = (blocked.link or "").strip()
		if not entry or blocked.match_exact:
			continue
		hostname = urlsplit(entry if "://" in entry else f"https://{entry}").hostname
		if hostname:
			blocked_domains.append(hostname.lower())
	if blocked_domains:
		bootinfo.link_preview_blocked_domains = blocked_domains

	tenor_api_key = raven_settings.tenor_api_key

	document_link_override = frappe.get_hooks("raven_document_link_override")

	user_settings = _get_user_boot_settings()

	if document_link_override and len(document_link_override) > 0:
		bootinfo.raven_document_link_override = True

	# Only a key the site set for itself: Raven ships no Tenor key of its own.
	if tenor_api_key:
		bootinfo.tenor_api_key = tenor_api_key

	bootinfo.chat_style = user_settings.chat_style or "Simple"
	bootinfo.raven_time_format = user_settings.time_format or "12-hour"
	bootinfo.raven_hide_read_receipts = 1 if user_settings.hide_read_receipts else 0
	bootinfo.raven_quiet_hours_nudge = user_settings.quiet_hours_nudge or "Nudge"
	bootinfo.raven_onboarded = 1 if user_settings.onboarded else 0

	# Quiet hours: outside these working hours the composer nudges toward (or
	# defaults to, per the user's preference above) silent sends. Only shipped
	# when the org enabled and configured them — no boot key = feature off.
	# Times are evaluated against the SITE's timezone (already in standard
	# boot as time_zone.system), so every client measures the same org clock
	# regardless of device timezone.
	if (
		raven_settings.enable_quiet_hours
		and raven_settings.working_hours_start
		and raven_settings.working_hours_end
	):
		bootinfo.quiet_hours = {
			# Time fields read back as timedelta — str() gives "HH:MM:SS".
			"working_hours_start": str(raven_settings.working_hours_start),
			"working_hours_end": str(raven_settings.working_hours_end),
		}

	# On Frappe Cloud, retries a failed push setup and registers a renamed site again.
	if is_push_setup_pending(raven_settings):
		queue_push_setup()
	bootinfo.raven_cloud_push_setup_pending = is_on_frappe_cloud_push(raven_settings) and (
		not raven_settings.config or not raven_settings.vapid_public_key
	)

	bootinfo.push_notification_service = (
		raven_settings.push_notification_service
		if raven_settings.push_notification_service
		else "Frappe Cloud"
	)

	if raven_settings.push_notification_service == "Raven":
		bootinfo.vapid_public_key = raven_settings.vapid_public_key
		bootinfo.firebase_client_config = raven_settings.config


def _get_user_boot_settings() -> frappe._dict:
	# No Raven User: nothing to set up in the web app.
	# A user that predates the onboarded column is onboarded (mark_existing_users_onboarded).
	settings = frappe._dict(onboarded=1)

	user = frappe.session.user
	if not user or user == "Guest" or not frappe.db.exists("Raven User", user):
		return settings

	# Selecting a column a failed migrate didn't add raises, so ask only for known ones.
	meta = frappe.get_meta("Raven User")
	fields = [field for field in RAVEN_USER_BOOT_FIELDS if meta.has_field(field)]
	settings.update(frappe.db.get_value("Raven User", user, fields, as_dict=True) or {})
	return settings
