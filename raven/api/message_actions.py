import frappe
from frappe import _


def get_enabled_action(action_id: str):
	"""
	Fetch a message action, throwing if it is disabled. The menu only lists
	enabled actions, but a direct API call must not bypass that filter.
	"""
	action = frappe.get_doc("Raven Message Action", action_id)
	if not action.enabled:
		frappe.throw(_("Message Action {0} is disabled").format(action.action_name))
	return action


def filter_values_to_action_fields(action, values: dict) -> dict:
	"""
	Drop any submitted key the action does not define. Without this, the payload
	can override the admin's config — e.g. a `doctype` key would beat
	`action.document_type` in the Create Document merge below.
	"""
	allowed = {field.fieldname for field in action.fields}
	return {key: value for key, value in values.items() if key in allowed}


def resolve_workspace_id(message) -> str | None:
	"""
	The workspace for the `workspace_id` message-field default: the channel's own
	workspace, else the last workspace this user is a member of, else None.
	(v2 used get_last_doc(...).name here — the MEMBER row's name, not a workspace,
	and it raised DoesNotExistError for users with no membership rows.)
	"""
	workspace = frappe.get_cached_value("Raven Channel", message.channel_id, "workspace")
	if workspace:
		return workspace
	return frappe.db.get_value(
		"Raven Workspace Member",
		{"user": frappe.session.user},
		"workspace",
		order_by="modified desc",
	)


@frappe.whitelist(methods=["GET"])
def get_action_defaults(action_id: str, message_id: str):
	"""
	Get the default values for a message action
	"""

	frappe.has_permission(doctype="Raven Message", doc=message_id, ptype="read", throw=True)
	action = get_enabled_action(action_id)
	message = frappe.get_doc("Raven Message", message_id)

	# The canonical /message resolver route redirects to the right place for every
	# message (channel, DM, or thread reply) — same shape the web app's own
	# "Copy message link" uses. No workspace/thread special-casing needed.
	message_url = frappe.utils.get_url(f"/raven/message/{message.name}")

	# Loop through the fields in the action and get the default values from the message
	defaults = {}

	for field in action.fields:
		if not field.default_value:
			continue

		if field.default_value_type == "Static":
			defaults[field.fieldname] = field.default_value

		if field.default_value_type == "Message Field":
			if field.default_value == "message_url":
				val = message_url
			elif field.default_value == "workspace_id":
				val = resolve_workspace_id(message)
			else:
				val = message.get(field.default_value)
			if val:
				defaults[field.fieldname] = val

		if field.default_value_type == "Jinja":

			val = frappe.render_template(
				field.default_value, {"message": {"message_url": message_url, **message.as_dict()}}
			)

			if val:
				defaults[field.fieldname] = val

	return defaults


@frappe.whitelist(methods=["POST"])
def execute_action(action_id: str, message_id: str, values: dict):
	"""
	Execute a message action
	"""

	frappe.has_permission(doctype="Raven Message", doc=message_id, ptype="read", throw=True)
	action = get_enabled_action(action_id)
	message = frappe.get_doc("Raven Message", message_id)
	values = filter_values_to_action_fields(action, values)

	if action.action == "Create Document":
		doc = frappe.get_doc({"doctype": action.document_type, **values})
		doc.insert()

		# Link message to the document if no link exists already
		if not message.link_doctype and not message.link_document:
			message.flags.editing_metadata = True
			message.link_doctype = doc.doctype
			message.link_document = doc.name
			# Ignore permissions to allow editing of the document
			message.save(ignore_permissions=True)

		# Resolve the document's URL server-side (hook-overridable for apps that
		# don't live under /app, e.g. Frappe CRM). Relative, so the client opens
		# it on whatever origin the user is on.
		from raven.api.document_link import get as get_document_link

		link = get_document_link(doc.doctype, doc.name, with_site_url=False)

		return {
			"message": "Document created successfully",
			"document": doc.name,
			"doctype": doc.doctype,
			"link": link,
		}

	if action.action == "Custom Function":
		# Call the function with the values
		function_name = frappe.get_attr(action.custom_function_path)

		if function_name:
			return function_name(**values)
		else:
			frappe.throw(_("Function {0} not found").format(action.custom_function_path))

	if action.action == "Server Script":
		script = frappe.get_doc("Server Script", action.server_script)
		if script.disabled:
			frappe.throw(_("Server Script {0} is disabled").format(action.server_script))
		script.execute_method()
