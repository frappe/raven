import frappe
from frappe.core.doctype.doctype.test_doctype import new_doctype
from frappe.tests import IntegrationTestCase

from raven.api.document_link import get_preview_data


class TestDocumentPreviewCurrency(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		# The currency source fields stay out of the preview, as on a Sales Order.
		cls.doctype = new_doctype(
			fields=[
				{"fieldname": "currency", "fieldtype": "Link", "options": "Currency", "label": "Currency"},
				{
					"fieldname": "base_currency",
					"fieldtype": "Link",
					"options": "Currency",
					"label": "Base Currency",
				},
				{
					"fieldname": "amount",
					"fieldtype": "Currency",
					"options": "currency",
					"label": "Amount",
					"in_preview": 1,
				},
				{
					"fieldname": "base_amount",
					"fieldtype": "Currency",
					"options": "Currency:base_currency:name",
					"label": "Base Amount",
					"in_preview": 1,
				},
			]
		).insert()

	@classmethod
	def tearDownClass(cls):
		# Creating the DocType's table committed it, so the class rollback can't remove it.
		# delete_doc leaves the table behind.
		try:
			frappe.delete_doc("DocType", cls.doctype.name, force=True)
			frappe.db.commit()  # nosemgrep
			frappe.db.sql_ddl(f"drop table if exists `tab{cls.doctype.name}`")
		finally:
			super().tearDownClass()

	def tearDown(self):
		frappe.db.rollback()

	def test_currency_fields_use_the_document_currency(self):
		doc = frappe.get_doc(
			{
				"doctype": self.doctype.name,
				"currency": "EUR",
				"base_currency": "USD",
				"amount": 80,
				"base_amount": 92,
			}
		).insert()

		preview = get_preview_data(self.doctype.name, doc.name)

		self.assertIn("€", preview["Amount"])
		self.assertIn("$", preview["Base Amount"])
		# Source fields are fetched to format the amounts, not shown as rows.
		self.assertNotIn("Currency", preview)
		self.assertNotIn("Base Currency", preview)
