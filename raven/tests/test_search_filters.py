import json

import frappe
from frappe.tests import IntegrationTestCase

from raven.api.search import RavenSearch, sqlite_search, validate_filter_keys


class TestSearchFilters(IntegrationTestCase):
	def test_rejects_a_key_that_is_sql(self):
		# The audit's payload: this key turned the permission filter into "OR 1=1".
		filters = json.dumps({"1=1 OR channel_id": "x"})
		with self.assertRaises(frappe.ValidationError):
			sqlite_search(filters=filters)

	def test_allows_the_keys_the_app_sends(self):
		# saved and mentions_me are turned into indexed fields before the check.
		validate_filter_keys(
			{
				"channel_id": "x",
				"owner": "x",
				"message_type": ["File"],
				"file_type": ["pdf"],
				"is_thread": 1,
			}
		)
