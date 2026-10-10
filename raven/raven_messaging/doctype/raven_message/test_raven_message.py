# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

EXTRA_TEST_RECORD_DEPENDENCIES = ["Raven Workspace"]

EMOJI = '<img data-type="customEmoji" src="/files/x.png" alt=":{0}:" class="emoji">'
MENTION = '<span data-type="userMention" data-id="{0}">@{0}</span>'


def content_of(html):
	message = frappe.get_doc({"doctype": "Raven Message", "message_type": "Text", "text": html})
	message.parse_html_content()
	return message.content


class TestRavenMessage(FrappeTestCase):
	def test_custom_emoji_shortcode_in_text(self):
		self.assertEqual(content_of(f"<p>hi {EMOJI.format('party')} there</p>"), "hi :party: there")
		self.assertEqual(content_of(f"<p>{EMOJI.format('what?')}</p>"), ":what?:")

	def test_code_keeps_its_backticks(self):
		self.assertEqual(content_of("<p>run <code>:party:</code> now</p>"), "run `:party:` now")
		self.assertEqual(content_of("<pre><code>x = 1</code></pre>"), "`x = 1`")

	def test_literal_backticks_never_read_as_code_markers(self):
		# A backtick in the message (inside code or out) becomes the lookalike
		# modifier grave, so the preview's marker pairing stays exact.
		self.assertEqual(content_of("<p>press ` now</p>"), "press ˋ now")
		self.assertEqual(content_of("<p>run <code>x ` :party:</code></p>"), "run `x ˋ :party:`")

	def test_custom_emoji_in_spoiler_is_hidden(self):
		html = f'<p><span data-spoiler="true">{EMOJI.format("party")}</span></p>'
		self.assertEqual(content_of(html), "▒▒▒▒▒▒")

	def test_gif_only_message(self):
		self.assertEqual(content_of('<p><img src="https://media.tenor.com/a.gif"></p>'), "Sent a GIF")

	def test_editing_keeps_read_state_of_unchanged_mentions(self):
		channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "mention-edit-test",
				"type": "Public",
				"workspace": "Public Workspace",
			}
		).insert()
		self.addCleanup(frappe.delete_doc, "Raven Channel", channel.name, force=True)

		message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": channel.name,
				"message_type": "Text",
				"text": f"<p>hi {MENTION.format('test@example.com')}</p>",
			}
		).insert()

		# The user viewed the mention, then the message gets edited.
		frappe.db.set_value("Raven Mention", message.mentions[0].name, "is_read", 1)
		message.reload()
		message.text = (
			f"<p>hello {MENTION.format('test@example.com')} {MENTION.format('test1@example.com')}</p>"
		)
		message.save()

		read_by_user = {mention.user: mention.is_read for mention in message.mentions}
		self.assertEqual(read_by_user["test@example.com"], 1)
		self.assertEqual(read_by_user["test1@example.com"], 0)
