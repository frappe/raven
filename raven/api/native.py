import frappe
import frappe.sessions

# Origins the bundled app runs from: WKWebView on iOS, the Android WebView.
APP_ORIGINS = ("capacitor://localhost", "https://localhost")
# Sent by the app on every request. It marks the request as the app's. It is not a security
# check: a page at https://localhost could add the same header, and its preflight would be
# answered by the same rule. The origin allowlist is the real boundary, and those origins only
# exist on the user's own device.
APP_HEADER = "X-Raven-App"
# Features the app checks on every launch. A list so later features add entries.
RAVEN_FEATURES = ["location_messages"]


@frappe.whitelist()
def boot():
	"""The session boot the Jinja page inlines, for a page that is not served by the site."""
	if frappe.session.user == "Guest":
		raise frappe.PermissionError
	# Desk's boot runs every app's hooks and takes seconds to rebuild after a logout; use it only when cached.
	data = frappe.sessions.get() if frappe.cache.hget("bootinfo", frappe.session.user) else app_boot()
	data["push_relay_server_url"] = frappe.conf.get("push_relay_server_url")
	data["server_script_enabled"] = frappe.conf.get("server_script_enabled", True)
	data["raven_features"] = RAVEN_FEATURES
	return data


def app_boot():
	"""The parts of Desk's boot the app reads, built with Desk's own helpers."""
	try:
		from frappe.boot import (
			get_user,
			get_user_info,
			load_conf_settings,
			load_translations,
			set_time_zone,
		)
		from frappe.integrations.frappe_providers.frappecloud_billing import is_fc_site
	except ImportError:
		# A Frappe without one of these helpers still boots the app, only as slowly as Desk.
		return frappe.sessions.get()

	frappe.set_user_lang(frappe.session.user)
	bootinfo = frappe._dict(sitename=frappe.local.site, read_only=bool(frappe.flags.read_only))
	get_user(bootinfo)
	bootinfo.user_info = get_user_info()
	set_time_zone(bootinfo)
	bootinfo.sysdefaults = frappe.defaults.get_defaults()
	bootinfo.sysdefaults["setup_complete"] = frappe.is_setup_complete()
	# The setup flow reads it to tell a Frappe Cloud signup from a site needing the Desk wizard.
	bootinfo.is_fc_site = is_fc_site()
	load_translations(bootinfo)
	bootinfo.lang = str(bootinfo.lang)
	load_conf_settings(bootinfo)
	apps = frappe.get_installed_apps(_ensure_on_bench=True)
	# Only the version numbers: get_versions also asks git for every app's branch on each call.
	bootinfo.versions = {app: getattr(frappe.get_module(app), "__version__", "0.0.1") for app in apps}
	# Only the titles the About panel shows; Desk's app_data also builds every app's dock.
	bootinfo.app_data = [{"app_name": app, "app_title": app_title(app)} for app in apps]
	# Only Raven's hooks: another app's hook may expect Desk fields this partial boot leaves out.
	for hook in frappe.get_hooks("extend_bootinfo", app_name="raven"):
		frappe.get_attr(hook)(bootinfo=bootinfo)
	return bootinfo


def app_title(app):
	"""The title Desk's app_data gives an app."""
	screen = frappe.get_hooks("add_to_apps_screen", app_name=app)
	return (screen and screen[0].get("title")) or (
		frappe.get_hooks("app_title", app_name=app) or [app]
	)[0]


def set_cors():
	"""before_request: allow the app's origins without any site configuration."""
	request = getattr(frappe.local, "request", None)
	origin = request.headers.get("Origin") if request else None
	if not origin:
		return
	allowed = set(APP_ORIGINS)
	if frappe.conf.developer_mode:
		allowed.add("http://localhost")
	if origin in allowed and from_app(request):
		frappe.local.allow_cors = origin


def add_cors_headers(response=None, request=None):
	"""after_request: Frappe 15 ignores frappe.local.allow_cors, so write the headers Frappe 16 would.

	Frappe 16 and later read the origin set_cors chose and answer it themselves.
	"""
	origin = getattr(frappe.local, "allow_cors", None)
	if not origin or response is None or request is None:
		return
	if frappe_reads_local_cors() or site_config_allows(origin):
		return
	headers = {
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Allow-Origin": origin,
		"Vary": "Origin",
	}
	if request.method == "OPTIONS":
		headers["Access-Control-Allow-Methods"] = request.headers.get("Access-Control-Request-Method")
		if asked := request.headers.get("Access-Control-Request-Headers"):
			headers["Access-Control-Allow-Headers"] = asked
		if not frappe.conf.developer_mode:
			headers["Access-Control-Max-Age"] = "86400"
	response.headers.update(headers)


def frappe_reads_local_cors():
	"""Frappe 16 added frappe.local.allow_cors to its own CORS handling."""
	return int(frappe.__version__.split(".")[0]) >= 16


def site_config_allows(origin):
	"""Frappe 15 adds its own headers for origins in the site's allow_cors, and a second copy breaks CORS."""
	allowed = frappe.conf.allow_cors
	if allowed == "*":
		return True
	return origin in (allowed if isinstance(allowed, list) else [allowed])


def from_app(request):
	if request.method == "OPTIONS":
		asked = request.headers.get("Access-Control-Request-Headers") or ""
		return APP_HEADER.lower() in [h.strip().lower() for h in asked.split(",")]
	return bool(request.headers.get(APP_HEADER))
