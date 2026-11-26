import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_to_date, now_datetime

TEST_USER = "test@example.com"


def _future():
	return add_to_date(now_datetime(), hours=1)


def _past():
	return add_to_date(now_datetime(), minutes=-1)


def _ensure_test_user():
	frappe.set_user("Administrator")
	frappe.get_doc("User", TEST_USER).add_roles("Raven User")
	if not frappe.db.exists("Raven User", TEST_USER):
		frappe.get_doc(
			{"doctype": "Raven User", "user": TEST_USER, "type": "User", "enabled": 1}
		).insert(ignore_permissions=True)


class TestTimedStatus(IntegrationTestCase):
	def setUp(self):
		_ensure_test_user()
		frappe.db.set_value(
			"Raven User",
			TEST_USER,
			{
				"availability_status": "",
				"availability_expires_at": None,
				"custom_status": "",
				"custom_status_expires_at": None,
			},
		)

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def _user(self):
		return frappe.get_doc("Raven User", TEST_USER)

	def _save(self, **values):
		doc = self._user()
		doc.update(values)
		doc.save(ignore_permissions=True)
		return self._user()

	def test_expiry_kept_for_timed_dnd(self):
		end = _future()
		doc = self._save(availability_status="Do not disturb", availability_expires_at=end)
		self.assertEqual(doc.availability_status, "Do not disturb")
		self.assertEqual(str(doc.availability_expires_at), str(end))

	def test_expiry_dropped_for_automatic_and_available(self):
		for status in ("", "Available"):
			doc = self._save(availability_status=status, availability_expires_at=_future())
			self.assertEqual(doc.availability_status, status)
			self.assertIsNone(doc.availability_expires_at)

	def test_expiry_dropped_for_empty_custom_status(self):
		doc = self._save(custom_status="", custom_status_expires_at=_future())
		self.assertIsNone(doc.custom_status_expires_at)

	def test_past_expiry_clears_value(self):
		doc = self._save(availability_status="Away", availability_expires_at=_past())
		self.assertEqual(doc.availability_status, "")
		self.assertIsNone(doc.availability_expires_at)

		doc = self._save(custom_status="Lunch", custom_status_expires_at=_past())
		self.assertEqual(doc.custom_status, "")
		self.assertIsNone(doc.custom_status_expires_at)

	def test_hand_set_status_drops_old_timer(self):
		self._save(availability_status="Do not disturb", availability_expires_at=_future())
		doc = self._save(availability_status="Away")
		self.assertEqual(doc.availability_status, "Away")
		self.assertIsNone(doc.availability_expires_at)

		self._save(custom_status="Out sick", custom_status_expires_at=_future())
		doc = self._save(custom_status="Back soon")
		self.assertEqual(doc.custom_status, "Back soon")
		self.assertIsNone(doc.custom_status_expires_at)

	def test_unchanged_status_resent_after_expiry_is_cleared(self):
		# set_value skips validate: an expired row the sweep hasn't reached yet.
		frappe.db.set_value(
			"Raven User",
			TEST_USER,
			{"custom_status": "Out sick", "custom_status_expires_at": _past()},
		)
		doc = self._save(full_name="Test Renamed")
		self.assertEqual(doc.custom_status, "")
		self.assertIsNone(doc.custom_status_expires_at)

	def test_malformed_end_time_is_a_validation_error(self):
		for field, value_field, value in (
			("availability_expires_at", "availability_status", "Away"),
			("custom_status_expires_at", "custom_status", "Lunch"),
		):
			doc = self._user()
			doc.update({value_field: value, field: "garbage"})
			with self.assertRaises(frappe.ValidationError):
				doc.save(ignore_permissions=True)

	def test_timezone_aware_end_time_is_a_validation_error(self):
		for value in ("2030-01-01T10:00:00+05:30", "2030-01-01T10:00:00Z"):
			doc = self._user()
			doc.update({"custom_status": "Lunch", "custom_status_expires_at": value})
			with self.assertRaises(frappe.ValidationError):
				doc.save(ignore_permissions=True)


