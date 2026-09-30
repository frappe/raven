# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# See license.txt

import json

import frappe
from frappe.tests.utils import FrappeTestCase

from raven.raven_messaging.doctype.raven_message.raven_message import (
	get_custom_emojis,
	get_last_message_details,
)

EMOJI = '<img data-type="customEmoji" src="/files/{0}.png" alt=":{0}:" class="emoji">'


class TestRavenMessage(FrappeTestCase):
	def test_custom_emojis_from_html(self):
		html = f"<p>hi {EMOJI.format('party')} :typed: {EMOJI.format('cat')}{EMOJI.format('party')}</p>"
		self.assertEqual(get_custom_emojis(html), {"party": "/files/party.png", "cat": "/files/cat.png"})

	def test_no_custom_emojis(self):
		self.assertEqual(get_custom_emojis(None), {})
		self.assertEqual(get_custom_emojis("<p>:party:</p>"), {})

	def test_last_message_details_lists_only_real_emojis(self):
		message = frappe._dict(
			name="msg-1",
			content=":party: :typed:",
			text=f"<p>{EMOJI.format('party')} :typed:</p>",
			message_type="Text",
			owner="Administrator",
			is_bot_message=0,
			bot=None,
		)
		self.assertEqual(
			json.loads(get_last_message_details(message))["custom_emojis"], {"party": "/files/party.png"}
		)

		message.text = "<p>:party:</p>"
		self.assertNotIn("custom_emojis", json.loads(get_last_message_details(message)))
