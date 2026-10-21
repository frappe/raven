# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class RavenLinkPreview(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		description: DF.SmallText | None
		fetch_attempts: DF.Int
		fetch_error: DF.SmallText | None
		fetched_on: DF.Datetime | None
		image: DF.SmallText | None
		image_height: DF.Int
		image_preview: DF.Text | None
		image_width: DF.Int
		metadata: DF.JSON | None
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
		site_name: DF.Data | None
		stale_after: DF.Datetime | None
		status: DF.Literal["Pending", "Fetched", "Failed", "Blocked"]
		title: DF.SmallText | None
		url: DF.Data
	# end: auto-generated types

	# One doc per normalized URL. The unique url column is what
	# Raven Message Links.normalized_url points at. Docs are created (and
	# later filled) by a background job. That job only sees URLs the server
	# extracted itself — see raven/links.py. This controller must never
	# fetch anything on its own: no network calls in a request, and never
	# a client-supplied URL.
	pass
