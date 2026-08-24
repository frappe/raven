import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_message import attach_file_to_document

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestAttachFileToDocument(IntegrationTestCase):
	def setUp(self):
		for email in ("test@example.com", "test1@example.com"):
			frappe.get_doc("User", email).add_roles("Raven User")
		frappe.set_user("test@example.com")

		self.workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": "Attach Test Workspace",
				"type": "Public",
			}
		).insert()

		# Private so membership is explicit — test1 is deliberately NOT a member
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "attach-test-channel",
				"type": "Private",
				"workspace": self.workspace.name,
			}
		).insert()

		# Two independent file messages (as if sent as a batch sharing a message_batch_id)
		# so the list-based endpoint has more than one source file to attach in one call.
		self.file_message, self.source_file_url = self._create_file_message(
			"attach-test-1.txt", "attach-test fixture content 1"
		)
		self.file_message_2, self.source_file_url_2 = self._create_file_message(
			"attach-test-2.txt", "attach-test fixture content 2"
		)

		self.text_message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel.name,
				"message_type": "Text",
				"text": "<p>no file here</p>",
			}
		).insert()

		self.target = frappe.get_doc({"doctype": "ToDo", "description": "Attach target"}).insert(
			ignore_permissions=True
		)

	def _create_file_message(self, file_name: str, content: str):
		"""
		Create a File-type Raven Message plus the File row attached to it, mirroring how a
		real upload lands. `content` (rather than a hardcoded file_url) lets Frappe write
		the physical file itself and compute the resulting file_url — no external fixture
		file needed, and no hardcoded path to go stale if Frappe's naming/dedup changes.

		Returns the message doc and the source File's real (computed) file_url.
		"""
		message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel.name,
				"message_type": "File",
				"file": f"/private/files/{file_name}",
			}
		).insert()

		source_file = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": file_name,
				"content": content,
				"attached_to_doctype": "Raven Message",
				"attached_to_name": message.name,
				"attached_to_field": "file",
				"is_private": 1,
			}
		).insert(ignore_permissions=True)

		return message, source_file.file_url

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def test_attaches_file_to_target_document(self):
		file_names = attach_file_to_document([self.file_message.name], "ToDo", self.target.name)

		self.assertEqual(len(file_names), 1)
		attached = frappe.get_doc("File", file_names[0])
		self.assertEqual(attached.attached_to_doctype, "ToDo")
		self.assertEqual(attached.attached_to_name, self.target.name)
		# The invariant is that the attached copy points at the SAME file as the one on
		# the Raven Message — not a specific literal path, which Frappe's content-hash
		# dedup is free to rename.
		self.assertEqual(attached.file_url, self.source_file_url)

	def test_attaches_a_batch_of_files_in_one_call(self):
		file_names = attach_file_to_document(
			[self.file_message.name, self.file_message_2.name], "ToDo", self.target.name
		)

		# Returned in the same order as the input message ids.
		self.assertEqual(len(file_names), 2)
		attached_1 = frappe.get_doc("File", file_names[0])
		attached_2 = frappe.get_doc("File", file_names[1])

		for attached in (attached_1, attached_2):
			self.assertEqual(attached.attached_to_doctype, "ToDo")
			self.assertEqual(attached.attached_to_name, self.target.name)

		self.assertEqual(attached_1.file_url, self.source_file_url)
		self.assertEqual(attached_2.file_url, self.source_file_url_2)

	def test_throws_when_message_has_no_file(self):
		with self.assertRaises(frappe.DoesNotExistError):
			attach_file_to_document([self.text_message.name], "ToDo", self.target.name)

	def test_throws_and_attaches_nothing_when_one_message_in_batch_has_no_file(self):
		# file_message has a file, text_message doesn't — the whole call must fail, and
		# must not leave file_message's file attached to the target either.
		with self.assertRaises(frappe.DoesNotExistError):
			attach_file_to_document(
				[self.file_message.name, self.text_message.name], "ToDo", self.target.name
			)

		self.assertEqual(
			frappe.db.count("File", {"attached_to_doctype": "ToDo", "attached_to_name": self.target.name}),
			0,
		)

	def test_throws_when_user_cannot_read_the_message(self):
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			attach_file_to_document([self.file_message.name], "ToDo", self.target.name)

	def test_throws_when_user_cannot_write_the_target_document(self):
		# test@example.com carries System Manager (a shared test fixture role) so it can
		# write almost anything — not useful for this gate. test1 has only "All"/"Guest",
		# so make it a channel member (can now READ file_message) without granting it any
		# write access to the target: "Raven Settings" write is restricted to System
		# Manager / Raven Admin. The check_write_permission gate on the TARGET must stop
		# the call before any file is looked up or attached, same as
		# frappe.handler.upload_file's own gate.
		frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": self.channel.name,
				"user_id": "test1@example.com",
			}
		).insert(ignore_permissions=True)

		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			attach_file_to_document([self.file_message.name], "Raven Settings", "Raven Settings")

		self.assertEqual(
			frappe.db.count(
				"File", {"attached_to_doctype": "Raven Settings", "attached_to_name": "Raven Settings"}
			),
			0,
		)
