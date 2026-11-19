import frappe
from frappe.tests import IntegrationTestCase

from raven.boot import boot_session

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]

RAVEN_USER = "gifs-member@example.com"
OTHER_RAVEN_USER = "gifs-other@example.com"


def _make_raven_user(email: str):
	if not frappe.db.exists("User", email):
		frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "Gifs",
				"send_welcome_email": 0,
				"roles": [{"role": "Raven User"}],
			}
		).insert(ignore_permissions=True)


def set_key(value: str):
	settings = frappe.get_single("Raven Settings")
	settings.klipy_api_key = value
	settings.save(ignore_permissions=True)


def boot_for(user: str) -> frappe._dict:
	frappe.set_user(user)
	bootinfo = frappe._dict()
	boot_session(bootinfo)
	frappe.set_user("Administrator")
	return bootinfo


class TestGifs(IntegrationTestCase):
	def setUp(self):
		_make_raven_user(RAVEN_USER)
		_make_raven_user(OTHER_RAVEN_USER)

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_boot_has_no_klipy_key_when_unset(self):
		set_key("")
		self.assertNotIn("klipy_api_key", boot_for(RAVEN_USER))

	def test_boot_carries_key_and_customer_id(self):
		set_key("abc123")
		boot = boot_for(RAVEN_USER)
		self.assertEqual(boot.klipy_api_key, "abc123")
		self.assertEqual(len(boot.raven_klipy_customer_id), 64)  # hex sha256
		self.assertNotIn(RAVEN_USER, boot.raven_klipy_customer_id)

	def test_customer_id_is_stable_and_per_user(self):
		set_key("abc123")
		self.assertEqual(
			boot_for(RAVEN_USER).raven_klipy_customer_id,
			boot_for(RAVEN_USER).raven_klipy_customer_id,
		)
		self.assertNotEqual(
			boot_for(RAVEN_USER).raven_klipy_customer_id,
			boot_for(OTHER_RAVEN_USER).raven_klipy_customer_id,
		)

	def test_guest_boot_has_no_key(self):
		set_key("abc123")
		self.assertNotIn("klipy_api_key", boot_for("Guest"))

	def test_changing_key_clears_boot_cache(self):
		set_key("old-key")
		# Boot is cached as a hash keyed by user.
		frappe.cache.hset("bootinfo", RAVEN_USER, {"x": 1})
		set_key("new-key")
		self.assertIsNone(frappe.cache.hget("bootinfo", RAVEN_USER))
