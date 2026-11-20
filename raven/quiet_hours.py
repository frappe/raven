from datetime import datetime, timedelta

import frappe
from frappe.utils import to_timedelta


def is_in_quiet_hours(at: datetime) -> bool:
	"""Whether `at` (naive, system tz) falls outside the org's working hours.

	Mirrors isInQuietHours in apps/web/src/utils/quietHours.ts. Feature off, a
	missing value or start == end all read as not quiet.
	"""
	settings = frappe.get_cached_doc("Raven Settings")
	if not settings.enable_quiet_hours:
		return False

	start = _seconds(settings.working_hours_start)
	end = _seconds(settings.working_hours_end)
	if start is None or end is None or start == end:
		return False

	now = at.hour * 3600 + at.minute * 60 + at.second
	# start > end is a shift that wraps midnight (e.g. 22:00–06:00).
	is_working = start <= now < end if start < end else now >= start or now < end
	return not is_working


def _seconds(value) -> int | None:
	try:
		delta = to_timedelta(value)
	except ValueError:
		# Unparseable stored value: fail toward a normal send.
		return None
	return int(delta.total_seconds()) if isinstance(delta, timedelta) else None
