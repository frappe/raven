import frappe

from raven.api.raven_mobile import NATIVE_REDIRECT_URI


def execute():
	"""Add the app's redirect URI to the OAuth client created for the RN app."""
	client_id = frappe.db.get_single_value("Raven Settings", "oauth_client")
	if not client_id or not frappe.db.exists("OAuth Client", client_id):
		return
	client = frappe.get_doc("OAuth Client", client_id)
	uris = (client.redirect_uris or "").split()
	if NATIVE_REDIRECT_URI in uris:
		return
	client.redirect_uris = " ".join([*uris, NATIVE_REDIRECT_URI])
	client.save(ignore_permissions=True)
