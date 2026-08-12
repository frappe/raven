# Copyright (c) 2026, The Commit Company (Algocode Technologies Pvt. Ltd.) and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class RavenMessageLinks(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		normalized_url: DF.SmallText | None
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		provider: DF.Literal[
			"Other",
			"Wikipedia",
			"Frappe",
			"Site Document Link",
			"Raven Link",
			"Frappe Meet",
			"Google Meet",
			"Zoom",
			"YouTube",
			"YouTube Music",
			"Spotify",
			"Apple Music",
			"Apple Podcasts",
			"SoundCloud",
			"Loom",
			"Vimeo",
			"Reddit",
			"Figma",
			"X",
			"GitHub",
			"Hacker News",
		]
		url: DF.SmallText
	# end: auto-generated types

	_DOCTYPE_NAME = "Raven Message Links"
