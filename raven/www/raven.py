import json
import re

import frappe
import frappe.sessions
from frappe import _
from frappe.utils.telemetry import capture

no_cache = 1

SCRIPT_TAG_PATTERN = re.compile(r"\<script[^<]*\</script\>")
CLOSING_SCRIPT_TAG_PATTERN = re.compile(r"</script\>")


def get_context(context):
	csrf_token = frappe.sessions.get_csrf_token()
	# Manually commit the CSRF token here
	frappe.db.commit()  # nosemgrep

	if frappe.session.user == "Guest":
		boot = frappe.website.utils.get_boot_data()
	else:
		try:
			boot = frappe.sessions.get()
		except Exception as e:
			raise frappe.SessionBootFailed from e

	boot_json = frappe.as_json(boot, indent=None, separators=(",", ":"))
	boot_json = SCRIPT_TAG_PATTERN.sub("", boot_json)

	boot_json = CLOSING_SCRIPT_TAG_PATTERN.sub("", boot_json)
	boot_json = json.dumps(boot_json)

	context.update(
		{"build_version": frappe.utils.get_build_version(), "boot": boot_json, "csrf_token": csrf_token}
	)

	app_name = frappe.get_website_settings("app_name") or frappe.get_system_settings("app_name")

	if app_name and app_name != "Frappe":
		context["app_name"] = app_name + " | " + "Raven"

	else:
		context["app_name"] = "Raven"

	use_website_favicon = frappe.db.get_single_value("Raven Settings", "use_website_favicon")

	favicon = None
	if use_website_favicon:
		favicon = frappe.get_website_settings("favicon")

	# TODO: Update all favicons here and delete all v2 icons later
	context["icon_96"] = favicon or "/assets/raven/icons/icon-96x96.png"
	context["apple_touch_icon"] = favicon or "/assets/raven/icons/icon-192x192.png"
	context["mask_icon"] = favicon or "/assets/raven/raven_logo.svg"
	context["favicon_svg"] = favicon or "/assets/raven/raven_logo.svg"
	context["favicon_ico"] = favicon or "/assets/raven/favicon.ico"
	context["sitename"] = boot.get("sitename")

	if frappe.session.user != "Guest":
		capture("active_site", "raven")

		boot["push_relay_server_url"] = frappe.conf.get("push_relay_server_url")

		# add server_script_enabled in boot
		if "server_script_enabled" in frappe.conf:
			enabled = frappe.conf.server_script_enabled
		else:
			enabled = True
		boot["server_script_enabled"] = enabled
	else:
		boot["server_script_enabled"] = False
		boot["push_relay_server_url"] = None

	return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
	if not frappe.conf.developer_mode:
		frappe.throw(_("This method is only meant for developer mode"))
	return json.loads(get_boot())


def get_boot():
	try:
		boot = frappe.sessions.get()
	except Exception as e:
		raise frappe.SessionBootFailed from e

	boot["push_relay_server_url"] = frappe.conf.get("push_relay_server_url")
	boot_json = frappe.as_json(boot, indent=None, separators=(",", ":"))
	boot_json = SCRIPT_TAG_PATTERN.sub("", boot_json)

	boot_json = CLOSING_SCRIPT_TAG_PATTERN.sub("", boot_json)
	boot_json = json.dumps(boot_json)

	return boot_json
