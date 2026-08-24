from urllib.parse import urlparse

import frappe
from frappe import _
from frappe.frappeclient import FrappeClient


@frappe.whitelist()
def are_push_notifications_enabled() -> bool:
	try:
		push_service = frappe.db.get_single_value("Raven Settings", "push_notification_service")

		if not push_service:
			push_service = "Frappe Cloud"

		if push_service == "Frappe Cloud":
			return frappe.db.get_single_value(
				"Push Notification Settings", "enable_push_notification_relay"
			)
		else:
			return True
	except frappe.DoesNotExistError:
		# push notifications are not supported in the current framework version
		return False


@frappe.whitelist(methods=["POST"])
def register_site_on_raven_cloud() -> None:
	"""
	Register the site on Raven Cloud
	"""
	from raven.utils import make_api_call

	frappe.only_for("System Manager")
	raven_settings = frappe.get_single("Raven Settings")

	if raven_settings.push_notification_service == "Raven":

		url = f"{raven_settings.push_notification_server_url}/api/method/raven_cloud.api.notification.register_site"

		response = make_api_call(
			url=url,
			api_key=raven_settings.push_notification_api_key,
			api_secret=raven_settings.get_password("push_notification_api_secret"),
			method="POST",
			params={"site_name": urlparse(frappe.utils.get_url()).hostname},
		)
		message = response.get("message")

		raven_settings.config = message.get("config")
		raven_settings.vapid_public_key = message.get("vapid_public_key")
		raven_settings.save()
	else:
		frappe.throw(_("Push notification service is not set to Raven Cloud."))


@frappe.whitelist()
def sync_user_tokens_to_raven_cloud():
	"""
	Sync all the tokens available on this site to Raven Cloud
	"""
	frappe.only_for("Raven Admin")
	frappe.enqueue("raven.raven_cloud_notifications.sync_users_tokens_to_raven_cloud")


@frappe.whitelist(methods=["POST"])
def toggle_push_notification_for_channel(member: str, allow_notifications: 0 | 1) -> None:
	if are_push_notifications_enabled():
		member_doc = frappe.get_doc("Raven Channel Member", member)
		if member_doc:
			member_doc.allow_notifications = allow_notifications
			member_doc.save()

			return member_doc
	else:
		frappe.throw(_("Push notifications are not supported in the current framework version"))


@frappe.whitelist(methods=["POST"])
def subscribe(fcm_token: str, environment: str, device_information: str | None = None) -> None:
	"""
	Add the FCM token to the database
	"""

	# Check if the FCM token already exists
	if frappe.db.exists("Raven Push Token", {"fcm_token": fcm_token, "user": frappe.session.user}):
		return

	# Add the FCM token to the database
	frappe.get_doc(
		{
			"doctype": "Raven Push Token",
			"fcm_token": fcm_token,
			"user": frappe.session.user,
			"environment": environment,
			"device_information": device_information,
		}
	).insert()

	return "Subscribed"


@frappe.whitelist(methods=["POST"])
def unsubscribe(fcm_token: str) -> None:
	"""
	Remove the FCM token from the database
	"""

	# Check if the FCM token exists
	token_name = frappe.db.exists(
		"Raven Push Token", {"fcm_token": fcm_token, "user": frappe.session.user}
	)
	if not token_name:
		frappe.throw(_("FCM token not found"))

	# Delete the FCM token from the database using delete_doc to ensure that on_trash method gets called to delete the token from RC/FCP.
	frappe.delete_doc("Raven Push Token", token_name, delete_permanently=True)

	return "Unsubscribed"
