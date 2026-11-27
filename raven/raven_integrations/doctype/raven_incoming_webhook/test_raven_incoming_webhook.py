# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# For license information, please see license.txt

import json
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import set_request

from raven.raven_integrations.doctype.raven_incoming_webhook.raven_incoming_webhook import (
	handle_incoming_webhook,
)
from raven.raven_messaging.doctype.raven_message.raven_message import RavenMessage

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class IntegrationTestRavenIncomingWebhook(IntegrationTestCase):
	def setUp(self):
		frappe.get_doc("User", "test@example.com").add_roles("Raven Admin", "Raven User")
		frappe.set_user("test@example.com")
		workspace = frappe.get_doc(
			{"doctype": "Raven Workspace", "workspace_name": "Webhook Workspace", "type": "Public"}
		).insert()
		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "webhook-alerts",
				"type": "Public",
				"workspace": workspace.name,
			}
		).insert()
		self.bot = frappe.get_doc({"doctype": "Raven Bot", "bot_name": "Webhook Test Bot"}).insert()
		self.webhook = frappe.get_doc(
			{
				"doctype": "Raven Incoming Webhook",
				"bot": self.bot.raven_user,
				"channel_id": self.channel.name,
			}
		).insert()
		frappe.set_user("Guest")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def post(self, payload):
		set_request(
			method="POST",
			path=f"/api/method/raven.raven_integrations.doctype.raven_incoming_webhook.raven_incoming_webhook.handle_incoming_webhook/{self.webhook.name}",
			data=json.dumps(payload),
			content_type="application/json",
		)
		frappe.response.http_status_code = None
		return handle_incoming_webhook()

	def channel_messages(self, channel_id):
		return frappe.get_all(
			"Raven Message",
			filters={"channel_id": channel_id, "message_type": "Text"},
			fields=["name", "text", "bot", "is_thread"],
			order_by="creation asc",
		)

	def test_request_without_thread_is_unchanged(self):
		response = self.post({"content": "Daily summary"})

		self.assertEqual(response.status_code, 201)
		self.assertEqual(response.get_data(as_text=True), "ok")
		(message,) = self.channel_messages(self.channel.name)
		self.assertEqual(message.text, "<p>Daily summary</p>")
		self.assertFalse(message.is_thread)

	def test_thread_is_posted_under_the_message(self):
		response = self.post(
			{
				"content": "Daily summary",
				"thread": [{"content": "New customers"}, "Apps", "Existing customers"],
			}
		)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(response.content_type, "application/json")
		(message,) = self.channel_messages(self.channel.name)
		self.assertEqual(
			json.loads(response.get_data()), {"message_id": message.name, "thread_messages": 3}
		)
		self.assertTrue(message.is_thread)

		replies = self.channel_messages(message.name)
		self.assertEqual(
			[reply.text for reply in replies],
			["<p>New customers</p>", "<p>Apps</p>", "<p>Existing customers</p>"],
		)
		self.assertEqual({reply.bot for reply in replies}, {self.bot.raven_user})

		members = frappe.get_all(
			"Raven Channel Member", filters={"channel_id": message.name}, pluck="user_id"
		)
		self.assertEqual(members, [self.bot.raven_user])

	def test_user_mentioned_in_a_thread_message_joins_the_thread(self):
		mention = '<span class="mention" data-type="userMention" data-id="test@example.com">@test</span>'
		self.post({"content": "Daily summary", "thread": [f"{mention} please check", "Apps"]})

		(message,) = self.channel_messages(self.channel.name)
		members = frappe.get_all(
			"Raven Channel Member", filters={"channel_id": message.name}, pluck="user_id"
		)
		self.assertIn("test@example.com", members)

	def test_push_notifications_wait_for_the_whole_thread(self):
		notified = []

		def record(message):
			if message.message_type != "System":
				notified.append((message.text, bool(message.flags.send_silently)))

		with patch.object(RavenMessage, "send_push_notification", record):
			self.post({"content": "Daily summary", "thread": ["Apps"]})

		self.assertEqual(
			notified,
			[
				("<p>Daily summary</p>", True),
				("<p>Apps</p>", True),
				("<p>Daily summary</p>", False),
				("<p>Apps</p>", False),
			],
		)

	def test_realtime_events_wait_for_the_commit(self):
		with patch("frappe.publish_realtime") as publish_realtime:
			self.post({"content": "Daily summary", "thread": ["Apps"]})

		message_events = [
			call
			for call in publish_realtime.call_args_list
			if call.args[0] in ("message_created", "message_edited")
			and call.args[1]["message_details"]["message_type"] != "System"
		]
		self.assertEqual(len(message_events), 3)  # main message, its thread flag, the reply
		self.assertTrue(all(call.kwargs["after_commit"] for call in message_events))

	def test_webhook_on_a_direct_message_channel_opens_a_thread(self):
		frappe.set_user("Administrator")
		# A bot named after the user sorts first in the DM, where the peer was once read wrongly.
		bot = frappe.get_doc({"doctype": "Raven Bot", "bot_name": "zz-dm-bot"}).insert()
		dm = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": f"{bot.raven_user} _ test@example.com",
				"is_direct_message": 1,
			}
		).insert()
		self.webhook.db_set({"channel_id": dm.name, "bot": bot.raven_user})
		frappe.set_user("Guest")

		response = self.post({"content": "Daily summary", "thread": ["Apps"]})

		(message,) = self.channel_messages(dm.name)
		self.assertEqual(json.loads(response.get_data())["thread_messages"], 1)
		members = frappe.get_all(
			"Raven Channel Member", filters={"channel_id": message.name}, pluck="user_id"
		)
		self.assertCountEqual(members, [bot.raven_user, "test@example.com"])

	def test_more_than_twenty_thread_messages_posts_nothing(self):
		self.post({"content": "Daily summary", "thread": ["Reply"] * 21})

		self.assertEqual(frappe.response.http_status_code, 400)
		self.assertEqual(self.channel_messages(self.channel.name), [])

	def test_empty_thread_messages_are_dropped(self):
		response = self.post(
			{"content": "Daily summary", "thread": ["", {"content": "  "}, None, "Apps"]}
		)

		(message,) = self.channel_messages(self.channel.name)
		self.assertEqual(json.loads(response.get_data())["thread_messages"], 1)
		self.assertEqual([reply.text for reply in self.channel_messages(message.name)], ["<p>Apps</p>"])

	def test_thread_with_only_empty_messages_opens_no_thread(self):
		response = self.post({"content": "Daily summary", "thread": [""]})

		(message,) = self.channel_messages(self.channel.name)
		self.assertEqual(
			json.loads(response.get_data()), {"message_id": message.name, "thread_messages": 0}
		)
		self.assertFalse(message.is_thread)

	def test_failed_thread_message_posts_nothing(self):
		original_insert = RavenMessage.insert

		def fail_on_second_reply(message, *args, **kwargs):
			if message.text == "<p>Apps</p>":
				raise frappe.ValidationError("reply failed")
			return original_insert(message, *args, **kwargs)

		# The request rolls back on an error; this savepoint stands in for it, and
		# fails if anything was committed on the way.
		frappe.db.savepoint("before_webhook")
		with patch.object(RavenMessage, "insert", fail_on_second_reply):
			with self.assertRaises(frappe.ValidationError):
				self.post({"content": "Daily summary", "thread": ["New customers", "Apps"]})
		frappe.db.rollback(save_point="before_webhook")

		self.assertEqual(self.channel_messages(self.channel.name), [])
		self.assertFalse(
			frappe.db.exists("Raven Channel", {"is_thread": 1, "workspace": self.channel.workspace})
		)
