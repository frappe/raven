# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# See license.txt

import json
from unittest.mock import patch

import frappe
from bs4 import BeautifulSoup
from frappe.tests.utils import FrappeTestCase

from raven.raven_messaging.doctype.raven_message.raven_message import (
	get_last_message_details,
	get_text_and_custom_emojis,
)

EMOJI = '<img data-type="customEmoji" src="https://example.com/x.png" alt=":{0}:" class="emoji">'


def parsed_message(html):
	message = frappe.get_doc(
		{"doctype": "Raven Message", "message_type": "Text", "text": html, "owner": "Administrator"}
	)
	message.parse_html_content()
	return message


def text_and_emojis(html):
	return get_text_and_custom_emojis(BeautifulSoup(html, "html.parser"), html)


def teaser(html):
	return json.loads(get_last_message_details(parsed_message(html)))


class TestRavenMessage(FrappeTestCase):
	def test_content_keeps_custom_emoji_shortcode_in_text(self):
		self.assertEqual(parsed_message(f"<p>hi {EMOJI.format('party')}</p>").content, "hi :party:")

	def test_typed_shortcode_next_to_same_real_emoji(self):
		html = f"<p>:party: {EMOJI.format('party')} a:party: :party:</p>"
		self.assertEqual(text_and_emojis(html), (":party: :party: a:party: :party:", [[":party:", 1]]))

	def test_any_emoji_name(self):
		names = ["q!", "what?", ":finding:", "café"]
		html = "<p>" + " ".join(EMOJI.format(name) for name in names) + "</p>"
		self.assertEqual(text_and_emojis(html)[1], [[f":{name}:", 0] for name in names])

	def test_custom_emoji_in_spoiler_is_hidden(self):
		html = f'<p><span data-spoiler="true">{EMOJI.format("party")}</span></p>'
		self.assertEqual(text_and_emojis(html), ("▒▒▒▒▒▒", []))

	def test_message_holding_the_mark_keeps_it(self):
		html = f"<p>\ue000 {EMOJI.format('party')}</p>"
		self.assertEqual(text_and_emojis(html), ("\ue000 :party:", []))

	def test_teaser_lists_real_emojis_only(self):
		details = teaser(f"<p>{EMOJI.format('party')} :party: {EMOJI.format('party')}</p>")
		self.assertEqual(details["content"], ":party: :party: :party:")
		self.assertEqual(details["custom_emojis"], [[":party:", 0], [":party:", 2]])
		self.assertNotIn("example.com", json.dumps(details))

	def test_plain_teaser_has_no_emojis(self):
		self.assertNotIn("custom_emojis", teaser("<p>hello :typed:</p>"))

	def test_teaser_reuses_emojis_from_the_save_parse(self):
		message = parsed_message(f"<p>:party: {EMOJI.format('party')}</p>")
		with patch(f"{get_last_message_details.__module__}.BeautifulSoup", side_effect=AssertionError):
			details = json.loads(get_last_message_details(message))
		self.assertEqual(details["custom_emojis"], [[":party:", 1]])

	def test_teaser_ignores_emojis_from_other_html(self):
		message = parsed_message(f"<p>:party: {EMOJI.format('party')}</p>")
		message.flags.custom_emojis = ("<p>older text</p>", [[":party:", 0]])
		self.assertEqual(
			json.loads(get_last_message_details(message))["custom_emojis"], [[":party:", 1]]
		)
