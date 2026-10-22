import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_message import (
	AUDIO_EXTENSIONS,
	_is_audio,
	_sane_duration,
	_sane_waveform,
	send_message_with_attachments,
)

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]

WEB_AUDIO_EXTENSIONS = {"mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus", "weba"}


class TestVoiceNoteSanitizers(IntegrationTestCase):
	def test_audio_extensions_match_the_web_client(self):
		# Mirror of AUDIO_EXTENSIONS in apps/web/src/utils/attachmentPreview.ts
		self.assertEqual(AUDIO_EXTENSIONS, WEB_AUDIO_EXTENSIONS)

	def test_is_audio(self):
		self.assertTrue(_is_audio("/private/files/voice-note-20261021-101500.m4a"))
		self.assertTrue(_is_audio("/private/files/a.WEBA?fid=abc"))
		self.assertFalse(_is_audio("/private/files/clip.webm"))
		self.assertFalse(_is_audio("/private/files/noext"))

	def test_sane_duration(self):
		self.assertEqual(_sane_duration(7.25), 7.25)
		self.assertEqual(_sane_duration("3.5"), 3.5)
		self.assertEqual(_sane_duration(600), 600.0)
		for junk in (0, -1, 601, float("nan"), float("inf"), "abc", None, [1]):
			self.assertIsNone(_sane_duration(junk), junk)

	def test_sane_waveform(self):
		self.assertEqual(_sane_waveform("0,50,100"), "0,50,100")
		self.assertEqual(_sane_waveform("-5,150,42.6"), "0,100,43")
		self.assertEqual(len(_sane_waveform(",".join(["10"] * 500)).split(",")), 64)
		for junk in ("", "abc", "1,abc", None, 12, ["1"]):
			self.assertIsNone(_sane_waveform(junk), junk)


class TestVoiceNoteSend(IntegrationTestCase):
	def setUp(self):
		for user in ("test@example.com", "test1@example.com"):
			frappe.get_doc("User", user).add_roles("Raven User")

		# test creates the channel; test1 (a member) records and sends
		frappe.set_user("test@example.com")
		workspace = frappe.get_doc(
			{"doctype": "Raven Workspace", "workspace_name": "Voice Workspace", "type": "Public"}
		).insert()
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "voice",
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
		self.audio_url = self._upload("voice-note-20261021-101500.m4a")
		self.text_url = self._upload("notes.txt")
		frappe.clear_cache()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def _upload(self, file_name):
		return (
			frappe.get_doc(
				{
					"doctype": "File",
					"file_name": file_name,
					# Unique content: Frappe reuses the URL of an identical file
					"content": file_name,
					"is_private": 1,
					"attached_to_doctype": "Raven Message",
				}
			)
			.insert(ignore_permissions=True)
			.file_url
		)

	def _send(self, file_url, **meta):
		return send_message_with_attachments(
			channel_id=self.channel.name, files=[{"file_url": file_url, "file_size": 1, **meta}]
		)[0]

	def test_stores_duration_and_waveform_on_audio(self):
		message = self._send(self.audio_url, duration=7.25, waveform="0,50,100")
		self.assertEqual(message.audio_duration, 7.25)
		self.assertEqual(message.audio_waveform, "0,50,100")

	def test_drops_junk_and_still_inserts(self):
		message = self._send(self.audio_url, duration=-3, waveform="abc")
		self.assertFalse(message.audio_duration)
		self.assertFalse(message.audio_waveform)

	def test_waveform_needs_a_valid_duration(self):
		message = self._send(self.audio_url, duration="nope", waveform="1,2,3")
		self.assertFalse(message.audio_waveform)

	def test_ignored_on_non_audio_files(self):
		message = self._send(self.text_url, duration=5, waveform="1,2,3")
		self.assertFalse(message.audio_duration)
		self.assertFalse(message.audio_waveform)

	def test_forward_keeps_voice_note_fields(self):
		from raven.api.raven_message import forward_message

		original = self._send(self.audio_url, duration=7.25, waveform="0,50,100")
		forward_message(
			message_receivers=[{"type": "Channel", "name": self.channel.name}], message_id=original.name
		)
		copy = frappe.get_all(
			"Raven Message",
			filters={"is_forwarded": 1, "channel_id": self.channel.name},
			fields=["audio_duration", "audio_waveform"],
		)[0]
		self.assertEqual(copy.audio_duration, 7.25)
		self.assertEqual(copy.audio_waveform, "0,50,100")

	def test_stream_columns_include_voice_note_fields(self):
		from raven.api.raven_message import get_message_batch

		original = self._send(self.audio_url, duration=7.25, waveform="0,50,100")
		row = get_message_batch(original.name)[0]
		self.assertEqual(row["audio_duration"], 7.25)
		self.assertEqual(row["audio_waveform"], "0,50,100")
