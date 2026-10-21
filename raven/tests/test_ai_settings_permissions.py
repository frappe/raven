from unittest.mock import MagicMock, patch

import frappe
from frappe.tests import IntegrationTestCase

from raven.api.ai_features import test_llm_configuration as check_llm_connection

EXTRA_TEST_RECORD_DEPENDENCIES = ["User"]

SAVED_URL = "http://llm.internal:11434/v1"
ATTACKER_URL = "https://attacker.example.com"


class TestAISettingsPermissions(IntegrationTestCase):
	def setUp(self):
		frappe.db.set_single_value(
			"Raven Settings", {"local_llm_api_url": SAVED_URL, "local_llm_provider": "Ollama"}
		)
		frappe.clear_document_cache("Raven Settings", "Raven Settings")
		# test1 is a Raven Admin, test2 a System Manager
		frappe.get_doc("User", "test1@example.com").add_roles("Raven Admin")
		frappe.get_doc("User", "test2@example.com").add_roles("System Manager")

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_document_cache("Raven Settings", "Raven Settings")

	def url_requested_by(self, user):
		frappe.set_user(user)
		response = MagicMock(status_code=200, json=lambda: {"data": []})
		with patch("requests.get", return_value=response) as get:
			check_llm_connection(provider="Local LLM", api_url=ATTACKER_URL, local_llm_provider="Ollama")
		return get.call_args.args[0]

	def test_raven_admin_can_only_test_the_saved_server(self):
		# The audit's case: a Raven Admin pointed the test at their own server.
		self.assertEqual(self.url_requested_by("test1@example.com"), f"{SAVED_URL}/models")

	def test_system_manager_can_test_a_new_server(self):
		self.assertEqual(self.url_requested_by("test2@example.com"), f"{ATTACKER_URL}/models")
