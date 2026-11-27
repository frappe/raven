# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import secrets
from typing import TYPE_CHECKING, TypedDict

import frappe
from frappe.model.document import Document
from frappe.utils import md_to_html
from werkzeug import Response

from raven.api.threads import make_thread

if TYPE_CHECKING:
	from raven.raven_messaging.doctype.raven_message.raven_message import RavenMessage


# Follow-up messages a request can post in a thread under its message
MAX_THREAD_MESSAGES = 20


class RavenIncomingWebhook(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		bot: DF.Link
		channel_id: DF.Link
		webhook_url: DF.ReadOnly | None
	# end: auto-generated types

	def autoname(self):
		self.name = f"{secrets.token_urlsafe(3 * 16)[:64]}"


@frappe.whitelist(allow_guest=True, methods=["POST", "GET"])
def handle_incoming_webhook(*args, **kwargs):
	if frappe.request.method == "GET":
		frappe.response.http_status_code = 400
		return "POST request expected"

	# Extract the last part of the path. This is the ID of the incoming webhook.
	if frappe.request.path.startswith("/api/method/"):
		webhook_id = str(frappe.request.path.strip("/").rsplit("/", maxsplit=1)[-1])
	else:
		frappe.response.http_status_code = 400
		return "invalid webhook url"

	if not frappe.db.exists("Raven Incoming Webhook", webhook_id):
		frappe.response.http_status_code = 404
		return "webhook not found"

	# Check input
	if not frappe.request.is_json:
		frappe.response.http_status_code = 400
		return "json expected"
	if not isinstance(frappe.request.json, dict):
		frappe.response.http_status_code = 400
		return "dict expected"

	# Parse payload
	data = _parse_webhook_data(frappe.request.json)

	thread = frappe.request.json.get("thread")
	if isinstance(thread, list):
		if len(thread) > MAX_THREAD_MESSAGES:
			frappe.response.http_status_code = 400
			return f"thread can have at most {MAX_THREAD_MESSAGES} messages"
		thread = _parse_thread(thread)
	else:
		thread = None

	incoming_webhook: "RavenIncomingWebhook" = frappe.get_doc("Raven Incoming Webhook", webhook_id)  # type: ignore
	message: "RavenMessage" = frappe.new_doc("Raven Message")  # type: ignore

	message.bot = incoming_webhook.bot
	message.channel_id = incoming_webhook.channel_id
	message.text = data["content"]
	message.is_bot_message = True
	message.flags.ignore_permissions = True
	# A failed thread message rolls the request back. Realtime events wait for the
	# commit, and push notifications (sent even after a rollback) wait until all are posted.
	message.flags.publish_after_commit = bool(thread)
	message.flags.send_silently = bool(thread)
	message.save()

	if thread is None:
		return Response("ok", status=201)

	if thread:
		posted = [message, *_post_thread(message, thread)]
		for posted_message in posted:
			posted_message.flags.send_silently = False
			posted_message.send_push_notification()

	return Response(
		frappe.as_json({"message_id": message.name, "thread_messages": len(thread)}),
		status=201,
		content_type="application/json",
	)


def _parse_thread(raw_thread: list) -> list[str]:
	"""Each item is a string or a dict with `content`. Empty items are dropped."""
	items = [item if isinstance(item, dict) else {"content": item} for item in raw_thread]
	return [
		_parse_webhook_data(item)["content"] for item in items if str(item.get("content") or "").strip()
	]


def _post_thread(message: "RavenMessage", thread: list[str]) -> list["RavenMessage"]:
	"""Open a thread on the message as its bot and post each item in it, silently."""
	thread_id = make_thread(message, creator=message.bot, ignore_permissions=True)["thread_id"]

	replies = []
	for content in thread:
		reply: "RavenMessage" = frappe.new_doc("Raven Message")  # type: ignore
		reply.bot = message.bot
		reply.channel_id = thread_id
		reply.text = content
		reply.is_bot_message = True
		reply.flags.publish_after_commit = True
		reply.flags.send_silently = True
		reply.flags.ignore_permissions = True
		reply.insert()
		replies.append(reply)
	return replies


def _parse_webhook_data(raw_data: dict):
	data: incoming_webhook_payload_t = {
		"content": "",
	}

	content = str(raw_data.get("content") or "")
	content = md_to_html(content) or ""
	data["content"] = content.rstrip("\n")

	if not data["content"]:
		data["content"] = "<p></p>"

	return data


class incoming_webhook_payload_t(TypedDict, total=True):
	content: str
