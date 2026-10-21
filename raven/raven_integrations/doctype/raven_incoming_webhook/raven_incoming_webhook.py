# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import secrets
from typing import TYPE_CHECKING, TypedDict

import frappe
from frappe.model.document import Document
from frappe.utils import md_to_html
from werkzeug import Response

if TYPE_CHECKING:
	from raven.raven_messaging.doctype.raven_message.raven_message import RavenMessage


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

	incoming_webhook: "RavenIncomingWebhook" = frappe.get_doc("Raven Incoming Webhook", webhook_id)  # type: ignore
	message: "RavenMessage" = frappe.new_doc("Raven Message")  # type: ignore

	message.bot = incoming_webhook.bot
	message.channel_id = incoming_webhook.channel_id
	message.text = data["content"]
	message.is_bot_message = True
	message.flags.ignore_permissions = True
	message.save()

	return Response("ok", status=201)


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
