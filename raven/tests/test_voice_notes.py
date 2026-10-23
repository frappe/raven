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


def voice_payload(message):
	return frappe.parse_json(message.json) if isinstance(message.json, str) else message.json


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
		# The recorder auto-stops at 600 s; stop latency lands a max-length clip just past it
		self.assertEqual(_sane_duration(600.3), 600.3)
		for junk in (0, -1, 661, float("nan"), float("inf"), "abc", None, [1], True):
			self.assertIsNone(_sane_duration(junk), junk)

	def test_sane_waveform(self):
		self.assertEqual(_sane_waveform([0, 50, 100]), [0, 50, 100])
		self.assertEqual(_sane_waveform([-5, 150, 42.6]), [0, 100, 43])
		self.assertEqual(_sane_waveform([1, "x", None, True, float("inf"), 2]), [1, 2])
		self.assertEqual(len(_sane_waveform([10] * 500)), 64)
		self.assertEqual(_sane_waveform([]), [])
		for junk in ("1,2", None, 12, {"a": 1}):
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

	def _send(self, file_url, voice=None, **kwargs):
		file = {"file_url": file_url, "file_size": 1}
		if voice is not None:
			file["voice"] = voice
		return send_message_with_attachments(channel_id=self.channel.name, files=[file], **kwargs)[0]

	def test_voice_payload_makes_a_voice_message(self):
		message = self._send(self.audio_url, {"duration": 7.25, "waveform": [0, 50, 100]})
		self.assertEqual(message.message_type, "Voice")
		self.assertEqual(voice_payload(message), {"duration": 7.25, "waveform": [0, 50, 100]})

	def test_unusable_waveform_still_makes_a_voice_message(self):
		message = self._send(self.audio_url, {"duration": 3, "waveform": "abc"})
		self.assertEqual(message.message_type, "Voice")
		self.assertEqual(voice_payload(message), {"duration": 3.0, "waveform": []})

	def test_junk_duration_falls_back_to_a_file(self):
		message = self._send(self.audio_url, {"duration": -3, "waveform": [1, 2]})
		self.assertEqual(message.message_type, "File")
		self.assertFalse(message.json)

	def test_voice_payload_on_non_audio_is_ignored(self):
		message = self._send(self.text_url, {"duration": 5, "waveform": [1, 2]})
		self.assertEqual(message.message_type, "File")
		self.assertFalse(message.json)

	def test_audio_without_voice_payload_is_a_file(self):
		self.assertEqual(self._send(self.audio_url).message_type, "File")

	def test_notification_text(self):
		message = self._send(self.audio_url, {"duration": 67.4, "waveform": [1]})
		self.assertEqual(message.get_notification_message_content(), "🎤 Sent a voice note (1:07)")

	def test_reply_snapshot_carries_the_voice_payload(self):
		original = self._send(self.audio_url, {"duration": 7.25, "waveform": [0, 50, 100]})
		reply = send_message_with_attachments(
			channel_id=self.channel.name, content="<p>nice</p>", is_reply=True, linked_message=original.name
		)[0]
		details = frappe.parse_json(reply.replied_message_details)
		self.assertEqual(details["message_type"], "Voice")
		self.assertEqual(details["json"], {"duration": 7.25, "waveform": [0, 50, 100]})

	def test_forwarded_voice_reply_keeps_payload(self):
		from raven.api.raven_message import forward_message

		text = send_message_with_attachments(channel_id=self.channel.name, content="<p>q</p>")[0]
		original = self._send(
			self.audio_url,
			{"duration": 7.25, "waveform": [0, 50, 100]},
			is_reply=True,
			linked_message=text.name,
		)
		forward_message(
			message_receivers=[{"type": "Channel", "name": self.channel.name}], message_id=original.name
		)
		copy = frappe.get_all(
			"Raven Message",
			filters={"is_forwarded": 1, "channel_id": self.channel.name},
			fields=["message_type", "json", "text", "is_reply"],
		)[0]
		self.assertEqual(copy.message_type, "Voice")
		self.assertEqual(frappe.parse_json(copy.json), {"duration": 7.25, "waveform": [0, 50, 100]})
		self.assertFalse(copy.text)
		self.assertFalse(copy.is_reply)

	def test_forwarded_voice_note_keeps_payload(self):
		from raven.api.raven_message import forward_message

		original = self._send(self.audio_url, {"duration": 7.25, "waveform": [0, 50, 100]})
		forward_message(
			message_receivers=[{"type": "Channel", "name": self.channel.name}], message_id=original.name
		)
		copy = frappe.get_all(
			"Raven Message",
			filters={"is_forwarded": 1, "channel_id": self.channel.name},
			fields=["message_type", "json", "file"],
		)[0]
		self.assertEqual(copy.message_type, "Voice")
		self.assertEqual(frappe.parse_json(copy.json), {"duration": 7.25, "waveform": [0, 50, 100]})
		self.assertEqual(copy.file, self.audio_url)
