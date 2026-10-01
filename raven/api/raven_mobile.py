import frappe
from frappe.utils.change_log import get_versions

from raven.www.raven import get_favicon

# The app's OAuth redirect URI; the RN app used the bare "raven.thecommit.company:".
NATIVE_REDIRECT_URI = "raven.thecommit.company://oauth"
# Bump to prompt older app builds to update; the app compares its own version against it.
MIN_APP_VERSION = "3.0.0"


def has_auth_method() -> bool:
	# Frappe 17 checks a client's token endpoint auth method; 15 and 16 have no such field.
	return frappe.get_meta("OAuth Client").has_field("token_endpoint_auth_method")


def make_public(client) -> None:
	"""The app keeps no secret; it proves itself with PKCE, which Frappe requires of public clients."""
	if has_auth_method():
		client.token_endpoint_auth_method = "None"


def usable_client_id(client_id: str | None) -> str | None:
	"""The client, when the app can sign in with it: its redirect URI listed, no secret demanded."""
	if not client_id:
		return None
	fields = (
		["redirect_uris", "token_endpoint_auth_method"] if has_auth_method() else ["redirect_uris"]
	)
	client = frappe.db.get_value("OAuth Client", client_id, fields, as_dict=True)
	if not client or NATIVE_REDIRECT_URI not in (client.redirect_uris or "").split():
		return None
	if has_auth_method() and client.token_endpoint_auth_method != "None":
		return None
	return client_id


@frappe.whitelist(allow_guest=True)
def get_client_id():
	"""What the app needs before login: OAuth client, versions, site identity. Stored on the device."""
	app_name = frappe.get_website_settings("app_name") or frappe.get_system_settings("app_name")

	if not app_name or app_name == "Frappe":
		app_name = "Raven"

	all_app_versions = get_versions()

	app_versions = {k: v["version"] for k, v in all_app_versions.items()}
	raven_version = app_versions["raven"]
	frappe_version = app_versions["frappe"]

	return {
		"client_id": usable_client_id(frappe.db.get_single_value("Raven Settings", "oauth_client")),
		"system_timezone": frappe.get_system_settings("time_zone"),
		"app_name": app_name,
		"sitename": frappe.local.site,
		"raven_version": raven_version,
		"frappe_version": frappe_version,
		"min_app_version": MIN_APP_VERSION,
		# Only a favicon the site set for itself; the app carries Raven's own artwork.
		"logo": get_favicon(),
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
	# Second URI is the Capacitor app's: Foundation drops the query of a bare
	# "scheme:?code=…" URL, so iOS needs a host in the redirect.
	oauth_client.redirect_uris = f"raven.thecommit.company: {NATIVE_REDIRECT_URI}"
	oauth_client.default_redirect_uri = "raven.thecommit.company:"
	oauth_client.grant_type = "Authorization Code"
	oauth_client.response_type = "Code"
	oauth_client.allowed_roles = []
	oauth_client.append("allowed_roles", {"role": "Raven User"})
	make_public(oauth_client)
	oauth_client.save()
	raven_settings.oauth_client = oauth_client.name
	raven_settings.save()
	return {"message": "OAuth Client created successfully"}
