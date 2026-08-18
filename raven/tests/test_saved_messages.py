import frappe
from frappe.tests import IntegrationTestCase


class TestSavedMessagesPagination(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

		user = frappe.get_doc("User", "test@example.com")
		user.add_roles("Raven User")
		if not frappe.db.exists("Raven User", {"user": "test@example.com"}):
			frappe.get_doc(
				{
					"doctype": "Raven User",
					"user": "test@example.com",
					"type": "User",
					"enabled": 1,
				}
			).insert(ignore_permissions=True)

		frappe.set_user("test@example.com")
		workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": frappe.generate_hash("test-saved-ws", 8),
				"type": "Public",
			}
		).insert(ignore_permissions=True)
		self.channel = (
			frappe.get_doc(
				{
					"doctype": "Raven Channel",
					"channel_name": frappe.generate_hash("test-saved", 8),
					"workspace": workspace.name,
					"type": "Public",
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

		from frappe.desk.like import _toggle_like

		# Three saved messages, insertion order = creation ASC.
		self.messages = []
		for text in ("alpha one", "beta two", "gamma three"):
			message = frappe.get_doc(
				{
					"doctype": "Raven Message",
					"channel_id": self.channel,
					"text": f"<p>{text}</p>",
					"message_type": "Text",
				}
			).insert(ignore_permissions=True)
			_toggle_like("Raven Message", message.name, "Yes", user="test@example.com")
			self.messages.append(message.name)

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def test_paged_window_is_newest_first(self):
		from raven.api.raven_message import get_saved_messages

		page_one = get_saved_messages(limit=2, start=0, channel_id=self.channel)
		self.assertEqual([r["name"] for r in page_one], [self.messages[2], self.messages[1]])

		page_two = get_saved_messages(limit=2, start=2, channel_id=self.channel)
		self.assertEqual([r["name"] for r in page_two], [self.messages[0]])

	def test_legacy_call_returns_all_ascending(self):
		from raven.api.raven_message import get_saved_messages

		rows = [r["name"] for r in get_saved_messages(channel_id=self.channel)]
		self.assertEqual(rows, self.messages)

	def test_search_filters_server_side(self):
		from raven.api.raven_message import get_saved_messages

		rows = get_saved_messages(limit=50, search="beta", channel_id=self.channel)
		self.assertEqual([r["name"] for r in rows], [self.messages[1]])

	def test_liked_by_match_is_exact_not_substring(self):
		"""avi@… must not see saves belonging only to gauravi@… — the _liked_by
		LIKE has to match the quoted JSON entry, not a substring."""
		frappe.set_user("Administrator")
		for email in ("avi@example.com", "gauravi@example.com"):
			if not frappe.db.exists("User", email):
				frappe.get_doc({"doctype": "User", "email": email, "first_name": email}).insert(
					ignore_permissions=True
				)
			frappe.get_doc("User", email).add_roles("Raven User")
			if not frappe.db.exists("Raven User", {"user": email}):
				frappe.get_doc({"doctype": "Raven User", "user": email, "type": "User", "enabled": 1}).insert(
					ignore_permissions=True
				)

		from frappe.desk.like import _toggle_like

		from raven.api.raven_message import get_saved_messages

		message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel,
				"text": "<p>saved by gauravi only</p>",
				"message_type": "Text",
			}
		).insert(ignore_permissions=True)
		_toggle_like("Raven Message", message.name, "Yes", user="gauravi@example.com")

		frappe.set_user("avi@example.com")
		self.assertNotIn(message.name, [r["name"] for r in get_saved_messages()])

		frappe.set_user("gauravi@example.com")
		self.assertIn(message.name, [r["name"] for r in get_saved_messages()])

	def test_channel_filter_matches_thread_parent(self):
		from frappe.desk.like import _toggle_like

		from raven.api.raven_message import get_saved_messages
		from raven.api.threads import create_thread

		# A saved reply inside a thread must match its PARENT channel's filter.
		create_thread(self.messages[0])  # thread channel's name == the root message id
		reply = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.messages[0],  # thread channel is named after its root
				"text": "<p>thread reply delta</p>",
				"message_type": "Text",
			}
		).insert(ignore_permissions=True)
		_toggle_like("Raven Message", reply.name, "Yes", user="test@example.com")

		rows = get_saved_messages(limit=50, channel_id=self.channel)
		names = [r["name"] for r in rows]
		self.assertIn(reply.name, names)
		row = next(r for r in rows if r["name"] == reply.name)
		self.assertEqual(row["parent_channel_id"], self.channel)
