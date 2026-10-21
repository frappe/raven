# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class RavenAIFunctionParams(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		child_table_name: DF.Data | None
		default_value: DF.Data | None
		description: DF.SmallText
		do_not_ask_ai: DF.Check
		fieldname: DF.Data
		options: DF.SmallText | None
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		required: DF.Check
		type: DF.Literal["string", "integer", "number", "float", "boolean"]
	# end: auto-generated types

	pass
