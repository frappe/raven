import frappe
from frappe import _
from frappe.core.doctype.user.user import change_password as frappe_change_password
from frappe.utils import cint

try:
	from frappe.integrations.doctype.oauth_bearer_token.oauth_bearer_token import get_oauth_token_hash
except ImportError:
	# Older Frappe stores tokens unhashed.
	def get_oauth_token_hash(token):
		return token


@frappe.whitelist(methods=["POST"])
def change_password(
	new_password: str, logout_all_sessions: int = 0, keep_push_token: str | None = None
) -> None:
	"""Set the caller's password, as desk's Change Password does; the site's password policy applies."""
	user = frappe.session.user
	# Frappe's own path only reads the box, so the site-wide setting is folded in here.
	logout = cint(logout_all_sessions) or cint(frappe.get_system_settings("logout_on_password_reset"))
	frappe_change_password(user=user, new_password=new_password, logout_all_sessions=logout)

	if logout:
		# Session logout leaves app tokens and push subscriptions behind; a lost phone would keep both.
		after_password_change(revoke_app_tokens, user, keep_access_token=get_request_bearer_token())
		after_password_change(remove_push_tokens, user, keep_fcm_token=keep_push_token)


@frappe.whitelist(methods=["POST"])
def send_password_reset_link(user: str) -> None:
	"""Email a Raven user a link to set a new password, as desk's Reset Password does."""
	frappe.only_for(("System Manager", "Raven Admin"))

	raven_user_enabled = frappe.db.get_value("Raven User", {"user": user, "type": "User"}, "enabled")
	if (
		user == "Administrator"
		or not raven_user_enabled
		or not frappe.db.get_value("User", user, "enabled")
	):
		frappe.throw(_("Reset links can only be sent to active Raven users."))

	# Called directly: Frappe's reset_password endpoint rate-limits by IP, which an admin
	# resetting a few people in a row would hit. The link is never returned to the caller.
	frappe.get_doc("User", user)._reset_password(send_email=True)


def after_password_change(step, *args, **kwargs) -> None:
	"""Runs a clean-up step in a savepoint; the password has already changed, so a failure is logged."""
	frappe.db.savepoint("raven_after_password_change")
	try:
		step(*args, **kwargs)
	except Exception:
		frappe.db.rollback(save_point="raven_after_password_change")
		frappe.log_error("Could not log out other devices after a password change")
	else:
		frappe.db.release_savepoint("raven_after_password_change")


def revoke_app_tokens(user: str, keep_access_token: str | None = None) -> None:
	"""Revoke the user's tokens for Raven's OAuth client, except the one making this request."""
	client = frappe.db.get_single_value("Raven Settings", "oauth_client")
	if not client:
		return

	filters = {"user": user, "client": client, "status": "Active"}
	if keep_access_token:
		filters["access_token"] = ("!=", get_oauth_token_hash(keep_access_token))

	frappe.db.set_value("OAuth Bearer Token", filters, "status", "Revoked")


def remove_push_tokens(user: str, keep_fcm_token: str | None = None) -> None:
	"""Delete the user's push subscriptions, except this device's; on_trash unsubscribes each one."""
	filters = {"user": user}
	if keep_fcm_token:
		filters["fcm_token"] = ("!=", keep_fcm_token)

	for name in frappe.get_all("Raven Push Token", filters=filters, pluck="name"):
		frappe.delete_doc("Raven Push Token", name)


def get_request_bearer_token() -> str | None:
	"""The access token the native app sent with this request, if any."""
	if not getattr(frappe.local, "request", None):
		return None
	header = frappe.get_request_header("Authorization") or ""
	scheme, _sep, token = header.partition(" ")
	if scheme.lower() != "bearer" or not token:
		return None
	return token.strip()
