# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# See license.txt

import json
from unittest.mock import patch

import frappe
from bs4 import BeautifulSoup
from frappe.tests.utils import FrappeTestCase

from raven.raven_messaging.doctype.raven_message.raven_message import (
	get_last_message_details,
	get_text_and_emoji_positions,
)

EMOJI = '<img data-type="customEmoji" src="https://example.com/{0}.png" alt=":{0}:" class="emoji">'


def parsed_message(html):
	message = frappe.get_doc(
		{"doctype": "Raven Message", "message_type": "Text", "text": html, "owner": "Administrator"}
	)
	message.parse_html_content()
	return message


def emoji_positions(html):
	return get_text_and_emoji_positions(BeautifulSoup(html, "html.parser"), html)


def teaser(html):
	return json.loads(get_last_message_details(parsed_message(html)))


class TestRavenMessage(FrappeTestCase):
	def test_content_keeps_custom_emoji_shortcode_in_text(self):
		self.assertEqual(parsed_message(f"<p>hi {EMOJI.format('party')}</p>").content, "hi :party:")

	def test_typed_shortcode_next_to_same_real_emoji(self):
		html = f"<p>:party: {EMOJI.format('party')} a:party: :party:</p>"
		self.assertEqual(emoji_positions(html), (":party: :party: a:party: :party:", [1]))

	def test_custom_emoji_in_spoiler_is_hidden(self):
		html = f'<p><span data-spoiler="true">{EMOJI.format("party")}</span></p>'
		self.assertEqual(emoji_positions(html), ("▒▒▒▒▒▒", []))

	def test_message_holding_the_mark_gets_no_positions(self):
		html = f"<p>\ue000 {EMOJI.format('party')}</p>"
		self.assertEqual(emoji_positions(html)[1], [])

	def test_teaser_has_positions_only(self):
		details = teaser(f"<p>{EMOJI.format('party')} :typed: {EMOJI.format('cat')}</p>")
		self.assertEqual(details["content"], ":party: :typed: :cat:")
		self.assertEqual(details["custom_emoji_positions"], [0, 2])
		self.assertNotIn("example.com", json.dumps(details))

	def test_plain_teaser_has_no_positions(self):
		self.assertNotIn("custom_emoji_positions", teaser("<p>hello :typed:</p>"))

	def test_teaser_reuses_positions_from_the_save_parse(self):
		message = parsed_message(f"<p>:party: {EMOJI.format('party')}</p>")
		with patch(f"{get_last_message_details.__module__}.BeautifulSoup", side_effect=AssertionError):
			details = json.loads(get_last_message_details(message))
		self.assertEqual(details["custom_emoji_positions"], [1])

	def test_teaser_ignores_positions_from_other_html(self):
		message = parsed_message(f"<p>:party: {EMOJI.format('party')}</p>")
		message.flags.emoji_positions = ("<p>older text</p>", [0])
		self.assertEqual(json.loads(get_last_message_details(message))["custom_emoji_positions"], [1])
