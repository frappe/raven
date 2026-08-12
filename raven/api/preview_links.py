import json

import frappe
from frappe import _

from raven.links import is_preview_blocked, normalize_url


@frappe.whitelist(methods=["GET"])
def get_preview_link(urls: list[str] | str):
	"""
	Old endpoint, kept only because the v2 frontend still calls it.
	It is now a read-only lookup of previews the server already stored
	(see raven/links.py). It never fetches. v3 gets its own get_previews
	endpoint in Layer 3 of the plan.
	"""
	empty_data = {
		"title": "",
		"description": "",
		"image": "",
		"force_title": "",
		"absolute_image": "",
		"site_name": "",
	}

	if not urls or urls == "[]":
		return []

	if isinstance(urls, str):
		urls = json.loads(urls)

	# Previews are stored under the normalized spelling. Normalize each raw
	# URL the same way, then look them all up in one query.
	normalized_by_raw = {url: normalize_url(url) for url in urls}
	# The blocklist beats stored data — a doc may predate the block.
	lookup = [
		normalized
		for normalized in normalized_by_raw.values()
		if normalized and not is_preview_blocked(normalized)
	]

	stored = {}
	if lookup:
		for row in frappe.get_all(
			"Raven Link Preview",
			filters={"url": ("in", lookup)},
			fields=["url", "title", "description", "image", "site_name"],
		):
			stored[row.url] = row

	results = []
	for url in urls:
		row = stored.get(normalized_by_raw.get(url))
		# A shell doc with no fetched content yet is the same as no preview.
		if row and row.title:
			results.append(
				{
					"title": row.title or "",
					"description": row.description or "",
					"image": row.image or "",
					"force_title": row.title or "",
					"absolute_image": row.image or "",
					"site_name": row.site_name or "",
				}
			)
		else:
			results.append(empty_data)

	return results


# One screen of messages at most. A bigger batch means something is
# calling this wrong.
MAX_PREVIEW_BATCH = 50


@frappe.whitelist(methods=["POST"])
def get_previews(urls: list[str] | str):
	"""
	The v3 read endpoint. Takes RAW urls exactly as they appear in
	messages, normalizes them server-side (the normalizer lives in one
	place), and returns stored previews keyed by the raw urls requested.
	A url with no stored preview maps to None. Never fetches anything —
	that is the background pipeline's job (raven/links.py).

	POST although it only reads: a window's batch of urls (up to 50 x 500
	chars) does not fit safely in a query string.
	"""
	if not urls or urls == "[]":
		return {}

	if isinstance(urls, str):
		urls = json.loads(urls)

	urls = urls[:MAX_PREVIEW_BATCH]

	normalized_by_raw = {url: normalize_url(url) for url in urls}
	# The blocklist beats stored data — a doc may predate the block.
	lookup = {
		normalized
		for normalized in normalized_by_raw.values()
		if normalized and not is_preview_blocked(normalized)
	}

	stored = {}
	if lookup:
		for row in frappe.get_all(
			"Raven Link Preview",
			filters={"url": ("in", list(lookup))},
			fields=[
				"url",
				"provider",
				"status",
				"title",
				"description",
				"image",
				"image_width",
				"image_height",
				"site_name",
				"metadata",
			],
		):
			# The JSON column comes back as a string. The client wants a dict.
			row.metadata = json.loads(row.metadata) if row.metadata else None
			stored[row.url] = row

	return {url: stored.get(normalized_by_raw.get(url)) for url in urls}


@frappe.whitelist(methods=["POST"])
def hide_link_preview(message_id: str):
	"""
	v2 only. v3 dropped per-message hiding — it hid the preview for ALL
	users even when one person opted out. v3 replaces it with a per-user
	display preference (hover or card). Delete this along with the v2
	frontend.
	"""
	message = frappe.get_doc("Raven Message", message_id)

	if not message.has_permission():
		frappe.throw(_("You do not have permission to hide link previews on this message."))

	message.flags.ignore_permissions = True
	message.hide_link_preview = 1
	message.flags.editing_metadata = True
	message.save()
