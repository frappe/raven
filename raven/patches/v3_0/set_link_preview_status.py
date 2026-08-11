import frappe

from raven.link_fetcher import STALE_AFTER_DAYS


def execute():
	"""
	Old preview rows predate the status column. Rows that already have
	content count as Fetched, with a fresh staleness clock. The rest wait
	as Pending, so the fetch pipeline picks them up when their link is
	shared again. Only rows with no status yet are touched, so re-running
	is a no-op. No network calls.

	set_value with a filters dict updates all matching rows in one query.
	"""
	stale_after = frappe.utils.add_days(frappe.utils.now_datetime(), STALE_AFTER_DAYS)

	frappe.db.set_value(
		"Raven Link Preview",
		{"status": ("is", "not set"), "title": ("is", "set")},
		{"status": "Fetched", "stale_after": stale_after},
		update_modified=False,
	)

	frappe.db.set_value(
		"Raven Link Preview",
		{"status": ("is", "not set")},
		"status",
		"Pending",
		update_modified=False,
	)
