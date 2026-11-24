from datetime import datetime

import frappe
from frappe.tests import IntegrationTestCase

from raven.quiet_hours import is_in_quiet_hours


def at(hour: int, minute: int = 0) -> datetime:
	return datetime(2026, 11, 20, hour, minute)


class TestQuietHours(IntegrationTestCase):
	def tearDown(self):
		frappe.db.rollback()
		# Rollback leaves the cached settings doc holding the test's hours.
		frappe.clear_document_cache("Raven Settings", "Raven Settings")

	def set_hours(self, start: str, end: str, enabled: int = 1):
		frappe.db.set_single_value(
			"Raven Settings",
			{"enable_quiet_hours": enabled, "working_hours_start": start, "working_hours_end": end},
		)

	def test_disabled_is_never_quiet(self):
		self.set_hours("09:00:00", "18:00:00", enabled=0)
		self.assertFalse(is_in_quiet_hours(at(23)))

	def test_normal_window(self):
		self.set_hours("09:00:00", "18:00:00")
		self.assertFalse(is_in_quiet_hours(at(10)))
		# Working hours end at 18:00 itself.
		self.assertTrue(is_in_quiet_hours(at(18)))
		self.assertTrue(is_in_quiet_hours(at(8, 59)))

	def test_overnight_window(self):
		self.set_hours("22:00:00", "06:00:00")
		self.assertFalse(is_in_quiet_hours(at(23)))
		self.assertFalse(is_in_quiet_hours(at(5, 59)))
		self.assertTrue(is_in_quiet_hours(at(12)))

	def test_unparseable_is_never_quiet(self):
		# Delivery calls this; a bad stored value must not fail the send.
		self.set_hours("not a time", "18:00:00")
		self.assertFalse(is_in_quiet_hours(at(23)))

	def test_degenerate_is_never_quiet(self):
		self.set_hours("09:00:00", "09:00:00")
		self.assertFalse(is_in_quiet_hours(at(3)))
		self.assertFalse(is_in_quiet_hours(at(12)))
