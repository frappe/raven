import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_message import (
	_forward_payloads,
	_maps_url,
	_sane_location,
	attach_json_payloads,
	send_message_with_attachments,
)

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestLocationSanitizer(IntegrationTestCase):
	def test_sane_location_keeps_and_rounds(self):
		self.assertEqual(
			_sane_location(
				{
					"latitude": 12.97560123,
					"longitude": "77.6066",
					"accuracy": 15.5,
					"name": " MG Road ",
					"address": "Bengaluru",
				}
			),
			{
				"latitude": 12.975601,
				"longitude": 77.6066,
				"accuracy": 15.5,
				"name": "MG Road",
				"address": "Bengaluru",
			},
		)

	def test_sane_location_rejects_bad_coordinates(self):
		bad_coordinates = (
			(91, 0),
			(0, 181),
			(True, 0),
			(float("nan"), 0),
			("abc", 0),
			(None, 0),
			(0, float("inf")),
		)
		for lat, lng in bad_coordinates:
			self.assertIsNone(_sane_location({"latitude": lat, "longitude": lng}), (lat, lng))
		for junk in (None, "x", [1, 2], 5):
			self.assertIsNone(_sane_location(junk), junk)

	def test_sane_location_drops_bad_optionals(self):
		loc = _sane_location(
			{"latitude": 1, "longitude": 2, "accuracy": 0, "name": "<b></b>", "address": "  "}
		)
		self.assertEqual(loc, {"latitude": 1.0, "longitude": 2.0})
		self.assertIsNone(
			_sane_location({"latitude": 1, "longitude": 2, "accuracy": 100001}).get("accuracy")
		)
		self.assertEqual(
			len(_sane_location({"latitude": 1, "longitude": 2, "name": "x" * 500})["name"]), 120
		)
		self.assertEqual(
			_sane_location({"latitude": 1, "longitude": 2, "name": "<script>a</script>Cafe"})[
				"name"
			],
			"aCafe",
		)

	def test_maps_url(self):
		loc = {"latitude": 12.97561, "longitude": 77.60659, "name": "MG Road & Co"}
		self.assertEqual(
			_maps_url(loc, "apple"),
			"https://maps.apple.com/?ll=12.97561,77.60659&q=MG%20Road%20%26%20Co",
		)
		self.assertEqual(
			_maps_url(loc, "google"),
			"https://www.google.com/maps/search/?api=1&query=12.97561,77.60659",
		)
		self.assertEqual(_maps_url(loc, "junk"), _maps_url(loc, "google"))
		self.assertIn("q=Location", _maps_url({"latitude": 1.0, "longitude": 2.0}, "apple"))


