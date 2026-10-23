from raven.raven.doctype.raven_workspace_member.raven_workspace_member import on_doctype_update


def execute():
	"""The doctype JSON is unchanged, so sync alone would not add the constraint."""
	on_doctype_update()
