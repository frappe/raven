from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_users import profiles_can_stack
from raven.api.setup import (
	add_site_users,
	complete_setup,
	get_company,
	get_site_users,
	record_setup_event,
)
from raven.boot import boot_session
from raven.install import after_install

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]

MEMBER = "setup-member@example.com"
LONER = "setup-loner@example.com"
# Runs setup, but can't write User records.
RAVEN_ADMIN = "setup-raven-admin@example.com"
# On the site, not in Raven: a plain system user, and one whose roles come from a role profile.
OUTSIDER = "setup-outsider@example.com"
PROFILED = "setup-profiled@example.com"
ROLE_PROFILE = "Setup Test Profile"


def _make_user(
	email: str, first_name: str, roles=("Raven User",), role_profile: str | None = None
):
	if frappe.db.exists("User", email):
		return
	user = frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": first_name,
			"send_welcome_email": 0,
			"roles": [{"role": role} for role in roles],
		}
	)
	if role_profile:
		user.role_profile_name = role_profile
	user.insert(ignore_permissions=True)


def _make_raven_user(email: str, first_name: str):
	_make_user(email, first_name)


def _make_workspace(name: str):
	return frappe.get_doc(
		{"doctype": "Raven Workspace", "workspace_name": name, "type": "Public"}
	).insert()


def _make_channel(workspace: str, name: str, type: str = "Public"):
	return frappe.get_doc(
		{"doctype": "Raven Channel", "channel_name": name, "type": type, "workspace": workspace}
	).insert()


