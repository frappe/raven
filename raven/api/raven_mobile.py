import frappe
from frappe.utils.change_log import get_versions


@frappe.whitelist(allow_guest=True)
def get_client_id():
	"""
	API to fetch the client ID, site name (for socket), App name (for display), Raven version and logo. These will be stored on the device
	"""
	app_name = frappe.get_website_settings("app_name") or frappe.get_system_settings("app_name")

	if not app_name or app_name == "Frappe":
		app_name = "Raven"

	all_app_versions = get_versions()

	app_versions = {k: v["version"] for k, v in all_app_versions.items()}
	raven_version = app_versions["raven"]
	frappe_version = app_versions["frappe"]

	return {
		"client_id": frappe.db.get_single_value("Raven Settings", "oauth_client"),
		# Capability flag: the native shell only takes the OAuth path on sites that
		# ship raven.api.native_auth; older sites fall back to the web login page.
		"native_login": True,
		"system_timezone": frappe.get_system_settings("time_zone"),
		"app_name": app_name,
		"sitename": frappe.local.site,
		"raven_version": raven_version,
		"frappe_version": frappe_version,
		"logo": frappe.db.get_single_value("Navbar Settings", "app_logo")
		or "/assets/raven/raven-logo.png",
	}


# TODO: API to fetch boot information for the app - settings like GIF API key etc.


@frappe.whitelist(methods=["POST"])
def create_oauth_client():
	"""
	API to create an OAuth Client for the mobile app.
	"""
	raven_settings = frappe.get_doc("Raven Settings")
	existing_oauth_client = raven_settings.oauth_client

	if not existing_oauth_client:
		oauth_client = frappe.new_doc("OAuth Client")
	else:
		oauth_client = frappe.get_doc("OAuth Client", existing_oauth_client)

	oauth_client.app_name = "Raven Mobile"
	oauth_client.scopes = "all openid"
	# Second URI is for the Capacitor shell: Foundation drops the query of a bare
	# "scheme:?code=…" URL, so iOS needs a host in the redirect.
	oauth_client.redirect_uris = (
		"raven.thecommit.company: raven.thecommit.company://oauth"  # space-separated
	)
	oauth_client.default_redirect_uri = "raven.thecommit.company:"
	oauth_client.grant_type = "Authorization Code"
	oauth_client.response_type = "Code"
	oauth_client.allowed_roles = []
	oauth_client.append("allowed_roles", {"role": "Raven User"})
	oauth_client.save()
	raven_settings.oauth_client = oauth_client.name
	raven_settings.save()
	return {"message": "OAuth Client created successfully"}
