import frappe
from frappe.query_builder.functions import Count

from raven.utils import delete_workspace_members_cache


def execute():
	"""
	Runs before the unique constraint on (workspace, user) is added. Where a user has
	several member rows in one workspace, the oldest row is kept. It becomes an admin if
	any of the duplicates was one, so nobody loses admin rights.
	"""
	member = frappe.qb.DocType("Raven Workspace Member")
	duplicates = (
		frappe.qb.from_(member)
		.select(member.workspace, member.user)
		.groupby(member.workspace, member.user)
		.having(Count(member.name) > 1)
	).run(as_dict=True)

	for pair in duplicates:
		rows = frappe.get_all(
			"Raven Workspace Member",
			filters={"workspace": pair.workspace, "user": pair.user},
			fields=["name", "is_admin"],
			# The name breaks a tie between rows created in the same instant.
			order_by="creation asc, name asc",
		)
		keeper, extras = rows[0], rows[1:]
		if not keeper.is_admin and any(row.is_admin for row in extras):
			frappe.db.set_value("Raven Workspace Member", keeper.name, "is_admin", 1, update_modified=False)
		frappe.db.delete("Raven Workspace Member", {"name": ("in", [row.name for row in extras])})

	for workspace in {pair.workspace for pair in duplicates}:
		delete_workspace_members_cache(workspace)
