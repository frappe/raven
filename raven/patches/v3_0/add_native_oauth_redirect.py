import frappe

from raven.api import raven_mobile


def execute():
	"""Make the OAuth client created for the RN app usable by this app: its redirect URI, and public."""
	client_id = frappe.db.get_single_value("Raven Settings", "oauth_client")
	if not client_id or not frappe.db.exists("OAuth Client", client_id):
		return
	if raven_mobile.usable_client_id(client_id):
		return
	client = frappe.get_doc("OAuth Client", client_id)
	uris = (client.redirect_uris or "").split()
	if raven_mobile.NATIVE_REDIRECT_URI not in uris:
		client.redirect_uris = " ".join([*uris, raven_mobile.NATIVE_REDIRECT_URI])
	raven_mobile.make_public(client)
	client.save(ignore_permissions=True)
