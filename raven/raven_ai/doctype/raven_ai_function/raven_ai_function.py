# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _, is_whitelisted
from frappe.model.document import Document


class RavenAIFunction(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from raven.raven_ai.doctype.raven_ai_function_params.raven_ai_function_params import (
			RavenAIFunctionParams,
		)

		description: DF.SmallText
		function_definition: DF.JSON | None
		function_name: DF.Data
		function_path: DF.SmallText | None
		parameters: DF.Table[RavenAIFunctionParams]
		params: DF.JSON | None
		pass_parameters_as_json: DF.Check
		reference_doctype: DF.Link | None
		requires_write_permissions: DF.Check
		strict: DF.Check
		type: DF.Literal[
			"Get Document",
			"Get Multiple Documents",
			"Get List",
			"Create Document",
			"Create Multiple Documents",
			"Update Document",
			"Update Multiple Documents",
			"Delete Document",
			"Delete Multiple Documents",
			"Submit Document",
			"Cancel Document",
			"Get Amended Document",
			"Custom Function",
			"Send Message",
			"Attach File to Document",
			"Get Report Result",
			"Get Value",
			"Set Value",
		]
	# end: auto-generated types

	def before_validate(self):
		WRITE_PERMISSIONS = [
			"Create Document",
			"Create Multiple Documents",
			"Update Document",
			"Update Multiple Documents",
			"Delete Document",
			"Delete Multiple Documents",
			"Send Message",
			"Attach File to Document",
			"Set Value",
		]
		if self.type in WRITE_PERMISSIONS:
			self.requires_write_permissions = 1

		READ_PERMISSIONS = [
			"Get Document",
			"Get Multiple Documents",
			"Get Report Result",
			"Get List",
			"Get Value",
			"Get Amended Document",
		]
		if self.type in READ_PERMISSIONS:
			self.requires_write_permissions = 0

		self.validate_reference_doctype()
		self.validate_fields_for_doctype()
		self.prepare_function_params()

		self.validate_json()

	def validate_reference_doctype(self):
		if not self.reference_doctype:
			if not self.type in [
				"Custom Function",
				"Send Message",
				"Get Report Result",
				"Attach File to Document",
			]:
				frappe.throw(_("Please select a DocType for this function."))

	def validate_fields_for_doctype(self):
		# TODO: Validate fields for the doctype - clean up this code
		if not self.reference_doctype:
			return

		doctype = frappe.get_meta(self.reference_doctype)

		# Loop over the variables and check if the field names are valid
		for param in self.parameters:
			# Check if the fieldname belongs to a child table
			if param.child_table_name:
				child_table = doctype.get_field(param.child_table_name)
				if not child_table:
					frappe.throw(
						_("Child table {0} not found in {1}").format(param.child_table_name, self.reference_doctype)
					)

				# Check if the child table is a valid doctype
				child_meta = frappe.get_meta(child_table.options)
				if not child_meta:
					frappe.throw(_("Child table {0} is not a valid doctype").format(param.child_table_name))

				# Check if the child table variable has a valid name
				docfield = child_meta.get_field(param.fieldname)
				if not docfield:
					frappe.throw(_("Field {0} not found in {1}").format(param.fieldname, child_table.options))
			else:

				field = doctype.get_field(param.fieldname)

				if not field:
					frappe.throw(_("Field {0} not found in {1}").format(param.fieldname, self.reference_doctype))

				if field.fieldtype == "Select":
					if not param.options:
						frappe.throw(_("Options are required for select fields"))

					# Sometimes options is not populated in the DocType meta so we do not need to validate it
					if not field.options:
						continue

					select_options = field.options.split("\n")
					for option in param.options.split("\n"):
						if option not in select_options:
							frappe.throw(
								_("Option {0} is not valid for field {1} in {2}").format(
									option, param.fieldname, self.reference_doctype
								)
							)

	def prepare_function_params(self):
		"""
		Set the function params based on the type of function and other inputs
		"""
		params = {}
		if self.type == "Get Document":
			params = {
				"type": "object",
				"properties": {
					"document_id": {
						"type": "string",
						"description": f"The ID of the {self.reference_doctype} to get",
					}
				},
				"required": ["document_id"],
				"additionalProperties": False,
			}

		elif self.type == "Get Multiple Documents":
			params = {
				"type": "object",
				"properties": {
					"document_ids": {
						"type": "array",
						"items": {"type": "string"},
						"description": f"The IDs of the {self.reference_doctype}s to get",
					}
				},
				"required": ["document_ids"],
				"additionalProperties": False,
			}

		elif self.type == "Delete Document":
			params = {
				"type": "object",
				"properties": {
					"document_id": {
						"type": "string",
						"description": f"The ID of the {self.reference_doctype} to delete",
					}
				},
				"required": ["document_id"],
				"additionalProperties": False,
			}

		elif self.type == "Delete Multiple Documents":
			params = {
				"type": "object",
				"properties": {
					"document_ids": {
						"type": "array",
						"items": {"type": "string"},
						"description": f"The IDs of the {self.reference_doctype}s to delete",
					}
				},
				"required": ["document_ids"],
				"additionalProperties": False,
			}
		elif self.type == "Submit Document":
			params = {
				"type": "object",
				"properties": {
					"document_id": {
						"type": "string",
						"description": f"The ID of the {self.reference_doctype} to submit",
					}
				},
				"required": ["document_id"],
				"additionalProperties": False,
			}
		elif self.type == "Cancel Document":
			params = {
				"type": "object",
				"properties": {
					"document_id": {
						"type": "string",
						"description": f"The ID of the {self.reference_doctype} to cancel",
					}
				},
				"required": ["document_id"],
				"additionalProperties": False,
			}
		elif self.type == "Get Amended Document":
			params = {
				"type": "object",
				"properties": {
					"document_id": {
						"type": "string",
						"description": f"The ID of the {self.reference_doctype} to get the amended document for",
					}
				},
				"required": ["document_id"],
				"additionalProperties": False,
			}
		elif self.type == "Attach File to Document":
			params = {
				"type": "object",
				"properties": {
					"doctype": {
						"type": "string",
						"description": "The DocType of the document to attach the file to",
					},
					"document_id": {
						"type": "string",
						"description": "Use the document_id obtained to attach the file to the document.",
					},
					"file_path": {
						"type": "string",
						"description": "The path of the file to attach to the document",
					},
				},
				"required": ["doctype", "document_id", "file_path"],
				"additionalProperties": False,
			}
		elif self.type == "Custom Function":
			params = self.get_params_as_dict()
		elif self.type == "Get List":
			params = {
				"type": "object",
				"properties": {
					"filters": {
						"type": "object",
						"description": "Filters to apply when retrieving the list",
					},
					"fields": {
						"type": "array",
						"items": {"type": "string"},
						"description": "Fields to retrieve for each document",
					},
					"limit": {
						"type": "integer",
						"description": "Maximum number of documents to retrieve",
						"default": 20,
					},
				},
				"required": ["filters", "fields"],
				"additionalProperties": False,
			}
		elif self.type == "Get Value":
			params = {
				"type": "object",
				"properties": {
					"doctype": {
						"type": "string",
						"description": "The DocType to get the value from",
					},
					"filters": {
						"type": "object",
						"description": "Filters to apply when retrieving the value",
					},
					"fieldname": {
						"anyOf": [{"type": "string"}, {"type": "array", "items": {"type": "string"}}],
						"description": "The fields whose value needs to be returned. Can be a single field or a list of fields. If a list of fields is provided, the values will be returned as a tuple.",
					},
				},
				"required": ["doctype", "filters", "fieldname"],
				"additionalProperties": False,
			}
		elif self.type == "Set Value":
			params = {
				"type": "object",
				"properties": {
					"doctype": {
						"type": "string",
						"description": "The DocType to set the value for",
					},
					"document_id": {
						"type": "string",
						"description": "The ID of the document to set the value for",
					},
					"fieldname": {
						"anyOf": [{"type": "string"}, {"type": "object", "additionalProperties": True}],
						"description": "The fields whose value needs to be set. Can be a single field or a JSON object with key value pairs.",
					},
					"value": {
						"type": "string",
						"description": "The value to set for the field. This is required if fieldname is a string.",
					},
				},
				"required": ["doctype", "document_id", "fieldname"],
				"additionalProperties": False,
			}
		elif self.type == "Get Report Result":
			params = {
				"type": "object",
				"properties": {
					"report_name": {"type": "string", "description": "Report Name"},
					"filters": {
						"type": "object",
						"properties": {
							"company": {"type": "string", "description": "Company name to run the report for"},
							"from_date": {"type": "string", "description": "generate report from this date"},
							"to_date": {"type": "string", "description": "generate report till this date"},
						},
						"required": ["company", "to_date", "from_date"],
					},
					"limit": {"type": "number", "description": "Limit for the number of records to be fetched"},
					"ignore_prepared_report": {
						"type": "boolean",
						"description": "Whether to ignore the prepared report",
					},
					"user": {"type": "string", "description": "The user to run the report for"},
					"are_default_filters": {
						"type": "boolean",
						"description": "Whether to use the default filters",
					},
				},
				"required": ["report_name"],
			}
		else:
			params = self.build_params_json_from_table()

		self.params = json.dumps(params, indent=4)

	def build_params_json_from_table(self):
		params = {
			"type": "object",
			"additionalProperties": False,
		}

		required = []
		properties = {}

		child_tables = {}

		if self.type == "Update Document" or self.type == "Update Multiple Documents":
			properties["document_id"] = {
				"type": "string",
				"description": f"The ID of the {self.reference_doctype} to update",
			}
			required.append("document_id")

		for param in self.parameters:
			if param.do_not_ask_ai and not param.default_value and param.required:
				frappe.throw(
					_("You need to provide a default value for required parameters that are not asked by the AI.")
				)

			if param.do_not_ask_ai:
				continue
			obj = {
				"type": param.type,
				"description": param.description,
			}

			if param.type == "string" and param.options:
				obj["enum"] = param.options.split("\n")

			if not param.child_table_name:
				properties[param.fieldname] = obj

				if param.required:
					required.append(param.fieldname)
			else:
				if param.child_table_name not in child_tables:
					child_tables[param.child_table_name] = {
						"type": "array",
						"items": {
							"type": "object",
							"additionalProperties": False,
							"properties": {param.fieldname: obj},
							"required": [],
						},
					}
				else:
					child_tables[param.child_table_name]["items"]["properties"][param.fieldname] = obj

				if param.required:
					child_tables[param.child_table_name]["items"]["required"].append(param.fieldname)

		for child_table_name, child_table in child_tables.items():
			doctype_meta = frappe.get_meta(self.reference_doctype)
			table_field = doctype_meta.get_field(child_table_name)
			if table_field.reqd and not self.strict:
				child_table["minItems"] = 1

			properties[child_table_name] = child_table

		if self.type == "Create Multiple Documents" or self.type == "Update Multiple Documents":
			params["properties"] = {
				"data": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": properties,
						"required": required,
						"additionalProperties": False,
					},
				}
			}
			if not self.strict:
				params["properties"]["data"]["minItems"] = 1
		else:
			params["properties"] = properties
			params["required"] = required

		return params

	def validate_json(self):
		if self.type == "Custom Function":
			if not self.function_path:
				frappe.throw(_("Function path is required for Custom Functions"))

			# Check if JSON is valid and format it
			try:
				json.loads(self.params)
			except json.JSONDecodeError:
				frappe.throw(_("Invalid JSON in params"))

			self.params = json.dumps(json.loads(self.params), indent=4)

	def validate(self):
		# Functions cannot be named after core functions
		INVALID_FUNCTION_NAMES = [
			"get_document",
			"get_documents",
			"get_list",
			"create_document",
			"create_documents",
			"update_document",
			"update_documents",
			"delete_document",
			"delete_documents",
		]
		if self.function_name in INVALID_FUNCTION_NAMES:
			frappe.throw(
				_("Function name cannot be one of the core functions. Please choose a different name.")
			)

		DOCUMENT_REF_FUNCTIONS = [
			"Get Document",
			"Get Multiple Documents",
			"Get List",
			"Create Document",
			"Create Multiple Documents",
			"Update Document",
			"Update Multiple Documents",
			"Delete Document",
			"Delete Multiple Documents",
			"Submit Document",
			"Cancel Document",
			"Get Amended Document",
		]
		if self.type in DOCUMENT_REF_FUNCTIONS:
			if not self.reference_doctype:
				frappe.throw(_("Please select a DocType for this function."))

		# Validate if the function is whitelisted
		if self.type == "Custom Function":
			f = frappe.get_attr(self.function_path)
			if not f:
				frappe.throw(_("Function not found"))

			is_whitelisted(f)

	def before_save(self):
		# Generate the function definition from the variables + function name + description
		params = self.get_params_as_dict()

		function_definition = {
			"name": self.function_name,
			"description": self.description,
			"strict": True if self.strict else False,
			"parameters": params,
		}

		self.function_definition = json.dumps(function_definition, indent=4)

	def on_update(self):
		# Update all the bots that use this function

		bots = frappe.get_all("Raven Bot Functions", filters={"function": self.name}, pluck="parent")

		for bot in bots:
			bot = frappe.get_doc("Raven Bot", bot)
			bot.update_openai_assistant()

	def get_params_as_dict(self):
		if isinstance(self.params, dict):
			return self.params
		if isinstance(self.params, str):
			return json.loads(self.params)
		return {}
