import frappe
from frappe.tests import IntegrationTestCase

from raven.api.message_actions import execute_action, get_action_defaults

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestMessageActions(IntegrationTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

		self.workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": "Message Action Test Workspace",
				"type": "Public",
			}
		).insert()

		self.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "message-action-test-channel",
				"type": "Public",
				"workspace": self.workspace.name,
			}
		).insert()

		self.message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel.name,
				"message_type": "Text",
				"text": "<p>hello world</p>",
			}
		).insert()

		self.action = frappe.get_doc(
			{
				"doctype": "Raven Message Action",
				"action_name": "Create ToDo",
				"title": "Create ToDo",
				"action": "Create Document",
				"document_type": "ToDo",
				"enabled": 1,
				"fields": [
					{
						"fieldname": "description",
						"label": "Description",
						"type": "Small Text",
						"is_required": 1,
						"default_value_type": "Message Field",
						"default_value": "text",
					},
				],
			}
		).insert()

	def tearDown(self):
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def test_disabled_action_throws_on_both_endpoints(self):
		self.action.enabled = 0
		self.action.save()

		with self.assertRaises(frappe.ValidationError):
			get_action_defaults(self.action.name, self.message.name)

		with self.assertRaises(frappe.ValidationError):
			execute_action(self.action.name, self.message.name, {"description": "x"})

	def test_values_are_whitelisted_to_action_fields(self):
		# `doctype` override and unknown keys must be dropped — only `description`
		# (the action's one defined field) may reach the created document.
		result = execute_action(
			self.action.name,
			self.message.name,
			{
				"description": "from test",
				"doctype": "Note",
				"status": "Closed",
			},
		)

		self.assertEqual(result["doctype"], "ToDo")
		todo = frappe.get_doc("ToDo", result["document"])
		self.assertEqual(todo.description, "from test")
		# ToDo's default status is Open; the injected "Closed" must not have applied.
		self.assertEqual(todo.status, "Open")

	def test_create_document_links_message_and_returns_link(self):
		result = execute_action(self.action.name, self.message.name, {"description": "link me"})

		self.assertEqual(result["doctype"], "ToDo")
		self.assertTrue(result["link"].startswith("/"), "link must be relative")
		self.assertIn(result["document"], result["link"])

		self.message.reload()
		self.assertEqual(self.message.link_doctype, "ToDo")
		self.assertEqual(self.message.link_document, result["document"])

	def test_defaults_resolution(self):
		# `Raven Message Action.validate_doctype_fields` requires every field's
		# `fieldname` to exist on `document_type` (ToDo) — so these reuse real ToDo
		# fields ("sender", "color", "priority") as stand-ins rather than made-up
		# names; nothing is ever inserted with these values, only defaults resolved.
		self.action.append(
			"fields",
			{
				"fieldname": "sender",
				"label": "Static",
				"type": "Data",
				"default_value_type": "Static",
				"default_value": "fixed-value",
			},
		)
		self.action.append(
			"fields",
			{
				"fieldname": "color",
				"label": "URL",
				"type": "Data",
				"default_value_type": "Message Field",
				"default_value": "message_url",
			},
		)
		self.action.append(
			"fields",
			{
				"fieldname": "priority",
				"label": "Jinja",
				"type": "Data",
				"default_value_type": "Jinja",
				"default_value": "owner={{ message.owner }}",
			},
		)
		self.action.save()

		defaults = get_action_defaults(self.action.name, self.message.name)

		self.assertEqual(defaults["description"], "<p>hello world</p>")
		self.assertEqual(defaults["sender"], "fixed-value")
		self.assertEqual(
			defaults["color"],
			frappe.utils.get_url(f"/raven/message/{self.message.name}"),
		)
		self.assertEqual(defaults["priority"], f"owner={self.message.owner}")

	def test_no_workspace_membership_does_not_error(self):
		# A channel with no workspace (like a DM) + a user with no Raven Workspace
		# Member row: v2 raised DoesNotExistError (a 500) resolving workspace_id.
		# `Raven Channel.autoname` dereferences `self.workspace` unconditionally for
		# non-DM/non-thread channels, so a workspace-less channel can't be inserted
		# directly — create it with a workspace, then blank the field to get the
		# DM-like state (`channel.workspace` empty) this test actually needs.
		dm_like = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "message-action-no-workspace",
				"type": "Public",
				"workspace": self.workspace.name,
			}
		).insert()
		frappe.db.set_value("Raven Channel", dm_like.name, "workspace", None)
		dm_message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": dm_like.name,
				"message_type": "Text",
				"text": "<p>dm</p>",
			}
		).insert()
		# `fieldname` must exist on ToDo (see test_defaults_resolution) — "role" (a
		# Link field) stands in for the workspace_id default here.
		self.action.append(
			"fields",
			{
				"fieldname": "role",
				"label": "Workspace",
				"type": "Data",
				"default_value_type": "Message Field",
				"default_value": "workspace_id",
			},
		)
		self.action.save()

		frappe.db.delete("Raven Workspace Member", {"user": frappe.session.user})
		defaults = get_action_defaults(self.action.name, dm_message.name)

		# No workspace resolvable → the default is simply absent (no crash).
		self.assertNotIn("role", defaults)