class TestLocationSend(IntegrationTestCase):
	def setUp(self):
		for user in ("test@example.com", "test1@example.com"):
			frappe.get_doc("User", user).add_roles("Raven User")

		# test creates the channel; test1 (a member) sends the location
		frappe.set_user("test@example.com")
		workspace = frappe.get_doc(
			{"doctype": "Raven Workspace", "workspace_name": "Location Workspace", "type": "Public"}
		).insert()
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "location",
				"type": "Public",
				"workspace": workspace.name,
			}
		).insert()
		frappe.get_doc(
			{"doctype": "Raven Workspace Member", "user": "test1@example.com", "workspace": workspace.name}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": self.channel.name,
				"user_id": "test1@example.com",
			}
		).insert(ignore_permissions=True)

		frappe.set_user("test1@example.com")
		frappe.clear_cache()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def test_send_creates_location_message(self):
		[msg] = send_message_with_attachments(
			channel_id=self.channel.name,
			client_id="loc-1",
			location={
				"latitude": 12.97561,
				"longitude": 77.60659,
				"accuracy": 15,
				"name": "MG Road",
				"maps": "google",
			},
		)
		doc = frappe.get_doc("Raven Message", msg.name)
		self.assertEqual(doc.message_type, "Location")
		self.assertEqual(
			frappe.parse_json(doc.json),
			{"latitude": 12.97561, "longitude": 77.60659, "accuracy": 15.0, "name": "MG Road"},
		)
		self.assertIn(
			'href="https://www.google.com/maps/search/?api=1&amp;query=12.97561,77.60659"', doc.text
		)
		self.assertEqual(
			doc.content,
			"https://www.google.com/maps/search/?api=1&query=12.97561,77.60659",
		)
		self.assertEqual(
			doc.links.strip(),
			"https://www.google.com/maps/search/?api=1&query=12.97561,77.60659",
		)

	def test_link_text_escapes_name(self):
		[msg] = send_message_with_attachments(
			channel_id=self.channel.name,
			location={"latitude": 1, "longitude": 2, "name": '"><img src=x>', "maps": "apple"},
		)
		doc = frappe.get_doc("Raven Message", msg.name)
		self.assertEqual(doc.text.count("<a "), 1)
		self.assertNotIn("<img", doc.text)

	def test_invalid_location_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			send_message_with_attachments(
				channel_id=self.channel.name, location={"latitude": 200, "longitude": 0}
			)

	def test_location_must_be_alone(self):
		extras = (
			{"content": "<p>hi</p>"},
			{"files": [{"file_url": "/files/a.png", "file_size": 1}]},
			{"link_doctype": "User", "link_document": "Administrator"},
		)
		for extra in extras:
			with self.assertRaises(frappe.ValidationError):
				send_message_with_attachments(
					channel_id=self.channel.name,
					location={"latitude": 1, "longitude": 2},
					**extra,
				)

	def test_reply_silent_and_idempotent(self):
		parent = send_message_with_attachments(
			channel_id=self.channel.name, content="<p>where?</p>"
		)[0]
		kwargs = dict(
			channel_id=self.channel.name,
			client_id="loc-retry",
			is_reply=True,
			linked_message=parent.name,
			send_silently=True,
			location={"latitude": 1, "longitude": 2},
		)
		first = send_message_with_attachments(**kwargs)
		again = send_message_with_attachments(**kwargs)
		self.assertEqual([m.name for m in first], [m.name for m in again])
		self.assertEqual(
			frappe.db.get_value("Raven Message", first[0].name, "linked_message"), parent.name
		)

	def test_notification_text(self):
		[a] = send_message_with_attachments(
			channel_id=self.channel.name, location={"latitude": 1, "longitude": 2, "name": "MG Road"}
		)
		[b] = send_message_with_attachments(
			channel_id=self.channel.name, location={"latitude": 1, "longitude": 2}
		)
		self.assertEqual(
			frappe.get_doc("Raven Message", a.name).get_notification_message_content(),
			"📍 Shared a location - MG Road",
		)
		self.assertEqual(
			frappe.get_doc("Raven Message", b.name).get_notification_message_content(),
			"📍 Shared a location",
		)

	def test_json_attached_for_location_rows(self):
		[loc] = send_message_with_attachments(
			channel_id=self.channel.name, location={"latitude": 1, "longitude": 2}
		)
		rows = attach_json_payloads([frappe._dict(name=loc.name, message_type="Location")])
		self.assertEqual(frappe.parse_json(rows[0]["json"])["latitude"], 1.0)

	def test_reply_snapshot_carries_location_json(self):
		[loc] = send_message_with_attachments(
			channel_id=self.channel.name,
			location={"latitude": 1, "longitude": 2, "name": "Cafe"},
		)
		reply = send_message_with_attachments(
			channel_id=self.channel.name,
			content="<p>ok</p>",
			is_reply=True,
			linked_message=loc.name,
		)[0]
		snapshot = frappe.parse_json(
			frappe.db.get_value("Raven Message", reply.name, "replied_message_details")
		)
		self.assertEqual(snapshot["message_type"], "Location")
		self.assertEqual(frappe.parse_json(snapshot["json"])["name"], "Cafe")

	def test_forwarded_location_reply_keeps_payload(self):
		parent = send_message_with_attachments(
			channel_id=self.channel.name, content="<p>where?</p>"
		)[0]
		[loc] = send_message_with_attachments(
			channel_id=self.channel.name,
			is_reply=True,
			linked_message=parent.name,
			location={"latitude": 1, "longitude": 2},
		)
		source = frappe.get_doc("Raven Message", loc.name)
		[payload] = _forward_payloads(loc.name)
		self.assertEqual(payload["message_type"], "Location")
		self.assertEqual(payload["text"], source.text)
		self.assertEqual(frappe.parse_json(payload["json"])["latitude"], 1.0)
		self.assertNotIn("is_reply", payload)

	def test_native_boot_advertises_location(self):
		from raven.api.native import boot

		self.assertIn("location_messages", boot()["raven_features"])

	def test_location_text_not_editable(self):
		[msg] = send_message_with_attachments(
			channel_id=self.channel.name, location={"latitude": 1, "longitude": 2}
		)
		doc = frappe.get_doc("Raven Message", msg.name)
		doc.text = "<p>edited</p>"
		with self.assertRaises(frappe.ValidationError):
			doc.save()
