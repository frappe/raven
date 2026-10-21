import click
import frappe
from frappe.desk.page.setup_wizard.setup_wizard import add_all_roles_to


def after_install():
	try:
		print("Setting up Raven...")
		add_all_roles_to("Administrator")
		create_raven_user_for_administrator()
		create_role_profiles()
		create_native_oauth_client()

		click.secho("Thank you for installing Raven!", fg="green")

	except Exception as e:
		BUG_REPORT_URL = "https://github.com/frappe/raven/issues/new"
		click.secho(
			"Installation for Raven failed due to an error."
			" Please try re-installing the app or"
			f" report the issue on {BUG_REPORT_URL} if not resolved.",
			fg="bright_red",
		)
		raise e


def create_raven_user_for_administrator():

	if not frappe.db.exists("Raven User", {"user": "Administrator"}):
		frappe.get_doc(
			{
				"doctype": "Raven User",
				"user": "Administrator",
				"full_name": "Administrator",
				"type": "User",
			}
		).insert(ignore_permissions=True)


RAVEN_USER_PROFILE = "Raven User"
RAVEN_ADMIN_PROFILE = "Raven Admin"
ROLE_PROFILES = {
	RAVEN_USER_PROFILE: ["Raven User"],
	RAVEN_ADMIN_PROFILE: ["Raven User", "Raven Admin"],
}


def create_role_profiles():
	"""
	Role profiles that put someone on Raven. A user whose roles come from a profile loses any
	role added directly on their next save, so Raven access is given through a profile of its
	own, next to the ones their other apps gave them. Profiles that already exist are left alone.
	"""
	for name, roles in ROLE_PROFILES.items():
		if frappe.db.exists("Role Profile", name):
			continue
		frappe.get_doc(
			{"doctype": "Role Profile", "role_profile": name, "roles": [{"role": role} for role in roles]}
		).insert(ignore_permissions=True)


def create_native_oauth_client():
	"""The OAuth client the native app signs in with, so a new site works with the app at once."""
	from raven.api.raven_mobile import create_oauth_client

	try:
		create_oauth_client()
	except Exception:
		# The install still succeeds: `bench execute raven.api.raven_mobile.create_oauth_client` repairs it.
		frappe.log_error(title="Raven: could not create the native app's OAuth client")
		click.secho(
			"Could not create the OAuth client for the Raven app; see the Error Log.", fg="yellow"
		)
