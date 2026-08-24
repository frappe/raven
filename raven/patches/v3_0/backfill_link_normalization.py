import frappe

from raven.links import MAX_PREVIEW_URL_LENGTH, detect_provider, normalize_url


def execute():
	"""
	Recompute normalized_url and provider on message link rows, and
	provider on stored previews. Pure computation, no network calls.

	Re-run this (bump the #N suffix in patches.txt) whenever the provider
	registry gains an entry. Rows classified before the entry existed then
	pick up the new provider name.

	Old preview docs used the raw URL spelling. Lookups use the normalized
	spelling, so where the two differ and the normalized spelling is still
	free, rewrite the url in place. On a clash, leave the old row alone.

	When a preview doc's provider changes, its Fetched or Failed status
	resets to Pending: that outcome came from the wrong fetch strategy.
	The next share of the link refetches it with the right one. Blocked
	stays terminal — blocking is about the address, not the strategy.
	"""
	# Imported here, not at the top: the patch used to run before this
	# module existed in the codebase.
	from raven.link_fetcher import SKIP_PREVIEW_PROVIDERS

	for row in frappe.get_all("Raven Message Links", fields=["name", "url"]):
		normalized = normalize_url(row.url)
		frappe.db.set_value(
			"Raven Message Links",
			row.name,
			{"normalized_url": normalized, "provider": detect_provider(normalized)},
			update_modified=False,
		)

	for row in frappe.get_all(
		"Raven Link Preview", fields=["name", "url", "provider", "status", "image"]
	):
		normalized = normalize_url(row.url)
		provider = detect_provider(normalized) or "Other"

		# Providers the client renders on its own never need preview docs.
		# Drop the dead rows — nothing joins to them by name.
		if provider in SKIP_PREVIEW_PROVIDERS:
			frappe.delete_doc("Raven Link Preview", row.name, ignore_permissions=True, force=True)
			continue

		values = {"provider": provider}

		if provider != row.provider and row.status in ("Fetched", "Failed"):
			values["status"] = "Pending"
			values["fetch_attempts"] = 0
			values["fetch_error"] = ""

		# X rows fetched before the strategy learned to scrape images have
		# text but no image. Refetch them once the link is shared again.
		if provider == "X" and row.status == "Fetched" and not row.image:
			values["status"] = "Pending"
			values["fetch_attempts"] = 0

		if (
			normalized
			and normalized != row.url
			and len(normalized) <= MAX_PREVIEW_URL_LENGTH
			and not frappe.db.exists("Raven Link Preview", {"url": normalized})
		):
			values["url"] = normalized

		frappe.db.set_value("Raven Link Preview", row.name, values, update_modified=False)
