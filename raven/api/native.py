import frappe
import frappe.sessions
from frappe.utils.change_log import get_versions

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
	data = frappe.sessions.get()
	data["push_relay_server_url"] = frappe.conf.get("push_relay_server_url")
	data["server_script_enabled"] = frappe.conf.get("server_script_enabled", True)
	return data


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
