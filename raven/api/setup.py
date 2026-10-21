from contextlib import suppress

import frappe
from frappe import _
from frappe.query_builder.functions import Coalesce
from frappe.utils.telemetry import capture

from raven.api.raven_channel_member import add_channel_members
from raven.api.raven_users import give_raven_access, profiles_can_stack
from raven.api.workspaces import add_workspace_members

SETUP_ADMIN_ROLES = ("System Manager", "Raven Admin")
SETUP_STEPS = ("profile", "workspace", "channel", "team", "hr")
# The funnel, named as the Framework wizard names its own, plus a skip since Raven's steps can be skipped.
SETUP_EVENTS = (
	"started_setup",
	"completed_setup_step",
	"skipped_setup_step",
	"went_back_in_setup",
	"left_setup",
)
SETUP_EVENT_PROPERTIES = (
	"mode",
	"step",
	"from_step",
	"to_step",
	"step_number",
	"total_steps",
	"duration_seconds",
)


def is_setup_admin() -> bool:
	"""Only these roles run the first-admin setup flow."""
	return bool(set(SETUP_ADMIN_ROLES) & set(frappe.get_roles()))


def _raven_users_without_workspace() -> list[dict]:
	"""
	Enabled people in Raven who belong to no workspace, except whoever is asking and the
	Administrator account, which install puts in Raven but is nobody's teammate.
	"""
	raven_user = frappe.qb.DocType("Raven User")
	user = frappe.qb.DocType("User")
	member = frappe.qb.DocType("Raven Workspace Member")
	in_a_workspace = frappe.qb.from_(member).select(member.user)
	return (
		frappe.qb.from_(raven_user)
		# The User's photo where the Raven User has none yet; the admin reading this can load it.
		.left_join(user)
		.on(user.name == raven_user.user)
		.select(
			raven_user.user,
			raven_user.full_name,
			Coalesce(raven_user.user_image, user.user_image).as_("user_image"),
		)
		.where(raven_user.type == "User")
		.where(raven_user.enabled == 1)
		.where(raven_user.user.notin(["Administrator", frappe.session.user]))
		.where(raven_user.user.notin(in_a_workspace))
	).run(as_dict=True)


def _system_users_not_in_raven() -> list[dict]:
	"""
	Enabled system users without a working Raven User, except whoever is asking. A Raven User
	that was disabled (the role was taken away) counts as not in Raven: adding them gives it back.
	"""
	in_raven = frappe.get_all("Raven User", filters={"enabled": 1}, pluck="user")
	return frappe.get_all(
		"User",
		filters={
			"user_type": "System User",
			"enabled": 1,
			"name": ["not in", [*in_raven, "Administrator", "Guest", frappe.session.user]],
		},
		fields=["name as user", "full_name", "user_image", "role_profile_name"],
	)


def _site_users() -> list[dict]:
	"""
	Everyone setup could put in the workspace: people in Raven but in no workspace, and system
	users not in Raven yet. Giving someone access saves their User, which a Raven Admin without
	System Manager can't do, so those rows are offered but not addable for them; the same for a
	user whose single role profile can't take Raven's.
	"""
	stack = profiles_can_stack()
	can_edit_users = frappe.has_permission("User", ptype="write")
	users = [{**row, "in_raven": True, "addable": True} for row in _raven_users_without_workspace()]
	for row in _system_users_not_in_raven():
		profile = row.pop("role_profile_name")
		users.append(
			{
				**row,
				"in_raven": False,
				"addable": can_edit_users and (stack or not profile),
				"role_profile": profile or None,
			}
		)
	return sorted(users, key=lambda row: (row["full_name"] or row["user"]).lower())


@frappe.whitelist(methods=["GET"])
def get_site_users() -> list[dict]:
	"""For setup's "already on this site" box."""
	frappe.only_for(SETUP_ADMIN_ROLES)
	return _site_users()


@frappe.whitelist(methods=["GET"])
def get_company() -> dict | None:
	"""
	The site's default company, which ERPNext's setup wizard creates, to start the workspace from.
	Only a public logo is returned: every member sees the workspace logo.
	"""
	frappe.only_for(SETUP_ADMIN_ROLES)
	company = frappe.defaults.get_global_default("company")
	if (
		not company or not frappe.db.table_exists("Company") or not frappe.db.exists("Company", company)
	):
		return None
	logo = frappe.db.get_value("Company", company, "company_logo")
	return {"name": company, "logo": logo if logo and logo.startswith("/files/") else None}


