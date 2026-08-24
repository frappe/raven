from urllib.parse import urlsplit

import frappe


def boot_session(bootinfo):

	raven_settings = frappe.get_single("Raven Settings")

	bootinfo.show_raven_chat_on_desk = raven_settings.show_raven_on_desk

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

	if (
		frappe.session.user
		and frappe.session.user != "Guest"
		and frappe.db.exists("Raven User", frappe.session.user)
	):
		chat_style, time_format, hide_read_receipts, quiet_hours_nudge = frappe.db.get_value(
			"Raven User",
			frappe.session.user,
			["chat_style", "time_format", "hide_read_receipts", "quiet_hours_nudge"],
		)
	else:
		chat_style = "Simple"
		time_format = "12-hour"
		hide_read_receipts = 0
		quiet_hours_nudge = "Nudge"

	if document_link_override and len(document_link_override) > 0:
		bootinfo.raven_document_link_override = True

	if tenor_api_key:
		bootinfo.tenor_api_key = tenor_api_key
	else:
		bootinfo.tenor_api_key = "AIzaSyAWkuhLwbMxOlvn_o5fxBke1grUZ7F3ma4"  # should we remove this?

	bootinfo.chat_style = chat_style if chat_style else "Simple"
	bootinfo.raven_time_format = time_format if time_format else "12-hour"
	bootinfo.raven_hide_read_receipts = 1 if hide_read_receipts else 0
	bootinfo.raven_quiet_hours_nudge = quiet_hours_nudge if quiet_hours_nudge else "Nudge"

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

	bootinfo.push_notification_service = (
		raven_settings.push_notification_service
		if raven_settings.push_notification_service
		else "Frappe Cloud"
	)

	if raven_settings.push_notification_service == "Raven":
		bootinfo.vapid_public_key = raven_settings.vapid_public_key
		bootinfo.firebase_client_config = raven_settings.config
