import frappe
from frappe.tests import IntegrationTestCase

from raven.notification import site_tag, split_for_app, with_site
from raven.raven_cloud_notifications import get_site_name


class TestNotificationLabels(IntegrationTestCase):
	def test_title_names_the_site(self):
		self.assertEqual(with_site("Arya in #north"), f"Arya in #north · {get_site_name()}")

	def test_tag_is_per_site(self):
		self.assertEqual(site_tag("abc123"), f"{get_site_name()}:abc123")

	def test_the_app_reads_the_site_back_off_the_tag(self):
		"""apps/web/src/native/push.ts: a tray entry is this site's when its tag carries the host."""
		host = get_site_name()
		tag = site_tag("abc123")
		self.assertTrue(tag.startswith(f"{host}:"))
		self.assertEqual(tag[len(host) + 1 :], "abc123")


class TestAppPushSplit(IntegrationTestCase):
	"""The app's Android devices get a push with no title, so the app draws it itself."""

	def setUp(self):
		self.user = "Administrator"
		for device, token in (("android native app", "TOKEN-APP"), ("Chrome on Mac", "TOKEN-WEB")):
			row = frappe.get_doc(
				{
					"doctype": "Raven Push Token",
					"user": self.user,
					"fcm_token": token,
					"environment": "Mobile" if "native" in device else "Web",
					"device_information": device,
				}
			)
			row.name = token
			# Straight to the table: inserting the document registers the token with the relay.
			row.db_insert()

	def tearDown(self):
		frappe.db.delete("Raven Push Token", {"fcm_token": ["in", ["TOKEN-APP", "TOKEN-WEB"]]})

	def message(self):
		return {
			"users": [self.user],
			"notification": {"title": "Arya in #north", "body": "Winter is here"},
			"data": {"channel_id": "north"},
			"tag": site_tag("north"),
		}

	def test_each_device_gets_the_push_it_can_draw(self):
		split = split_for_app([self.message()])
		by_token = {message["tokens"][0]: message for message in split}
		self.assertEqual(set(by_token), {"TOKEN-APP", "TOKEN-WEB"})
		# The device draws the web copy, so its title names the site; the app draws the site as a header.
		self.assertEqual(by_token["TOKEN-WEB"]["notification"]["title"], with_site("Arya in #north"))
		self.assertNotIn("notification", by_token["TOKEN-APP"])
		self.assertEqual(by_token["TOKEN-APP"]["data"]["push_title"], "Arya in #north")
		self.assertEqual(by_token["TOKEN-APP"]["data"]["push_body"], "Winter is here")
		self.assertEqual(by_token["TOKEN-APP"]["data"]["channel_id"], "north")

	def test_a_user_with_no_device_sends_nothing(self):
		self.assertEqual(split_for_app([{**self.message(), "users": []}]), [])
