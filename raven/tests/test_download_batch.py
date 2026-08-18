import io
import zipfile

import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_message import download_batch_files

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestDownloadBatchFiles(IntegrationTestCase):
	def setUp(self):
		for email in ("test@example.com", "test1@example.com"):
			frappe.get_doc("User", email).add_roles("Raven User")
		frappe.set_user("test@example.com")

		self.workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": "DL Test Workspace",
				"type": "Public",
			}
		).insert()

		# Private so membership is explicit — test1 is deliberately NOT a member
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "dl-test-channel",
				"type": "Private",
				"workspace": self.workspace.name,
			}
		).insert()

		self.first = self._create_file_message("dl-one.txt", "first file")
		self.second = self._create_file_message("dl-two.txt", "second file")

		# A batch's caption: a plain Text message with no File row at all.
		self.caption = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel.name,
				"message_type": "Text",
				"text": "<p>look at these</p>",
			}
		).insert()

	def _create_file_message(self, file_name: str, content: str):
		message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel.name,
				"message_type": "File",
			}
		).insert()

		file_doc = frappe.get_doc(
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

		message.db_set("file", file_doc.file_url)
		return message

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def _zip_names(self):
		"""Filenames actually inside the zip the endpoint just wrote to frappe.response."""
		return zipfile.ZipFile(io.BytesIO(frappe.response["filecontent"])).namelist()

	def test_zips_every_file_in_the_batch(self):
		download_batch_files([self.first.name, self.second.name])

		self.assertEqual(frappe.response["type"], "download")
		self.assertEqual(sorted(self._zip_names()), ["dl-one.txt", "dl-two.txt"])

	def test_zip_is_named_after_the_channel(self):
		download_batch_files([self.first.name])

		self.assertTrue(frappe.response["filename"].startswith("dl-test-channel-"))
		self.assertTrue(frappe.response["filename"].endswith(".zip"))

	def test_skips_a_caption_message_instead_of_throwing(self):
		download_batch_files([self.first.name, self.caption.name])

		self.assertEqual(self._zip_names(), ["dl-one.txt"])

	def test_throws_when_nothing_resolves_to_a_file(self):
		with self.assertRaises(frappe.DoesNotExistError):
			download_batch_files([self.caption.name])

	def test_throws_when_user_cannot_read_a_message(self):
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			download_batch_files([self.first.name])
