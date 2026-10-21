# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import json
import re

import frappe
from frappe.model.document import Document


class RavenSchedulerEvent(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		bot: DF.Link
		channel: DF.Link
		content: DF.HTMLEditor
		cron_expression: DF.Data | None
		disabled: DF.Check
		dm: DF.Link | None
		event_frequency: DF.Literal["Every Day", "Every Day of the week", "Date of the month", "Cron"]
		event_name: DF.Data
		scheduler_event_id: DF.Link | None
		send_to: DF.Literal["Channel", "DM"]
	# end: auto-generated types

	def before_save(self):
		"""
		1. If the 'scheduler_event_id' is not set, create a Server Script of type 'Scheduler Event' and set the 'scheduler_event_id' to the name of the Server Script.
		"""
		if not self.scheduler_event_id:
			self.scheduler_event_id = self.create_scheduler_event()
		else:
			server_script = frappe.get_doc("Server Script", self.scheduler_event_id)
			server_script.cron_format = self.cron_expression
			server_script.script = self.get_scheduler_event_script()
			server_script.save()

	def on_update(self):
		"""
		1. If the 'scheduler_event_id' is set, and the 'disabled' field is updated, update the 'disabled' field of the Server Script of type 'Scheduler Event' with the name 'scheduler_event_id'.
		"""
		if self.scheduler_event_id:
			server_script = frappe.get_doc("Server Script", self.scheduler_event_id)
			server_script.disabled = self.disabled
			server_script.save()

	def on_trash(self):
		"""
		1. If the 'scheduler_event_id' is set, delete the Server Script of type 'Scheduler Event' with the name 'scheduler_event_id'.
		"""
		if self.scheduler_event_id:
			frappe.db.delete("Server Script", self.scheduler_event_id)

	def create_scheduler_event(self):
		"""
		Create a Server Script of type 'Scheduler Event' and set the 'scheduler_event_id' to the name of the Server Script.
		"""
		server_script = frappe.get_doc(
			{
				"doctype": "Server Script",
				"script_type": "Scheduler Event",
				"name": self.event_name,
				"disabled": 0,
				"event_frequency": "Cron",
				"cron_format": self.cron_expression,
				"script": self.get_scheduler_event_script(),
			}
		)
		server_script.insert()
		return server_script.name

	def get_scheduler_event_script(self):
		"""
		Get the script for the Scheduler Event
		"""
		# Messages are HTML. New records come from a rich-text editor and are stored as
		# HTML already; sanitising strips anything a message must not carry (scripts, etc).
		# Older records hold plain text from a textarea: each line becomes its own
		# paragraph, the shape the composer saves multi-line text in, with "<" escaped.
		content_html = self.content or ""
		if re.search(r"<[a-zA-Z]", content_html):
			content_html = frappe.utils.sanitize_html(content_html)
		else:
			lines = content_html.splitlines() or [""]
			content_html = "".join(f"<p>{frappe.utils.escape_html(line)}</p>" for line in lines)
		content = json.dumps(content_html)
		script = f"""
bot = frappe.get_doc('Raven Bot', '{self.bot}')\n
bot.send_message('{self.channel}', {content})
"""
		return script
