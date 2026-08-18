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
		chat_style, time_format, hide_read_receipts = frappe.db.get_value(
			"Raven User", frappe.session.user, ["chat_style", "time_format", "hide_read_receipts"]
		)
	else:
		chat_style = "Simple"
		time_format = "12-hour"
		hide_read_receipts = 0

	if document_link_override and len(document_link_override) > 0:
		bootinfo.raven_document_link_override = True

	if tenor_api_key:
		bootinfo.tenor_api_key = tenor_api_key
	else:
		bootinfo.tenor_api_key = "AIzaSyAWkuhLwbMxOlvn_o5fxBke1grUZ7F3ma4"  # should we remove this?

	bootinfo.chat_style = chat_style if chat_style else "Simple"
	bootinfo.raven_time_format = time_format if time_format else "12-hour"
	bootinfo.raven_hide_read_receipts = 1 if hide_read_receipts else 0

	bootinfo.push_notification_service = (
		raven_settings.push_notification_service
		if raven_settings.push_notification_service
		else "Frappe Cloud"
	)

	if raven_settings.push_notification_service == "Raven":
		bootinfo.vapid_public_key = raven_settings.vapid_public_key
		bootinfo.firebase_client_config = raven_settings.config
