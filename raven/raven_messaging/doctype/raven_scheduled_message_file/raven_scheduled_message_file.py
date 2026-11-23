# Copyright (c) 2026, The Commit Company and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class RavenScheduledMessageFile(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		file_size: DF.Int
		file_url: DF.Data
		height: DF.Int
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		width: DF.Int
	# end: auto-generated types

	pass