class TestClearExpiredStatuses(IntegrationTestCase):
	def setUp(self):
		_ensure_test_user()

	def tearDown(self):
		# The sweep commits per row; reset the fixture so later runs start clean.
		frappe.db.set_value(
			"Raven User",
			TEST_USER,
			{
				"availability_status": "",
				"availability_expires_at": None,
				"custom_status": "",
				"custom_status_expires_at": None,
			},
		)
		frappe.db.delete("Raven Channel Groups", {"parent": TEST_USER, "group_name": "Favorites"})
		frappe.db.commit()  # nosemgrep
		frappe.set_user("Administrator")

	def _set_raw(self, **values):
		# set_value skips validate, so expired fixtures stay expired until the sweep.
		# Committed: a failed sweep row rolls back, which must not undo the fixture too.
		frappe.db.set_value("Raven User", TEST_USER, values)
		frappe.db.commit()  # nosemgrep

	def _row(self):
		return frappe.db.get_value(
			"Raven User",
			TEST_USER,
			[
				"availability_status",
				"availability_expires_at",
				"custom_status",
				"custom_status_expires_at",
			],
			as_dict=True,
		)

	def test_sweep_clears_expired_availability_and_status(self):
		from raven.scheduler.clear_expired_statuses import clear_expired_statuses

		self._set_raw(
			availability_status="Do not disturb",
			availability_expires_at=_past(),
			custom_status="Out sick",
			custom_status_expires_at=_past(),
		)
		clear_expired_statuses()
		row = self._row()
		self.assertEqual(row.availability_status, "")
		self.assertIsNone(row.availability_expires_at)
		self.assertEqual(row.custom_status, "")
		self.assertIsNone(row.custom_status_expires_at)

	def test_sweep_keeps_unexpired(self):
		from raven.scheduler.clear_expired_statuses import clear_expired_statuses

		self._set_raw(
			availability_status="Away",
			availability_expires_at=_future(),
			custom_status="Travelling",
			custom_status_expires_at=_future(),
		)
		clear_expired_statuses()
		row = self._row()
		self.assertEqual(row.availability_status, "Away")
		self.assertIsNotNone(row.availability_expires_at)
		self.assertEqual(row.custom_status, "Travelling")
		self.assertIsNotNone(row.custom_status_expires_at)

	def test_sweep_clears_user_list_cache(self):
		from raven.api.raven_users import get_users
		from raven.scheduler.clear_expired_statuses import clear_expired_statuses

		self._set_raw(custom_status="Lunch", custom_status_expires_at=_past())
		get_users.clear_cache()
		before = next(u for u in get_users() if u.name == TEST_USER)
		self.assertEqual(before.custom_status, "Lunch")

		clear_expired_statuses()
		after = next(u for u in get_users() if u.name == TEST_USER)
		self.assertEqual(after.custom_status, "")

	def test_sweep_keeps_status_renewed_after_read(self):
		from unittest.mock import patch

		from raven.scheduler import clear_expired_statuses as sweep

		self._set_raw(custom_status="Lunch", custom_status_expires_at=_past())
		real_query = sweep._expired_user_names

		def query_then_renew(now):
			names = real_query(now)
			# The user sets a new status between the sweep's query and its write.
			self._set_raw(custom_status="New", custom_status_expires_at=_future())
			return names

		with patch.object(sweep, "_expired_user_names", side_effect=query_then_renew):
			sweep.clear_expired_statuses()

		self.assertEqual(self._row().custom_status, "New")

	def test_sweep_ignores_users_without_end_time(self):
		from raven.scheduler.clear_expired_statuses import _expired_user_names

		# Asserts on the query alone, so other site users with expired statuses don't matter.
		self._set_raw(availability_status="Away", custom_status="Lunch")
		self.assertNotIn(TEST_USER, _expired_user_names(now_datetime()))

	def test_sweep_clears_user_whose_other_data_fails_validation(self):
		from raven.scheduler.clear_expired_statuses import clear_expired_statuses

		# A reserved group name from an older client makes every full save of this user fail.
		frappe.get_doc(
			{
				"doctype": "Raven Channel Groups",
				"parent": TEST_USER,
				"parenttype": "Raven User",
				"parentfield": "channel_groups",
				"group_name": "Favorites",
			}
		).db_insert()
		self._set_raw(custom_status="Lunch", custom_status_expires_at=_past())

		clear_expired_statuses()
		self.assertEqual(self._row().custom_status, "")
