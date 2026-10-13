# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt
import html
import re
from collections import namedtuple

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import nowdate
from frappe.utils.jinja import validate_template
from frappe.utils.safe_exec import get_safe_globals

FORBIDDEN_DOCUMENT_TYPES = frozenset("Raven Message")


class RavenDocumentNotification(Document):
	# begin: auto-generated types
	# ruff: noqa

	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from raven.raven_integrations.doctype.raven_document_notification_recipients.raven_document_notification_recipients import (
			RavenDocumentNotificationRecipients,
		)

		condition: DF.Code | None
		do_not_attach_doc: DF.Check
		document_type: DF.Link
		enabled: DF.Check
		message: DF.Code
		notification_name: DF.Data
		recipients: DF.Table[RavenDocumentNotificationRecipients]
		send_alert_on: DF.Literal["New Document", "Update", "Submit", "Cancel", "Delete"]
		sender: DF.Link
	# ruff: noqa
	# end: auto-generated types

	def validate(self):
		self.validate_condition()
		self.validate_message()
		self.validate_document_type()
		self.validate_recipients()
		frappe.cache().hdel("raven_doc_notifications", self.document_type)

	def validate_condition(self):
		if self.condition:
			temp_doc = frappe.new_doc(self.document_type)
			try:
				frappe.safe_eval(self.condition, None, get_context(temp_doc.as_dict()))
			except Exception:
				frappe.throw(
					_("There was an error while evaluating the condition. Please fix your template.").format(
						self.document_type
					)
				)

	def validate_message(self):
		validate_template(self.get_message_template())

	def is_html_message(self) -> bool:
		"""New records come from a rich-text editor and are stored as HTML. Older ones are markdown."""
		return bool(re.search(r"<[a-zA-Z]", self.message or ""))

	def get_message_template(self) -> str:
		"""
		The message as a Jinja template. A rich-text editor HTML-escapes the text inside
		Jinja tags, turning `{% if doc.total > 100 %}` into `&gt;`, which Jinja cannot
		parse. Entities are unescaped inside the tags only; the surrounding HTML stays as is.
		"""
		template = self.message or ""
		if not self.is_html_message():
			return template
		return re.sub(r"({{.*?}}|{%.*?%})", lambda m: html.unescape(m.group(0)), template, flags=re.S)

	def validate_document_type(self):
		if self.document_type in FORBIDDEN_DOCUMENT_TYPES:
			frappe.throw(_("Notification for an event on {0} is not allowed.").format(self.document_type))

	def validate_recipients(self):
		for recipient in self.recipients:
			if recipient.channel_type == "User":
				if recipient.variable_type == "Static":
					# Check if this user exists in Raven
					if not frappe.db.exists("Raven User", recipient.value):
						frappe.throw(_("User {0} does not exist in Raven.").format(recipient.value))

			elif recipient.channel_type == "Channel":
				if recipient.variable_type == "Static":
					# Check if this channel exists in Raven
					if not frappe.db.exists("Raven Channel", recipient.value):
						frappe.throw(_("Channel {0} does not exist in Raven.").format(recipient.value))

			if recipient.variable_type == "Jinja":
				validate_template(recipient.value)
			if recipient.variable_type == "DocField":
				# Check if the field exists in the document type
				meta = frappe.get_meta(self.document_type)

				has_field = meta.has_field(recipient.value)
				if not has_field:
					if recipient.value == "owner" or recipient.value == "modified_by":
						has_field = True

				if not has_field:
					frappe.throw(
						_("Field {0} does not exist in {1}.").format(recipient.value, self.document_type)
					)

	def on_update(self):
		frappe.cache().hdel("raven_doc_notifications", self.document_type)

	def on_trash(self):
		frappe.cache().hdel("raven_doc_notifications", self.document_type)

	def send_notification(self, context, link_doctype, link_document):

		bot = frappe.get_doc("Raven Bot", self.sender)

		channels, users = self.get_recipients(context)

		is_html = self.is_html_message()
		# Notification templates are set by Raven Admins only. The renderer is sandboxed.
		# nosemgrep: frappe-ssti
		message = frappe.render_template(self.get_message_template(), context)
		# HTML is sent as is, after rendering so document values cannot inject markup either.
		# Markdown (older records) is converted by the bot.
		if is_html:
			message = frappe.utils.sanitize_html(message)

		for channel in channels:
			bot.send_message(
				channel_id=channel,
				text=message,
				link_doctype=link_doctype if not self.do_not_attach_doc else None,
				link_document=link_document if not self.do_not_attach_doc else None,
				markdown=not is_html,
				notification_name=self.name,
			)

		for user in users:
			bot.send_direct_message(
				user_id=user,
				text=message,
				link_doctype=link_doctype if not self.do_not_attach_doc else None,
				link_document=link_document if not self.do_not_attach_doc else None,
				markdown=not is_html,
				notification_name=self.name,
			)

	def get_recipients(self, context):
		"""
		Loops through all the recipients and returns the list of users and channels
		"""
		users = []
		channels = []

		def resolve_recipient(recipient):
			if recipient.variable_type == "Static":
				return recipient.value
			elif recipient.variable_type == "Jinja":
				# Recipient templates are set by Raven Admins only. The renderer is sandboxed.
				# nosemgrep: frappe-ssti
				return frappe.render_template(recipient.value, context)
			elif recipient.variable_type == "DocField":
				return context.get("doc", {}).get(recipient.value)
			else:
				frappe.throw(_("Invalid recipient variable type: {0}").format(recipient.variable_type))

		for recipient in self.recipients:
			resolved_id = resolve_recipient(recipient)
			if resolved_id:
				if recipient.channel_type == "User":
					users.append(resolved_id)
				elif recipient.channel_type == "Channel":
					channels.append(resolved_id)

		return channels, users


