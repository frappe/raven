import frappe
from frappe.utils.data import now_datetime

# Bounds one sweep's work; overflow is picked up next run.
STATUS_BATCH_SIZE = 500
STATUS_FIELDS = (
	"availability_status",
	"availability_expires_at",
	"custom_status",
	"custom_status_expires_at",
)


def clear_expired_statuses():
	"""Cron entrypoint: clears availability and written statuses past their end time."""
	now = now_datetime()
	expired = _expired_user_names(now)

	# One transaction per user, like the reminder sweep: a failure stays with its row.
	for name in expired:
		try:
			# Locked and freshly read: a status renewed since the query stays, and one set
			# during this write waits for it instead of being overwritten.
			doc = frappe.get_doc("Raven User", name, for_update=True)
			doc.validate_status_expiry()
			# Only the status fields are written: a full save fails on any unrelated invalid
			# field, which would leave the status set forever.
			doc.db_set({field: doc.get(field) for field in STATUS_FIELDS}, notify=True)
			doc.invalidate_user_list_cache()
			frappe.db.commit()  # nosemgrep
		except Exception:
			frappe.db.rollback()
			frappe.log_error(title=f"Could not clear expired status for {name}")


def _expired_user_names(now) -> list[str]:
	user = frappe.qb.DocType("Raven User")
	# Explicit null checks: get_all's "<=" wraps the column in ifnull, which matches
	# every user without an end time.
	return (
		frappe.qb.from_(user)
		.select(user.name)
		.where(
			(user.availability_expires_at.isnotnull() & (user.availability_expires_at <= now))
			| (user.custom_status_expires_at.isnotnull() & (user.custom_status_expires_at <= now))
		)
		.limit(STATUS_BATCH_SIZE)
		.run(pluck=True)
	)
