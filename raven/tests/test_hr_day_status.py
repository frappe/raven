import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, today

WFH_USER = "wfh-status@example.com"


class TestHRDayStatus(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		if "hrms" not in frappe.get_installed_apps():
			raise cls.skipTest(cls, "Frappe HR is not installed")

	def setUp(self):
		from erpnext.setup.doctype.employee.test_employee import make_employee

		frappe.set_user("Administrator")
		self.employee = make_employee(WFH_USER)
		self.company = frappe.db.get_value("Employee", self.employee, "company")
		frappe.db.set_single_value("Raven Settings", "show_if_a_user_is_on_leave", 1)

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")

	def _attendance(self, status, date=None, submit=True):
		doc = frappe.get_doc(
			{
				"doctype": "Attendance",
				"employee": self.employee,
				"company": self.company,
				"status": status,
				"attendance_date": date or today(),
			}
		).insert(ignore_permissions=True)
		if submit:
			doc.submit()
		return doc

	def _status(self):
		from raven.api.raven_users import get_users_hr_day_status

		return get_users_hr_day_status()

	def test_wfh_listed_today(self):
		self._attendance("Work From Home")
		status = self._status()
		self.assertIn(WFH_USER, status["work_from_home"])
		self.assertNotIn(WFH_USER, status["on_leave"])

	def test_setting_off_hides_leave_and_wfh(self):
		self._attendance("Work From Home")
		frappe.db.set_single_value("Raven Settings", "show_if_a_user_is_on_leave", 0)
		self.assertEqual(self._status(), {"on_leave": [], "work_from_home": []})

	def test_half_day_not_listed(self):
		self._attendance("Half Day")
		self.assertNotIn(WFH_USER, self._status()["work_from_home"])

	def test_draft_and_other_day_not_listed(self):
		self._attendance("Work From Home", submit=False)
		self._attendance("Work From Home", date=add_days(today(), -1))
		self.assertNotIn(WFH_USER, self._status()["work_from_home"])

	def test_employee_without_user_not_listed(self):
		frappe.db.set_value("Employee", self.employee, "user_id", None)
		self._attendance("Work From Home")
		self.assertNotIn(None, self._status()["work_from_home"])

	def test_leave_listed_separately(self):
		self._attendance("On Leave")
		status = self._status()
		self.assertIn(WFH_USER, status["on_leave"])
		self.assertNotIn(WFH_USER, status["work_from_home"])

	def _attendance_queries(self):
		from unittest.mock import patch

		real_sql = frappe.db.sql
		calls = []

		def counting_sql(query, *args, **kwargs):
			if "tabAttendance" in str(query):
				calls.append(query)
			return real_sql(query, *args, **kwargs)

		with patch.object(frappe.db, "sql", side_effect=counting_sql):
			self._status()
		return len(calls)

	def test_one_attendance_query_for_both_statuses(self):
		self._attendance("Work From Home")
		self.assertEqual(self._attendance_queries(), 1)

	def test_no_attendance_query_when_setting_off(self):
		frappe.db.set_single_value("Raven Settings", "show_if_a_user_is_on_leave", 0)
		self.assertEqual(self._attendance_queries(), 0)
