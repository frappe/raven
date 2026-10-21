import json

import frappe
from frappe import _
from google.api_core.client_options import ClientOptions
from google.cloud import documentai, documentai_v1
from google.oauth2 import service_account


@frappe.whitelist()
def get_document_ai_processors():
	"""
	Get the list of document AI processors available for the Google Cloud project.

	NOTE: This is not in use, but keeping it here for future reference.
	"""
	frappe.has_permission("Raven Settings", ptype="read", throw=True)

	raven_settings = frappe.get_single("Raven Settings")
	if not raven_settings.enable_google_apis:
		return []

	location = raven_settings.google_processor_location

	key = json.loads(raven_settings.get_password("google_service_account_json_key"))

	# Create credentials from the API key
	credentials = service_account.Credentials.from_service_account_info(key)

	client_options = ClientOptions(api_endpoint=f"{location}-documentai.googleapis.com")
	client = documentai.DocumentProcessorServiceClient(
		credentials=credentials, client_options=client_options
	)

	# The full resource name of the location
	# e.g.: projects/project_id/locations/location
	parent = client.common_location_path(raven_settings.google_project_id, location)

	# Fetch all processor types
	response = client.list_processors(parent=parent)

	processors = []
	# Print the available processor types
	for processor in response:
		if processor.type_ == "FORM_PARSER_PROCESSOR":
			processors.append(
				{
					"id": processor.name,
					"display_name": processor.display_name,
					"type": processor.type_,
				}
			)

	return processors


def run_document_ai_processor(processor_id: str, file_path: str, extension: str):
	"""
	Run the document AI processor on the given file.
	"""
	if extension not in ["jpg", "jpeg", "png", "pdf"]:
		return ""

	mapping = {
		"jpg": "image/jpeg",
		"jpeg": "image/jpeg",
		"png": "image/png",
		"pdf": "application/pdf",
	}

	file_doc = frappe.get_doc("File", {"file_url": file_path})

	content = file_doc.get_content()

	raven_settings = frappe.get_single("Raven Settings")
	if not raven_settings.enable_google_apis:
		return []

	location = raven_settings.google_processor_location

	key = json.loads(raven_settings.get_password("google_service_account_json_key"))

	credentials = service_account.Credentials.from_service_account_info(key)

	client_options = ClientOptions(api_endpoint=f"{location}-documentai.googleapis.com")
	client = documentai.DocumentProcessorServiceClient(
		credentials=credentials, client_options=client_options
	)
	full_processor_name = client.processor_path(
		raven_settings.google_project_id, location, processor_id
	)

	request = documentai_v1.GetProcessorRequest(name=full_processor_name)
	processor = client.get_processor(request=request)

	raw_document = documentai_v1.RawDocument(content=content, mime_type=mapping[extension])

	request = documentai_v1.ProcessRequest(name=processor.name, raw_document=raw_document)

	result = client.process_document(request=request)

	document = result.document
	# get the form fields from the document
	form_fields = {}

	# Try to get form fields from pages
	if hasattr(document, "pages"):
		for page in document.pages:
			if hasattr(page, "form_fields"):
				for form_field in page.form_fields:
					# Get the field name and value
					field_name = form_field.field_name.text_anchor.content.strip()
					field_value = form_field.field_value.text_anchor.content.strip()

					if field_value == "\u2611":
						field_value = "Yes"

					form_fields[field_name] = field_value

	# If there are no form fields, let's use the text and add it as well
	if len(form_fields) == 0:
		return document.text
	else:
		# Return the form fields as a string
		return "\n".join([f"{k}: {v}" for k, v in form_fields.items()])


@frappe.whitelist(methods=["GET"])
def get_list_of_processors():
	"""
	Get the list of document processors available for the Google Cloud project.
	"""
	frappe.has_permission("Raven Settings", ptype="read", throw=True)

	raven_settings = frappe.get_single("Raven Settings")
	if not raven_settings.enable_google_apis:
		return []

	location = raven_settings.google_processor_location

	key = json.loads(raven_settings.get_password("google_service_account_json_key"))

	credentials = service_account.Credentials.from_service_account_info(key)

	client_options = ClientOptions(api_endpoint=f"{location}-documentai.googleapis.com")
	client = documentai.DocumentProcessorServiceClient(
		credentials=credentials, client_options=client_options
	)

	parent = client.common_location_path(raven_settings.google_project_id, location)

	processor_list = client.list_processors(parent=parent)

	existing_processors = []

	for processor in processor_list:
		existing_processors.append(
			{
				"id": processor.name.split("/")[-1],
				"name": processor.name,
				"display_name": processor.display_name,
				"type": processor.type_,
				"processor_type_key": processor.type_,
				"state": processor.state,
			}
		)

	return existing_processors


