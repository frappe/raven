# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class RavenMessageActionFields(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		default_value: DF.SmallText | None
		default_value_type: DF.Literal["Static", "Message Field", "Jinja"]
		fieldname: DF.Data
		helper_text: DF.Data | None
		is_required: DF.Check
		label: DF.Data
		options: DF.SmallText | None
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		type: DF.Literal[
			"Data", "Number", "Select", "Link", "Date", "Time", "Datetime", "Small Text", "Checkbox"
		]
	# end: auto-generated types

	pass