@frappe.whitelist(methods=["POST"])
def add_site_users(users: list[str] | str, workspace: str, channel: str | None = None) -> int:
	"""
	Puts the chosen site users in setup's workspace and channel, giving Raven access to those
	not in Raven yet. Only people on the server's own list count, so this can't add arbitrary
	users; anyone else in the list is dropped.
	"""
	frappe.only_for(SETUP_ADMIN_ROLES)
	frappe.has_permission("Raven Workspace", doc=workspace, ptype="write", throw=True)
	channel_type = None
	if channel:
		channel_workspace, channel_type = frappe.db.get_value(
			"Raven Channel", channel, ["workspace", "type"]
		) or (None, None)
		if channel_workspace != workspace:
			frappe.throw(_("This channel is not in the workspace."))

	offered = {row["user"]: row for row in _site_users() if row["addable"]}
	chosen = [user for user in dict.fromkeys(frappe.parse_json(users) or []) if user in offered]
	if not chosen:
		return 0
	for user in chosen:
		if not offered[user]["in_raven"]:
			give_raven_access(frappe.get_doc("User", user))
	add_workspace_members(workspace, chosen)
	# Everyone in the workspace is in an Open channel; its rows are made on first visit.
	# Otherwise one batch, so the channel gets one "added" message, not one per person.
	if channel and channel_type != "Open":
		add_channel_members(channel, chosen)
	return len(chosen)


@frappe.whitelist(methods=["POST"])
def complete_setup(
	completed_steps: list[str] | str | None = None, skipped_steps: list[str] | str | None = None
):
	"""Ends the setup flow. A second admin finishing later is a no-op."""
	frappe.only_for(SETUP_ADMIN_ROLES)

	finish_frappe_setup()
	frappe.db.set_single_value("Raven Settings", "setup_completed", 1)
	# Boot is cached per user and carries the flag; every admin's copy is now stale.
	frappe.cache.delete_key("bootinfo")

	# Telemetry is best-effort: a malformed step list must not fail the request and undo the flag.
	with suppress(ValueError, TypeError):
		capture(
			"setup_completed",
			"raven",
			properties={
				"completed_steps": _known_steps(completed_steps),
				"skipped_steps": _known_steps(skipped_steps),
			},
		)


def finish_frappe_setup():
	"""
	A Frappe Cloud signup opens Raven before the Framework's setup wizard. Frappe Cloud already
	stored the region and made the first user, so the wizard is finished here with those values.
	Apps with wizard stages of their own, like ERPNext, still need the real wizard.
	"""
	from frappe.desk.page.setup_wizard.setup_wizard import setup_complete
	from frappe.integrations.frappe_providers.frappecloud_billing import is_fc_site

	if frappe.is_setup_complete() or not is_fc_site() or frappe.get_hooks("setup_wizard_stages"):
		return
	result = setup_complete(frappe_setup_args())
	if result.get("status") != "ok":
		# Raven's setup still ends; the Framework wizard stays available in Desk.
		frappe.log_error(
			title="Raven: could not finish the Framework setup wizard", message=result.get("fail")
		)


def frappe_setup_args() -> dict:
	"""What the wizard's first slide would have sent, from the values Frappe Cloud stored."""
	settings = frappe.get_single("System Settings")
	language = frappe.db.get_value("Language", settings.language, "language_name") or "English"
	return {
		"language": language,
		"lang": language,
		"country": settings.country,
		"timezone": settings.time_zone,
		"currency": settings.currency,
		"enable_telemetry": settings.enable_telemetry,
	}


@frappe.whitelist(methods=["POST"])
def record_setup_event(event: str, properties: dict | str | None = None):
	"""
	One event of setup's funnel, from the web app. Only the known events and properties are
	passed on, and nothing here can fail: telemetry is best effort.
	"""
	if event not in SETUP_EVENTS:
		frappe.throw(_("Unknown setup event: {0}").format(event))
	with suppress(Exception):
		capture(event, "raven", properties=_known_properties(properties))


def _known_properties(value) -> dict:
	"""The known properties, with step names and numbers checked."""
	given = frappe.parse_json(value) or {}
	known = {}
	for key in SETUP_EVENT_PROPERTIES:
		if key not in given:
			continue
		if key in ("step", "from_step", "to_step"):
			if given[key] in SETUP_STEPS:
				known[key] = given[key]
		elif key == "mode":
			if given[key] in ("admin", "profile"):
				known[key] = given[key]
		elif given[key] is not None:
			known[key] = frappe.utils.cint(given[key])
	return known


def _known_steps(value) -> list[str]:
	"""Step names from a list or its JSON string; anything unknown is dropped."""
	return [step for step in frappe.parse_json(value) or [] if step in SETUP_STEPS]