PROCESSOR_TYPES_CONFIG = {
	"OCR_PROCESSOR": {
		"type": "OCR_PROCESSOR",
		"display_name": "Enterprise Document OCR",
		"description": "Identify and extract text from any document type including handwritten text with 200+ language support",
		"best_for": [
			"General text extraction",
			"Multi-language documents",
			"Handwriting recognition",
		],
		"pricing": "$1.50 per 1,000 pages",
		"category": "digitize",
	},
	"FORM_PARSER": {
		"type": "FORM_PARSER_PROCESSOR",
		"display_name": "Form Parser",
		"description": "Extract key-value pairs, checkboxes, tables, and generic entities from documents with 200+ language support",
		"best_for": ["Application forms", "Surveys", "Registration forms", "Structured data"],
		"pricing": "$30 per 1,000 pages",
		"category": "extract",
	},
	"BANK_STATEMENT": {
		"type": "BANK_STATEMENT_PROCESSOR",
		"display_name": "Bank Statement Parser",
		"description": "Extract account info, transactions, and balances from bank statements",
		"best_for": ["Financial analysis", "Loan processing", "Bank statement digitization"],
		"pricing": "$0.10 per classified document",
		"category": "specialized",
	},
	"INVOICE_PARSER": {
		"type": "INVOICE_PROCESSOR",
		"display_name": "Invoice Parser",
		"description": "Extract invoice header and line item fields including invoice number, supplier name, amounts, tax, dates, and due dates",
		"best_for": [
			"Invoice processing",
			"Accounts payable automation",
			"Tax document preparation",
			"Financial record keeping",
		],
		"pricing": "$0.10 per 10 pages in a document",
		"category": "specialized",
	},
	"EXPENSE_PARSER": {
		"type": "EXPENSE_PROCESSOR",
		"display_name": "Receipt Parser",
		"description": "Extract key fields from receipts and expense documents including merchant name, transaction date, total amount, tax, payment method, and line items.",
		"best_for": ["Expense reports", "Travel reimbursements", "Receipt digitization"],
		"pricing": "$0.10 per 10 pages in a document",
		"category": "specialized",
	},
}


@frappe.whitelist(methods=["GET"])
def get_available_processor_types():
	"""Get available processor types with detailed information for UI"""
	frappe.has_permission("Raven Settings", ptype="read", throw=True)

	return PROCESSOR_TYPES_CONFIG


@frappe.whitelist(methods=["POST"])
def create_document_processor(processor_type_key: str):
	"""
	Create a processor of the specified type.
	processor_type_key: The key of the processor type to create.
	Returns:
	        dict: A dictionary containing the processor details.
	"""
	# Creating a processor is billable. Only users who can change Raven
	# Settings (System Manager, Raven Admin) may do it.
	frappe.has_permission("Raven Settings", ptype="write", throw=True)

	if processor_type_key not in PROCESSOR_TYPES_CONFIG:
		frappe.throw(f"Invalid processor type: {processor_type_key}")

	raven_settings = frappe.get_single("Raven Settings")
	if not raven_settings.enable_google_apis:
		frappe.throw(_("Google APIs are not enabled. Please enable them in the Raven Settings."))

	# Get the processor type configuration
	config = PROCESSOR_TYPES_CONFIG[processor_type_key]
	processor_type = config["type"]

	# manually set the display name
	display_name = f"Raven-{config['display_name']}"

	location = raven_settings.google_processor_location
	key = json.loads(raven_settings.get_password("google_service_account_json_key"))
	credentials = service_account.Credentials.from_service_account_info(key)

	client_options = ClientOptions(api_endpoint=f"{location}-documentai.googleapis.com")
	client = documentai.DocumentProcessorServiceClient(
		credentials=credentials, client_options=client_options
	)

	parent = client.common_location_path(raven_settings.google_project_id, location)

	try:
		processor = client.create_processor(
			parent=parent,
			processor=documentai.Processor(display_name=display_name, type_=processor_type),
		)
		if not processor:
			frappe.throw(_("Failed to create processor"))

		return {
			"id": processor.name.split("/")[-1],
			"full_name": processor.name,
			"display_name": processor.display_name,
			"type": processor.type_,
			"processor_type_key": processor_type_key,
			"state": processor.state,
		}
	except Exception as e:
		frappe.log_error(f"Error creating document processor {str(e)}")
		frappe.throw(_("Failed to create document processor"))


@frappe.whitelist(methods=["POST"])
def delete_document_processor(processor_id: str):
	"""
	Delete a document processor.
	processor_id: The ID of the processor to delete.
	"""
	# Deleting is permanent and also clears the processor from every bot
	# that used it. Same gate as create.
	frappe.has_permission("Raven Settings", ptype="write", throw=True)

	raven_settings = frappe.get_single("Raven Settings")
	if not raven_settings.enable_google_apis:
		frappe.throw(_("Google APIs are not enabled. Please enable them in the Raven Settings."))

	location = raven_settings.google_processor_location
	key = json.loads(raven_settings.get_password("google_service_account_json_key"))
	credentials = service_account.Credentials.from_service_account_info(key)

	client_options = ClientOptions(api_endpoint=f"{location}-documentai.googleapis.com")
	client = documentai.DocumentProcessorServiceClient(
		credentials=credentials, client_options=client_options
	)

	parent = client.common_location_path(raven_settings.google_project_id, location)

	processor_name = client.processor_path(raven_settings.google_project_id, location, processor_id)

	try:
		client.delete_processor(name=processor_name)

		# if any agent is using this processor, set the processor id to none for all those agents
		agents = frappe.get_all(
			"Raven Bot",
			filters={
				"is_ai_bot": 1,
				"use_google_document_parser": 1,
				"google_document_processor_id": processor_id,
			},
			fields=["name"],
		)
		if not agents:
			return {"message": "Document processor deleted successfully"}

		for agent in agents:
			frappe.db.set_value(
				"Raven Bot",
				agent.name,
				{
					"use_google_document_parser": 0,
					"google_document_processor_id": None,
				},
			)

	except Exception as e:
		frappe.log_error(f"Error deleting document processor {str(e)}")
		frappe.throw(_("Failed to delete document processor"))

	return {"message": "Document processor deleted successfully"}