class TestSetup(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		_make_raven_user(MEMBER, "Setup Member")
		frappe.db.set_single_value("Raven Settings", "setup_completed", 0)

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def _boot_flag(self):
		bootinfo = frappe._dict()
		boot_session(bootinfo)
		return bootinfo.raven_setup_pending

	def test_boot_flags_pending_for_admin(self):
		self.assertEqual(self._boot_flag(), 1)

	def test_boot_not_pending_once_completed(self):
		frappe.db.set_single_value("Raven Settings", "setup_completed", 1)
		self.assertEqual(self._boot_flag(), 0)

	def test_boot_not_pending_for_member(self):
		frappe.set_user(MEMBER)
		self.assertEqual(self._boot_flag(), 0)

	def test_complete_setup_clears_flag_and_is_idempotent(self):
		complete_setup(["workspace", "team"], ["channel"])
		self.assertEqual(frappe.db.get_single_value("Raven Settings", "setup_completed"), 1)
		complete_setup('["workspace"]', "[]")
		self.assertEqual(frappe.db.get_single_value("Raven Settings", "setup_completed"), 1)

	def test_complete_setup_finishes_frappe_wizard_for_a_cloud_signup(self):
		with (
			patch("frappe.integrations.frappe_providers.frappecloud_billing.is_fc_site", return_value=True),
			patch("frappe.is_setup_complete", return_value=False),
			patch("frappe.get_hooks", return_value=[]),
			patch(
				"frappe.desk.page.setup_wizard.setup_wizard.setup_complete", return_value={"status": "ok"}
			) as wizard,
		):
			complete_setup([], [])
		self.assertEqual(
			wizard.call_args.args[0]["timezone"], frappe.get_single("System Settings").time_zone
		)
		self.assertEqual(frappe.db.get_single_value("Raven Settings", "setup_completed"), 1)

	def test_complete_setup_leaves_frappe_wizard_to_erpnext(self):
		with (
			patch("frappe.integrations.frappe_providers.frappecloud_billing.is_fc_site", return_value=True),
			patch("frappe.is_setup_complete", return_value=False),
			patch(
				"frappe.get_hooks", return_value=["erpnext.setup.setup_wizard.setup_wizard.get_setup_stages"]
			),
			patch("frappe.desk.page.setup_wizard.setup_wizard.setup_complete") as wizard,
		):
			complete_setup([], [])
		wizard.assert_not_called()

	def test_complete_setup_survives_malformed_steps(self):
		complete_setup("not json", '["hr", "<script>"]')
		self.assertEqual(frappe.db.get_single_value("Raven Settings", "setup_completed"), 1)

	def test_complete_setup_refuses_guest(self):
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			complete_setup([], [])

	def test_complete_setup_drops_cached_boot(self):
		# Boot is cached per user; a stale copy would still open the setup flow.
		frappe.cache.hset("bootinfo", "some-admin@example.com", {"raven_setup_pending": 1})
		complete_setup([], [])
		self.assertIsNone(frappe.cache.hget("bootinfo", "some-admin@example.com"))

	def test_complete_setup_refuses_member(self):
		frappe.set_user(MEMBER)
		with self.assertRaises(frappe.PermissionError):
			complete_setup([], [])
		frappe.set_user("Administrator")
		self.assertEqual(frappe.db.get_single_value("Raven Settings", "setup_completed"), 0)

	def test_setup_event_passes_known_properties_only(self):
		with patch("raven.api.setup.capture") as capture:
			record_setup_event(
				"completed_setup_step",
				{
					"step": "workspace",
					"step_number": "2",
					"total_steps": 4,
					"duration_seconds": 12.6,
					"junk": 1,
				},
			)
		capture.assert_called_once_with(
			"completed_setup_step",
			"raven",
			properties={"step": "workspace", "step_number": 2, "total_steps": 4, "duration_seconds": 12},
		)
		with patch("raven.api.setup.capture") as capture:
			record_setup_event("went_back_in_setup", {"from_step": "bogus", "to_step": "profile"})
		capture.assert_called_once_with("went_back_in_setup", "raven", properties={"to_step": "profile"})
		with self.assertRaises(frappe.ValidationError):
			record_setup_event("some_event", {})

	def test_complete_setup_keeps_profile_step(self):
		from raven.api.setup import _known_steps

		self.assertEqual(_known_steps(["profile", "workspace", "bogus"]), ["profile", "workspace"])

	def test_install_creates_the_role_profiles(self):
		frappe.delete_doc("Role Profile", "Raven Admin", force=True)
		after_install()
		roles = frappe.get_all("Has Role", filters={"parent": "Raven Admin"}, pluck="role")
		self.assertEqual(sorted(roles), ["Raven Admin", "Raven User"])

	def test_install_creates_no_workspace(self):
		workspaces = frappe.db.count("Raven Workspace")
		channels = frappe.db.count("Raven Channel")

		after_install()

		self.assertEqual(frappe.db.count("Raven Workspace"), workspaces)
		self.assertEqual(frappe.db.count("Raven Channel"), channels)
		self.assertEqual(frappe.db.get_single_value("Raven Settings", "setup_completed"), 0)


class TestSiteUsers(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		# Users made "before Raven": the save hook must not put them in on its own.
		frappe.db.set_single_value("Raven Settings", "auto_add_system_users", 0)
		if not frappe.db.exists("Role Profile", ROLE_PROFILE):
			frappe.get_doc(
				{
					"doctype": "Role Profile",
					"role_profile": ROLE_PROFILE,
					"roles": [{"role": "System Manager"}],
				}
			).insert(ignore_permissions=True)
		_make_raven_user(LONER, "Loner")
		frappe.db.delete("Raven Workspace Member", {"user": LONER})
		_make_user(OUTSIDER, "Outsider", roles=("System Manager",))
		_make_user(PROFILED, "Profiled", roles=(), role_profile=ROLE_PROFILE)
		self.workspace = _make_workspace("Setup Test Workspace")
		self.channel = _make_channel(self.workspace.name, "setup-test")

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def _listed(self):
		return {row["user"]: row for row in get_site_users()}

	def test_lists_people_in_no_workspace_and_system_users_not_in_raven(self):
		listed = self._listed()
		self.assertTrue(listed[LONER]["in_raven"])
		self.assertFalse(listed[OUTSIDER]["in_raven"])
		self.assertNotIn("Administrator", listed)

	def test_leaves_out_workspace_members_and_disabled_people(self):
		frappe.get_doc(
			{"doctype": "Raven Workspace Member", "workspace": self.workspace.name, "user": LONER}
		).insert()
		frappe.db.set_value("User", OUTSIDER, "enabled", 0)
		listed = self._listed()
		self.assertNotIn(LONER, listed)
		self.assertNotIn(OUTSIDER, listed)

	def test_someone_whose_raven_access_was_taken_away_is_offered_again(self):
		# Their Raven User is disabled when the role goes; adding them in setup gives it back.
		user = frappe.get_doc("User", LONER)
		user.remove_roles("Raven User")
		self.assertEqual(frappe.db.get_value("Raven User", LONER, "enabled"), 0)
		self.assertFalse(self._listed()[LONER]["in_raven"])
		add_site_users([LONER], self.workspace.name)
		self.assertEqual(frappe.db.get_value("Raven User", LONER, "enabled"), 1)

	def test_add_gives_raven_access_and_puts_them_in_the_workspace_and_channel(self):
		self.assertEqual(add_site_users([LONER, OUTSIDER], self.workspace.name, self.channel.name), 2)
		self.assertTrue(frappe.db.exists("Raven User", OUTSIDER))
		for user in (LONER, OUTSIDER):
			self.assertTrue(
				frappe.db.exists("Raven Workspace Member", {"workspace": self.workspace.name, "user": user})
			)
			self.assertTrue(
				frappe.db.exists("Raven Channel Member", {"channel_id": self.channel.name, "user_id": user})
			)

	def test_a_public_photo_on_the_user_is_shown_and_carried_onto_the_raven_user(self):
		frappe.db.set_value("User", OUTSIDER, "user_image", "/files/outsider.png")
		self.assertEqual(self._listed()[OUTSIDER]["user_image"], "/files/outsider.png")
		add_site_users([OUTSIDER], self.workspace.name)
		self.assertEqual(
			frappe.db.get_value("Raven User", OUTSIDER, "user_image"), "/files/outsider.png"
		)

	def test_a_raven_admin_without_system_manager_can_add_only_people_already_in_raven(self):
		_make_user(RAVEN_ADMIN, "Raven Admin", roles=("Raven User", "Raven Admin"))
		frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"workspace": self.workspace.name,
				"user": RAVEN_ADMIN,
				"is_admin": 1,
			}
		).insert()
		frappe.set_user(RAVEN_ADMIN)
		listed = self._listed()
		self.assertTrue(listed[LONER]["addable"])
		self.assertFalse(listed[OUTSIDER]["addable"])
		# The outsider is dropped rather than failing everyone.
		self.assertEqual(add_site_users([LONER, OUTSIDER], self.workspace.name), 1)
		self.assertFalse(frappe.db.exists("Raven User", OUTSIDER))

	def test_add_takes_only_people_from_the_offered_list(self):
		# The caller, a made-up name and a workspace member are not on the list.
		self.assertEqual(
			add_site_users(["Administrator", "nobody@example.com", LONER], self.workspace.name), 1
		)
		self.assertFalse(
			frappe.db.exists(
				"Raven Workspace Member", {"workspace": self.workspace.name, "user": "Administrator"}
			)
		)

	def test_role_profile_user_gets_ravens_profile_where_profiles_stack(self):
		listed = self._listed()
		self.assertEqual(listed[PROFILED]["role_profile"], ROLE_PROFILE)
		self.assertEqual(listed[PROFILED]["addable"], profiles_can_stack())
		added = add_site_users([PROFILED], self.workspace.name)
		if profiles_can_stack():
			self.assertEqual(added, 1)
			self.assertTrue(frappe.db.exists("Raven User", PROFILED))
			self.assertIn("Raven User", frappe.get_roles(PROFILED))
		else:
			self.assertEqual(added, 0)

	def test_add_to_an_open_channel_adds_no_member_rows(self):
		# Everyone in the workspace is in an Open channel; rows are made on first visit.
		general = _make_channel(self.workspace.name, "setup-general", type="Open")
		add_site_users([LONER], self.workspace.name, general.name)
		self.assertFalse(frappe.db.exists("Raven Channel Member", {"user_id": LONER}))

	def test_add_refuses_a_channel_from_another_workspace(self):
		other = _make_workspace("Setup Other Workspace")
		elsewhere = _make_channel(other.name, "setup-elsewhere")
		with self.assertRaises(frappe.ValidationError):
			add_site_users([LONER], self.workspace.name, elsewhere.name)

	def test_members_cannot_list_or_add(self):
		frappe.set_user(LONER)
		with self.assertRaises(frappe.PermissionError):
			get_site_users()
		with self.assertRaises(frappe.PermissionError):
			add_site_users([OUTSIDER], self.workspace.name)