doctypes_to_be_ignored = [
	"Raven Document Notification",
	"Version",
	"Comment",
	"DocType",
	"Module Def",
	"Custom Field",
]


def run_document_notification(doc, method):
	"""
	Evaluate if a notification should be sent for the document.
	Enqueues the notifications to be sent on Raven
	"""
	if doc.doctype in doctypes_to_be_ignored:
		return

	if (
		frappe.flags.in_import
		or frappe.flags.in_patch
		or frappe.flags.in_install
		or frappe.flags.in_uninstall
	):
		return

	def _get_notifications():
		"""Returns all enabled notifications for the document type"""
		notifications = frappe.get_all(
			"Raven Document Notification",
			filters={"document_type": doc.doctype, "enabled": 1},
			fields=["name", "send_alert_on", "condition"],
		)
		return notifications

	raven_notifications = frappe.cache().hget(
		"raven_doc_notifications", doc.doctype, _get_notifications
	)

	if not raven_notifications:
		# No notifications found for the document type
		return

	event_map = {
		"on_update": "Update",
		"after_insert": "New Document",
		"on_submit": "Submit",
		"on_cancel": "Cancel",
		"on_trash": "Delete",
	}

	# TODO: Add value change event
	# if not doc.flags.in_insert or not doc.flags.in_delete:
	# 	# Value change is for update only
	# 	event_map["on_change"] = "Value Change"

	notifications_to_send = []

	for notification in raven_notifications:
		event = event_map.get(method, None)
		if event and event == notification.send_alert_on:
			context = get_context(doc)
			# If the alert has a condition, evaluate it
			if notification.condition:
				if not evaluate_condition(context, notification.condition, notification.name):
					continue

			notifications_to_send.append(notification)

	if not notifications_to_send:
		return

	frappe.enqueue(
		send_raven_notifications,
		doc=doc,
		notifications_to_send=notifications_to_send,
		link_doctype=doc.doctype,
		link_document=doc.name,
		enqueue_after_commit=True,
	)


def evaluate_condition(context, condition, notification_name):
	from jinja2 import TemplateError

	try:
		return frappe.safe_eval(condition, None, context)
	except TemplateError:
		message = _("Error while evaluating Raven Notification {0}. Please fix your template.").format(
			frappe.utils.get_link_to_form("Raven Document Notification", notification_name)
		)
		frappe.throw(message, title=_("Error in Raven Notification"))
	except Exception as e:
		title = str(e)
		message = frappe.get_traceback(with_context=True)
		frappe.log_error(
			title=title,
			message=message,
			reference_doctype="Raven Document Notification",
			reference_name=notification_name,
		)
		msg = f"<details><summary>{title}</summary>{message}</details>"
		frappe.throw(msg, title=_("Error in Raven Notification"))


def send_raven_notifications(doc, notifications_to_send, link_doctype, link_document):
	"""
	Background job to send notifications to Raven
	"""
	context = get_context(doc)
	for notification in notifications_to_send:
		notification_doc = frappe.get_doc("Raven Document Notification", notification.name)
		notification_doc.send_notification(context, link_doctype, link_document)


def get_context(doc):
	Frappe = namedtuple("Frappe", ["frappe"])
	frappe = Frappe(frappe=get_safe_globals().get("frappe"))
	return {
		"doc": doc,
		"nowdate": nowdate,
		"frappe": frappe.frappe,
	}
