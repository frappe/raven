# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _, is_whitelisted
from frappe.model.document import Document


class RavenMessageAction(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from raven.raven_integrations.doctype.raven_message_action_fields.raven_message_action_fields import (
			RavenMessageActionFields,
		)

		action: DF.Literal["Create Document", "Custom Function", "Server Script"]
		action_name: DF.Data
		custom_function_path: DF.SmallText | None
		description: DF.SmallText | None
		document_type: DF.Link | None
		enabled: DF.Check
		fields: DF.Table[RavenMessageActionFields]
		server_script: DF.Link | None
		success_message: DF.SmallText | None
		title: DF.Data
	# end: auto-generated types

	def validate(self):

		self.validate_action_type()
		self.validate_custom_function_path()
		self.validate_server_script()
		self.validate_doctype_fields()

	def validate_action_type(self):
		if self.action == "Create Document":
			if not self.document_type:
				frappe.throw(_("Document Type is required."))
		elif self.action == "Custom Function":
			if not self.custom_function_path:
				frappe.throw(_("Function Path is required."))
		elif self.action == "Server Script":
			if not self.server_script:
				frappe.throw(_("Server Script is required."))

	def validate_custom_function_path(self):
		if self.action == "Custom Function":
			f = frappe.get_attr(self.custom_function_path)
			if not f:
				frappe.throw(_("Function {0} not found.").format(self.custom_function_path))

			is_whitelisted(f)

	def validate_server_script(self):
		if self.action == "Server Script":
			script = frappe.get_doc("Server Script", self.server_script)
			if script.script_type != "API":
				frappe.throw(_("Server Script must be of type API."))
			if script.disabled:
				frappe.throw(_("Server Script {0} is disabled.").format(self.server_script))

	def validate_doctype_fields(self):
		if self.action == "Create Document":
			doctype = frappe.get_meta(self.document_type)
			for param in self.fields:
				field = doctype.get_field(param.fieldname)

				if not field:
					frappe.throw(_("Field {0} not found in {1}").format(param.fieldname, self.document_type))
