import frappe
from frappe.desk.utils import slug
from frappe.model import no_value_fields, table_fields
from frappe.utils import get_url


def get_new_app_document_links(doctype, docname):
	"""
	New apps like Frappe CRM etc have a different link.
	"""
	# TODO: Add the other app routes here
	routes = {
		"CRM Lead": "/crm/leads/",
	}

	return routes.get(doctype) + docname if doctype in routes else None


@frappe.whitelist(methods=["GET"])
def get(doctype: str, docname: str | int, with_site_url: bool = True):

	document_link_override = frappe.get_hooks("raven_document_link_override")
	if document_link_override and len(document_link_override) > 0:

		# Loop over all the hooks and return the first non-None value
		for hook in document_link_override:
			link = frappe.get_attr(hook)(doctype, docname)
			if link:
				if with_site_url:
					return get_url(allow_header_override=False) + link
				return link

	if with_site_url:
		return frappe.utils.get_url(allow_header_override=False) + f"/desk/{slug(doctype)}/{docname}"

	return f"/desk/{slug(doctype)}/{docname}"


@frappe.whitelist(methods=["GET"])
def get_preview_data(doctype: str, docname: str | int):
	preview_fields = []
	meta = frappe.get_meta(doctype)

	preview_fields = [
		field.fieldname
		for field in meta.fields
		if field.in_preview
		and field.fieldtype not in no_value_fields
		and field.fieldtype not in table_fields
	]

	# no preview fields defined, build list from mandatory fields
	if not preview_fields:
		preview_fields = [
			field.fieldname for field in meta.fields if field.reqd and field.fieldtype not in table_fields
		]

	title_field = meta.get_title_field()
	image_field = meta.image_field

	preview_fields.append(title_field)
	preview_fields.append(image_field)
	preview_fields.append("name")

	preview_data = frappe.get_list(doctype, filters={"name": docname}, fields=preview_fields, limit=1)

	if not preview_data:
		return

	preview_data = preview_data[0]

	formatted_preview_data = {
		"preview_image": preview_data.get(image_field),
		"preview_title": preview_data.get(title_field),
		"id": preview_data.get("name"),
		"raven_document_link": get(doctype, docname),
	}

	for key, val in preview_data.items():
		if val and meta.has_field(key) and key not in [image_field, title_field, "name"]:
			formatted_preview_data[meta.get_field(key).label] = frappe.format(
				val,
				meta.get_field(key).fieldtype,
				translated=True,
			)

	return formatted_preview_data


@frappe.whitelist(methods=["POST"])
def update_preview_fields(doctype: str, fields: list[str]):
	# Writes property setters, which change the doctype for the whole site.
	frappe.only_for("System Manager")

	meta = frappe.get_meta(doctype)

	existing_preview_fields = [
		field.fieldname
		for field in meta.fields
		if field.in_preview
		and field.fieldtype not in no_value_fields
		and field.fieldtype not in table_fields
	]

	for field in set(existing_preview_fields) - set(fields):
		_set_in_preview(doctype, field, 0)

	for field in fields:
		if meta.get_field(field):
			_set_in_preview(doctype, field, 1)


def _default_in_preview(doctype: str, fieldname: str) -> int:
	"""What in_preview is without any property setter: the DocField or Custom Field definition."""
	value = frappe.db.get_value("DocField", {"parent": doctype, "fieldname": fieldname}, "in_preview")
	if value is None:
		value = frappe.db.get_value(
			"Custom Field", {"dt": doctype, "fieldname": fieldname}, "in_preview"
		)
	return int(value or 0)


def _set_in_preview(doctype: str, fieldname: str, value: int):
	"""
	Make in_preview for a field equal `value`. Clears any existing property setter, then
	adds one only when the field's own definition says otherwise. That covers turning a
	default-on field off as well as turning a default-off field on.
	"""
	delete_property_setter(doctype, field_name=fieldname, property="in_preview")

	if _default_in_preview(doctype, fieldname) == value:
		return

	frappe.make_property_setter(
		{
			"doctype": doctype,
			"doctype_or_field": "DocField",
			"fieldname": fieldname,
			"property": "in_preview",
			"value": str(value),
			"property_type": "Check",
		},
		is_system_generated=False,
	)


def delete_property_setter(doc_type, property=None, field_name=None, row_name=None):
	"""delete other property setters on this, if this is new"""
	filters = {"doc_type": doc_type}
	if property:
		filters["property"] = property

	if field_name:
		filters["field_name"] = field_name
	if row_name:
		filters["row_name"] = row_name

	property_setters = frappe.db.get_values("Property Setter", filters)
	for ps in property_setters:
		frappe.get_doc("Property Setter", ps).delete(force=True)