class TestCompanyDefaults(IntegrationTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")

	def test_none_without_a_default_company(self):
		with patch("frappe.defaults.get_global_default", return_value=None):
			self.assertIsNone(get_company())

	def test_name_and_public_logo_of_the_default_company(self):
		with (
			patch("frappe.defaults.get_global_default", return_value="Acme"),
			patch.object(frappe.db, "table_exists", return_value=True),
			patch.object(frappe.db, "exists", return_value=True),
			patch.object(frappe.db, "get_value", return_value="/files/acme.png"),
		):
			self.assertEqual(get_company(), {"name": "Acme", "logo": "/files/acme.png"})

	def test_leaves_out_a_private_logo(self):
		# Every member sees the workspace logo; a private file wouldn't load for them.
		with (
			patch("frappe.defaults.get_global_default", return_value="Acme"),
			patch.object(frappe.db, "table_exists", return_value=True),
			patch.object(frappe.db, "exists", return_value=True),
			patch.object(frappe.db, "get_value", return_value="/private/files/acme.png"),
		):
			self.assertEqual(get_company(), {"name": "Acme", "logo": None})

	def test_members_cannot_read_it(self):
		_make_raven_user(MEMBER, "Setup Member")
		frappe.set_user(MEMBER)
		with self.assertRaises(frappe.PermissionError):
			get_company()
