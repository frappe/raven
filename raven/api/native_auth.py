import re

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import now_datetime


def _resolve_user(access_token: str) -> str:
	"""Validate the token against Raven's OAuth Client; return the user or raise AuthenticationError."""
	token = frappe.db.get_value(
		"OAuth Bearer Token",
		{"access_token": access_token},
		["user", "client", "status", "expiration_time"],
		as_dict=True,
	)
	raven_client = frappe.db.get_single_value("Raven Settings", "oauth_client")
	if (
		not token
		or not raven_client
		or token.client != raven_client
		or token.status != "Active"
		or not token.expiration_time
		or token.expiration_time < now_datetime()
		or not frappe.db.get_value("User", token.user, "enabled")
	):
		frappe.throw(_("Invalid or expired token"), frappe.AuthenticationError)
	return token.user


def _safe_redirect(redirect_to: str | None) -> str:
	# Relative Raven paths only — never an absolute URL from the client.
	if (
		redirect_to
		and (redirect_to in ("/raven", "/raven/") or redirect_to.startswith("/raven/"))
		and "//" not in redirect_to
		and ".." not in redirect_to
		and re.fullmatch(r"[A-Za-z0-9/._~%\-?=&#]+", redirect_to)
	):
		return redirect_to
	return "/raven"


@frappe.whitelist(allow_guest=True, methods=["POST"])
@rate_limit(limit=60, seconds=60)
def login_with_token(access_token: str, redirect_to: str | None = None):
	"""Turn an OAuth access token (minted for Raven's OAuth Client) into a session cookie.

	The Capacitor shell posts here as a top-level navigation after the PKCE flow, so the
	WebView receives the sid cookie and lands on /raven already logged in."""
	user = _resolve_user(access_token)
	# Scope narrowing is deliberately not honoured: Raven's client is minted with "all openid".
	frappe.local.login_manager.login_as(user)
	frappe.local.response["type"] = "redirect"
	frappe.local.response["location"] = _safe_redirect(redirect_to)
