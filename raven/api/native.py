import frappe
import frappe.sessions

# Origins the bundled app runs from: WKWebView on iOS, the Android WebView.
APP_ORIGINS = ("capacitor://localhost", "https://localhost")
# Sent by the app on every request. A browser page at https://localhost shares that origin but
# cannot add a header of its own without a preflight, which is answered by the same rule.
APP_HEADER = "X-Raven-App"


@frappe.whitelist()
def boot():
	"""The session boot the Jinja page inlines, for a page that is not served by the site."""
	if frappe.session.user == "Guest":
		raise frappe.PermissionError
	# Desk's boot runs every app's hooks and takes seconds to rebuild after a logout; use it only when cached.
	data = frappe.sessions.get() if frappe.cache.hget("bootinfo", frappe.session.user) else app_boot()
	data["push_relay_server_url"] = frappe.conf.get("push_relay_server_url")
	data["server_script_enabled"] = frappe.conf.get("server_script_enabled", True)
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


def from_app(request):
	if request.method == "OPTIONS":
		asked = request.headers.get("Access-Control-Request-Headers") or ""
		return APP_HEADER.lower() in [h.strip().lower() for h in asked.split(",")]
	return bool(request.headers.get(APP_HEADER))
