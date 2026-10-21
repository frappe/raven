# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class RavenWebhook(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.integrations.doctype.webhook_data.webhook_data import WebhookData
		from frappe.integrations.doctype.webhook_header.webhook_header import WebhookHeader
		from frappe.types import DF

		channel_id: DF.Link | None
		channel_type: DF.Literal["", "Public", "Private", "Open", "DM", "Self Message"]
		condition: DF.SmallText | None
		conditions_on: DF.Literal["", "Channel", "User", "Channel Type", "Custom"]
		enable_security: DF.Check
		enabled: DF.Check
		is_dynamic_url: DF.Check
		request_url: DF.Data
		timeout: DF.Int
		trigger_webhook_on_condition: DF.Check
		user: DF.Link | None
		webhook: DF.Link | None
		webhook_data: DF.Table[WebhookData]
		webhook_headers: DF.Table[WebhookHeader]
		webhook_secret: DF.Password | None
		webhook_trigger: DF.Literal[
			"Message Sent",
			"Message Edited",
			"Message Deleted",
			"Message Reacted On",
			"Channel Created",
			"Channel Deleted",
			"Channel Member Added",
			"Channel Member Deleted",
			"User Added",
			"User Deleted",
		]
	# end: auto-generated types

	def before_insert(self):
		# 1. Check if webhook name is unique
		webhook = frappe.get_all("Raven Webhook", filters={"name": self.name})
		if webhook:
			frappe.throw(_("Webhook name already exists"))

	def validate(self):
		# 1. Check if webhook_data and webhook_headers are unique

		webhook_data_keys = [data.key for data in self.webhook_data]
		webhook_header_keys = [data.key for data in self.webhook_headers]
		if len(webhook_data_keys) != len(set(webhook_data_keys)):
			frappe.throw(_("Webhook Data keys should be unique"))
		if len(webhook_header_keys) != len(set(webhook_header_keys)):
			frappe.throw(_("Webhook Headers keys should be unique"))

	def before_save(self):
		# 1. Check if webhook ID is exists
		# 2. If exist then update the webhook
		# 3. If not exist then create the webhook

		# 1. Check if webhook ID is exists
		if self.webhook:
			# 2. Update the webhook
			self.update_webhook()

		else:
			# 3. Create the webhook
			self.create_webhook()

	def on_trash(self):
		# Delete the webhook
		if self.webhook:
			frappe.db.delete("Webhook", self.webhook)

	def create_webhook(self):
		# Create a new webhook

		doctype, event = self.get_doctype_and_event()
		conditions = self.get_conditions()
		webhook_doc = frappe.new_doc("Webhook")
		webhook_doc.name = self.name
		webhook_doc.request_url = self.request_url
		webhook_doc.is_dynamic_url = self.is_dynamic_url
		webhook_doc.timeout = self.timeout
		webhook_doc.enable_security = self.enable_security
		webhook_doc.webhook_secret = self.webhook_secret
		webhook_doc.request_method = "POST"
		webhook_doc.request_structure = "Form URL-Encoded"
		self.set_webhook_data_and_headers(webhook_doc)
		webhook_doc.webhook_doctype = doctype
		webhook_doc.webhook_docevent = event
		webhook_doc.condition = conditions
		webhook_doc.insert()
		self.webhook = webhook_doc.name

	def update_webhook(self):
		# Update the webhook

		conditions = self.get_conditions()
		webhook_doc = frappe.get_doc("Webhook", self.webhook)
		webhook_doc.request_url = self.request_url
		webhook_doc.is_dynamic_url = self.is_dynamic_url
		webhook_doc.timeout = self.timeout
		webhook_doc.enable_security = self.enable_security
		webhook_doc.webhook_secret = self.webhook_secret
		webhook_doc.condition = conditions
		self.set_webhook_data_and_headers(webhook_doc)
		webhook_doc.save()

	def set_webhook_data_and_headers(self, webhook_doc):
		"""
		Set the webhook data and headers
		"""
		# get the existing webhook data and headers keys
		webhook_data_keys = [data.key for data in webhook_doc.webhook_data]
		webhook_header_keys = [data.key for data in webhook_doc.webhook_headers]

		# remove the existing webhook data and headers
		# which are not in the current webhook data and headers
		# and append the new webhook data and headers
		for data in self.webhook_data:
			if data.key not in webhook_data_keys:
				webhook_doc.append(
					"webhook_data",
					{
						"key": data.key,
						"fieldname": data.fieldname,
					},
				)

		for data in self.webhook_headers:
			if data.key not in webhook_header_keys:
				webhook_doc.append(
					"webhook_headers",
					{
						"key": data.key,
						"value": data.value,
					},
				)

	def get_doctype_and_event(self):
		doctypes_and_events = [
			{
				"label": "Message Sent",
				"doctype": "Raven Message",
				"event": "after_insert",
			},
			{"label": "Message Edited", "doctype": "Raven Message", "event": "on_update"},
			{"label": "Message Deleted", "doctype": "Raven Message", "event": "on_trash"},
			{"label": "Message Reacted On", "doctype": "Raven Message Reaction", "event": "after_insert"},
			{"label": "Channel Created", "doctype": "Raven Channel", "event": "after_insert"},
			{"label": "Channel Deleted", "doctype": "Raven Channel", "event": "on_trash"},
			{
				"label": "Member Added to the Channel",
				"doctype": "Raven Channel Member",
				"event": "after_insert",
			},
			{
				"label": "Member Deleted from the Channel",
				"doctype": "Raven Channel Member",
				"event": "on_trash",
			},
			{"label": "User Added", "doctype": "Raven User", "event": "after_insert"},
			{"label": "User Deleted", "doctype": "Raven User", "event": "on_trash"},
		]
		doctype, event = None, None
		for doctype_and_event in doctypes_and_events:
			if self.webhook_trigger == doctype_and_event["label"]:
				doctype = doctype_and_event["doctype"]
				event = doctype_and_event["event"]
				break
		return doctype, event

	def get_conditions(self):
		# Get the conditions for the webhook
		doctype, event = self.get_doctype_and_event()
		if self.trigger_webhook_on_condition:
			if self.conditions_on == "Channel":
				if doctype == "Raven Channel":
					# return 'doc.name == self.channel_id'
					return f'doc.name == "{self.channel_id}"'
				elif doctype == "Raven Channel Member":
					return f'doc.channel_id == "{self.channel_id}"'
				elif doctype == "Raven Message":
					return f'doc.channel_id == "{self.channel_id}"'
				elif doctype == "Raven Message Reaction":
					frappe.throw(_("Message Reaction cannot be triggered on Channel"))
				elif doctype == "Raven User":
					frappe.throw(_("Raven User cannot be triggered on Channel"))

			elif self.conditions_on == "User":
				if doctype == "Raven Channel":
					frappe.throw(_("Channel cannot be triggered on User"))
				elif doctype == "Raven Channel Member":
					return f'doc.user_id == "{self.user}"'
				elif doctype == "Raven Message":
					return f'doc.owner == "{self.user}"'
				elif doctype == "Raven Message Reaction":
					return f'doc.owner == "{self.user}"'

			elif self.conditions_on == "Channel Type":
				if doctype == "Raven Channel":
					if self.channel_type in ["Public", "Private", "Open"]:
						return f'doc.type == "{self.channel_type}"'
					elif self.channel_type == "DM":
						return "doc.is_direct_message == 1"
					elif self.channel_type == "Self Message":
						return "doc.is_self_message == 1"
					else:
						frappe.throw(_("Invalid Channel Type"))
				else:
					frappe.throw(_("Channel Type cannot be triggered on other doctypes"))
			elif self.conditions_on == "Custom":
				return self.condition

		return None
