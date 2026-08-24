import frappe


def execute():
	"""
	Migrate links from small text field to table in Raven Message doctype.

	This will also create a Raven Link Preview document for each unique link.
	"""

	raven_message = frappe.qb.DocType("Raven Message")
	messages = (
		frappe.qb.from_(raven_message)
		.select(raven_message.name, raven_message.links)
		.where(raven_message.links.isnotnull())
		.where(raven_message.links != "")
		.run(as_dict=True)
	)

	child_table_values = []
	unique_links = set()

	for msg in messages:
		# Skip non-string links
		if not msg.links or not isinstance(msg.links, str):
			continue

		for url in msg.links.split("|"):
			if not url:
				continue

			if not frappe.db.exists("Raven Message Links", {"parent": msg.name, "url": url}):
				unique_links.add((url, url))
				child_table_values.append(
					(frappe.generate_hash(length=10), msg.name, "Raven Message", "links", url)
				)

	if child_table_values:
		frappe.db.bulk_insert(
			"Raven Message Links",
			fields=["name", "parent", "parenttype", "parentfield", "url"],
			values=child_table_values,
			ignore_duplicates=True,
		)

	if unique_links:
		frappe.db.bulk_insert(
			"Raven Link Preview", fields=["name", "url"], values=unique_links, ignore_duplicates=True
		)
