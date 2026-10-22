import frappe
from frappe import _
from frappe.query_builder import JoinType, Order
from frappe.query_builder.functions import Coalesce

from raven.utils import delete_channel_members_cache, delete_workspace_members_cache


@frappe.whitelist()
def get_list():
	"""
	Fetches list of all workspaces that the current user is a member of/has access to.

	Ordered by the user's pinned_workspaces child table (their chosen sidebar
	order), with workspaces not in the table after it — so the FIRST paint on the
	client is already in the right order (no reorder flash once the profile loads).
	"""
	raven_user = frappe.db.get_value("Raven User", {"user": frappe.session.user}, "name")
	if not raven_user:
		frappe.throw(_("You do not have access to Raven."), frappe.PermissionError)

	workspace = frappe.qb.DocType("Raven Workspace")
	workspace_member = frappe.qb.DocType("Raven Workspace Member")
	pinned = frappe.qb.DocType("Raven User Pinned Workspaces")

	all_workspaces = (
		frappe.qb.from_(workspace)
		.join(workspace_member, JoinType.left)
		.on(
			(workspace.name == workspace_member.workspace) & (workspace_member.user == frappe.session.user)
		)
		.join(pinned, JoinType.left)
		.on(
			(pinned.workspace == workspace.name)
			& (pinned.parent == raven_user)
			& (pinned.parenttype == "Raven User")
		)
		.where((workspace_member.user == frappe.session.user) | (workspace.type == "Public"))
		.select(
			workspace.workspace_name,
			workspace.name,
			workspace.logo,
			workspace.type,
			workspace.description,
			workspace.can_only_join_via_invite,
			workspace_member.name.as_("workspace_member_name"),
			workspace_member.is_admin.as_("is_admin"),
		)
		# Pinned first in their saved row order; unpinned (NULL idx → large
		# fallback) after, in creation order.
		.orderby(Coalesce(pinned.idx, 1000000), order=Order.asc)
		.orderby(workspace.creation, order=Order.asc)
	)

	return all_workspaces.run(as_dict=True)


@frappe.whitelist()
def join_workspace(workspace: str):
	"""
	Joins a workspace
	"""
	member = frappe.get_doc(
		{"doctype": "Raven Workspace Member", "workspace": workspace, "user": frappe.session.user}
	).insert()

	return member


@frappe.whitelist()
def leave_workspace(workspace: str):
	"""
	Leaves a workspace
	"""
	member = frappe.db.exists(
		"Raven Workspace Member", {"workspace": workspace, "user": frappe.session.user}
	)
	if member:
		member_doc = frappe.get_doc("Raven Workspace Member", member)
		member_doc.delete()

	else:
		frappe.throw(_("You are not a member of this workspace."), frappe.PermissionError)


def is_workspace_admin(workspace: str):
	"""
	Checks if the current user is an admin of a workspace
	"""
	workspace_member = frappe.get_doc(
		"Raven Workspace Member", {"workspace": workspace, "user": frappe.session.user}
	)

	if workspace_member and workspace_member.is_admin:
		return True

	return False


@frappe.whitelist()
def fetch_workspace_members(workspace: str):
	"""
	Gets all members of a workspace
	"""
	frappe.has_permission("Raven Workspace", doc=workspace, throw=True)
	return frappe.get_all(
		"Raven Workspace Member",
		filters={"workspace": workspace},
		fields=["user", "is_admin", "creation", "name"],
	)


@frappe.whitelist()
def add_workspace_members(workspace: str, members: list):
	"""
	Adds members to a workspace
	"""
	frappe.has_permission("Raven Workspace", doc=workspace, ptype="write", throw=True)

	# Since this is a bulk operation, we need to disable cache invalidation (will be handled manually) and ignore permissions (since we already have permission to add members)

	for member in members:
		member_doc = frappe.get_doc(
			{"doctype": "Raven Workspace Member", "workspace": workspace, "user": member}
		)
		member_doc.flags.ignore_cache_invalidation = True
		member_doc.insert(ignore_permissions=True)

	delete_workspace_members_cache(workspace)
