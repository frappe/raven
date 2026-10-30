import frappe
from frappe.tests import IntegrationTestCase

from raven.api.contact import contact_fallback_html, sane_contact
from raven.api.raven_message import _forward_payloads, send_message_with_attachments

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]

VALID = {"name": "Priya", "phones": [{"value": "+91 1"}]}

# File validates that an uploaded PDF parses, so non-image content must be a real PDF.
MINIMAL_PDF = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF
"""


class TestContactSanitizer(IntegrationTestCase):
	def test_keeps_and_trims(self):
		self.assertEqual(
			sane_contact(
				{
					"name": " Priya Sharma ",
					"phones": [{"value": " +91 98200 41234 ", "label": "_$!<Mobile>!$_"}],
					"emails": [{"value": "Priya@Northwind.co", "label": "work"}],
					"photo": "x",
				}
			),
			{
				"name": "Priya Sharma",
				"phones": [{"value": "+91 98200 41234", "label": "Mobile"}],
				"emails": [{"value": "Priya@Northwind.co", "label": "Work"}],
			},
		)

	def test_rejects(self):
		for junk in (
			None,
			"x",
			[],
			{"phones": [{"value": "1"}]},
			{"name": "", "phones": [{"value": "1"}]},
			{"name": 5, "phones": [{"value": "1"}]},
		):
			self.assertIsNone(sane_contact(junk), junk)

	def test_name_only_rejected(self):
		self.assertIsNone(sane_contact({"name": "Priya", "phones": [], "emails": [{"value": "  "}]}))

	def test_caps(self):
		c = sane_contact(
			{
				"name": "x" * 500,
				"phones": [{"value": str(i), "label": "y" * 80} for i in range(25)],
				"emails": [{"value": 7}, {"value": "a@b.co"}],
			}
		)
		self.assertEqual(len(c["name"]), 200)
		self.assertEqual(len(c["phones"]), 10)
		self.assertNotIn("label", c["phones"][0])
		self.assertEqual(c["emails"], [{"value": "a@b.co"}])

	def test_fallback_escapes(self):
		html = contact_fallback_html(
			{"name": '"><img src=x>', "phones": [{"value": "1"}], "emails": [{"value": "a@b.co"}]}
		)
		self.assertNotIn("<img", html)
		self.assertEqual(html, "<p>&quot;&gt;&lt;img src=x&gt;<br>1<br>a@b.co</p>")

	def test_unknown_wrapped_label_kept(self):
		c = sane_contact({"name": "Priya", "phones": [{"value": "1", "label": "_$!<HomeFAX>!$_"}]})
		self.assertEqual(c["phones"][0]["label"], "HomeFAX")


class TestContactSend(IntegrationTestCase):
	def setUp(self):
		for user in ("test@example.com", "test1@example.com"):
			frappe.get_doc("User", user).add_roles("Raven User")

		# test creates the channel; test1 (a member) sends the contact
		frappe.set_user("test@example.com")
		workspace = frappe.get_doc(
			{"doctype": "Raven Workspace", "workspace_name": "Contact Workspace", "type": "Public"}
		).insert()
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "contact",
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

	def _upload_image(self, name):
		return frappe.get_doc(
			{
				"doctype": "File",
				"file_name": name,
				"content": "image-bytes",
				"is_private": 1,
				"attached_to_doctype": "Raven Message",
			}
		).insert(ignore_permissions=True)

	def _upload_file(self, name):
		return frappe.get_doc(
			{
				"doctype": "File",
				"file_name": name,
				"content": MINIMAL_PDF,
				"is_private": 1,
				"attached_to_doctype": "Raven Message",
			}
		).insert(ignore_permissions=True)

	def test_send_creates_contact_message(self):
		[msg] = send_message_with_attachments(
			channel_id=self.channel.name,
			client_id="c-1",
			contact={"name": "Priya", "phones": [{"value": "+91 1"}]},
		)
		doc = frappe.get_doc("Raven Message", msg.name)
		self.assertEqual(doc.message_type, "Contact")
		self.assertEqual(
			frappe.parse_json(doc.json),
			{"name": "Priya", "phones": [{"value": "+91 1"}], "emails": []},
		)
		self.assertEqual(doc.text, "<p>Priya<br>+91 1</p>")
		self.assertEqual(doc.get_notification_message_content(), "👤 Shared a contact: Priya")

	def test_photo_lands_on_message(self):
		photo = self._upload_image("contact.webp")
		[msg] = send_message_with_attachments(
			channel_id=self.channel.name,
			contact=VALID,
			files=[{"file_url": photo.file_url, "file_size": 1}],
		)
		doc = frappe.get_doc("Raven Message", msg.name)
		self.assertEqual(doc.file, photo.file_url)

	def test_contact_must_be_alone(self):
		pdf = self._upload_file("a.pdf")
		img = self._upload_image("a.webp")
		for extra in (
			{"content": "<p>hi</p>"},
			{"link_doctype": "User", "link_document": "Administrator"},
			{
				"files": [
					{"file_url": pdf.file_url, "file_size": 1},
					{"file_url": img.file_url, "file_size": 1},
				]
			},
		):
			with self.assertRaises(frappe.ValidationError):
				send_message_with_attachments(channel_id=self.channel.name, contact=VALID, **extra)

	def test_invalid_contact_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			send_message_with_attachments(channel_id=self.channel.name, contact={"name": "Priya"})

	def test_not_editable(self):
		[msg] = send_message_with_attachments(channel_id=self.channel.name, contact=VALID)
		doc = frappe.get_doc("Raven Message", msg.name)
		doc.json = frappe.as_json({"name": "Else", "phones": [{"value": "2"}]})
		with self.assertRaises(frappe.ValidationError):
			doc.save()

	def test_direct_insert_stores_sanitised_json(self):
		doc = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel.name,
				"message_type": "Contact",
				"text": "<p>Priya</p>",
				"json": {
					"name": "<b>Priya</b>",
					"phones": [{"value": "1", "label": {"x": 1}}] + [{"value": str(i)} for i in range(25)],
					"extra": "x" * 1000,
				},
			}
		).insert()
		stored = frappe.parse_json(frappe.db.get_value("Raven Message", doc.name, "json"))
		self.assertEqual(stored["name"], "Priya")
		self.assertNotIn("extra", stored)
		self.assertEqual(len(stored["phones"]), 10)
		self.assertEqual(stored["phones"][0], {"value": "1"})

	def test_text_cannot_become_contact(self):
		[msg] = send_message_with_attachments(channel_id=self.channel.name, content="<p>hi</p>")
		doc = frappe.get_doc("Raven Message", msg.name)
		doc.message_type = "Contact"
		doc.json = frappe.as_json({"name": "Priya", "phones": [{"value": "1", "label": {"x": 1}}]})
		with self.assertRaises(frappe.ValidationError):
			doc.save()

	def test_reply_silent_idempotent(self):
		parent = send_message_with_attachments(channel_id=self.channel.name, content="<p>who?</p>")[0]
		kwargs = dict(
			channel_id=self.channel.name,
			client_id="contact-retry",
			is_reply=True,
			linked_message=parent.name,
			send_silently=True,
			contact=VALID,
		)
		first = send_message_with_attachments(**kwargs)
		again = send_message_with_attachments(**kwargs)
		self.assertEqual([m.name for m in first], [m.name for m in again])
		self.assertEqual(
			frappe.db.get_value("Raven Message", first[0].name, "linked_message"), parent.name
		)

	def test_location_and_contact_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			send_message_with_attachments(
				channel_id=self.channel.name,
				location={"latitude": 1, "longitude": 2},
				contact=VALID,
			)

	def test_contact_json_string_accepted(self):
		[msg] = send_message_with_attachments(
			channel_id=self.channel.name, contact=frappe.as_json(VALID)
		)
		doc = frappe.get_doc("Raven Message", msg.name)
		self.assertEqual(doc.message_type, "Contact")
		self.assertEqual(frappe.parse_json(doc.json)["name"], "Priya")

	def test_single_non_image_file_rejected(self):
		pdf = self._upload_file("only.pdf")
		with self.assertRaises(frappe.ValidationError):
			send_message_with_attachments(
				channel_id=self.channel.name,
				contact=VALID,
				files=[{"file_url": pdf.file_url, "file_size": 1}],
			)

	def test_reply_snapshot_carries_contact_json(self):
		[contact] = send_message_with_attachments(channel_id=self.channel.name, contact=VALID)
		reply = send_message_with_attachments(
			channel_id=self.channel.name,
			content="<p>ok</p>",
			is_reply=True,
			linked_message=contact.name,
		)[0]
		snapshot = frappe.parse_json(
			frappe.db.get_value("Raven Message", reply.name, "replied_message_details")
		)
		self.assertEqual(snapshot["json"]["name"], "Priya")

	def test_forwarded_contact_reply_keeps_payload(self):
		parent = send_message_with_attachments(channel_id=self.channel.name, content="<p>who?</p>")[0]
		photo = self._upload_image("contact.webp")
		[contact] = send_message_with_attachments(
			channel_id=self.channel.name,
			is_reply=True,
			linked_message=parent.name,
			contact=VALID,
			files=[{"file_url": photo.file_url, "file_size": 1}],
		)
		source = frappe.get_doc("Raven Message", contact.name)
		[payload] = _forward_payloads(contact.name)
		self.assertEqual(payload["message_type"], "Contact")
		self.assertEqual(frappe.parse_json(payload["json"]), frappe.parse_json(source.json))
		self.assertEqual(payload["file"], photo.file_url)
		self.assertNotIn("<blockquote", payload["text"])

	def test_boot_advertises_contacts(self):
		from raven.api.native import boot

		self.assertIn("contact_messages", boot()["raven_features"])
