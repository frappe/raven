import frappe
import frappe.utils
from frappe import _
from frappe.twofactor import two_factor_is_enabled
from frappe.utils.html_utils import get_icon_html
from frappe.utils.oauth import get_oauth2_authorize_url, get_oauth_keys
from frappe.utils.password import get_decrypted_password

no_cache = True


@frappe.whitelist(allow_guest=True)
def get_context():

	redirect_to = frappe.local.request.args.get("redirect-to")
	context = {"provider_logins": []}
	providers = frappe.get_all(
		"Social Login Key",
		filters={"enable_social_login": 1},
		fields=["name", "client_id", "base_url", "provider_name", "icon", "redirect_url"],
		order_by="name",
	)

	for provider in providers:
		client_secret = get_decrypted_password("Social Login Key", provider.name, "client_secret")
		if not client_secret:
			continue

		icon = {"html": "", "src": "", "alt": ""}
		if provider.icon:
			if provider.provider_name == "Custom":
				icon["html"] = get_icon_html(provider.icon, small=True)
			else:
				icon["src"] = provider.icon
				icon["alt"] = provider.provider_name

		if provider.client_id and provider.base_url and get_oauth_keys(provider.name):

			context["provider_logins"].append(
				{
					"name": provider.name,
					"provider_name": provider.provider_name,
					"auth_url": get_oauth2_authorize_url(provider.name, redirect_to),
					"redirect_to": provider.redirect_url,
					"icon": icon,
				}
			)
			context["social_login"] = True

	login_label = [_("Email")]
	if frappe.utils.cint(frappe.get_system_settings("allow_login_using_mobile_number")):
		login_label.append(_("Mobile"))

	if frappe.utils.cint(frappe.get_system_settings("allow_login_using_user_name")):
		login_label.append(_("Username"))

	context["login_label"] = f" {_('/')} ".join(login_label)

	context["login_with_email_link"] = frappe.get_system_settings("login_with_email_link")
	context["two_factor_is_enabled"] = two_factor_is_enabled()
	context["disable_signup"] = frappe.get_website_settings("disable_signup")
	context["disable_user_pass_login"] = frappe.get_system_settings("disable_user_pass_login")

	return context
