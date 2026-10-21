import json

import frappe
from openai import AssistantEventHandler
from openai.types.beta.threads import Text
from openai.types.beta.threads.runs import RunStep
from typing_extensions import override

from raven.ai.functions import (
	attach_file_to_document,
	cancel_document,
	create_document,
	create_documents,
	delete_document,
	delete_documents,
	get_amended_document,
	get_document,
	get_documents,
	get_list,
	get_report_result,
	get_value,
	set_value,
	submit_document,
	update_document,
	update_documents,
)
from raven.ai.openai_client import get_open_ai_client


def stream_response(ai_thread_id: str, bot, channel_id: str):

	client = get_open_ai_client()

	assistant_id = bot.openai_assistant_id

	docs_updated = []

	class EventHandler(AssistantEventHandler):
		@override
		def on_run_step_done(self, run_step: RunStep) -> None:
			details = run_step.step_details
			if details.type == "tool_calls":
				for tool in details.tool_calls:
					if tool.type == "code_interpreter":
						self.publish_event("Running code...")
					if tool.type == "file_search":
						self.publish_event("Searching file contents...")
			else:
				self.publish_event("Raven AI is thinking...")

		@override
		def on_text_done(self, text: Text):
			link_doctype = None
			link_document = None
			if len(docs_updated) == 1:
				link_doctype = docs_updated[0]["doctype"]
				link_document = docs_updated[0]["document_id"]

			file_urls = []

			# Check if there are any annotations with files
			annotations = text.annotations
			for annotation in annotations:
				if annotation.type == "file_path":
					file_path = annotation.file_path
					file_id = file_path.file_id
					file_name = annotation.text.split("/")[-1]
					file_content = client.files.content(file_id)

					file_doc = frappe.get_doc(
						{
							"doctype": "File",
							"file_name": file_name,
							"content": file_content.read(),
							"is_private": True,
						}
					)
					file_doc.insert()
					file_urls.append(
						{
							"url": file_doc.file_url,
							"text": annotation.text,
						}
					)

			if file_urls:
				# If there are amy file URLs, replace the content with the URL and send the file as a separate message
				for file_url in file_urls:
					text.value = text.value.replace(file_url["text"], file_url["url"])

				bot.send_message(
					channel_id=channel_id,
					text=text.value,
					link_doctype=link_doctype,
					link_document=link_document,
					markdown=True,
				)

				for file_url in file_urls:
					bot.send_message(channel_id=channel_id, file=file_url["url"])

			else:
				bot.send_message(
					channel_id=channel_id,
					text=text.value,
					link_doctype=link_doctype,
					link_document=link_document,
					markdown=True,
				)

			frappe.publish_realtime(
				"ai_event_clear",
				{
					"channel_id": channel_id,
				},
				doctype="Raven Channel",
				docname=channel_id,
				after_commit=True,
			)

		@override
		def on_event(self, event):
			# Handle image and file outputs
			if event.event == "thread.message.delta":
				if hasattr(event.data, "delta") and hasattr(event.data.delta, "content"):
					for content in event.data.delta.content:
						if content.type == "image_file":
							# Handle image file
							file_id = content.image_file.file_id
							file = client.files.retrieve(file_id)
							file_content = client.files.content(file_id)

							# Save the file content
							file_doc = frappe.new_doc("File")
							file_doc.file_name = file.filename + ".png"
							file_doc.content = file_content.read()
							file_doc.is_private = True
							file_doc.insert()

							bot.send_message(channel_id=channel_id, file=file_doc.file_url)

			# Handle tool calls
			elif event.event == "thread.run.requires_action":
				run_id = event.data.id
				self.handle_requires_action(event.data, run_id)

		def publish_event(self, text):
			frappe.publish_realtime(
				"ai_event",
				{
					"text": text,
					"channel_id": channel_id,
					"bot": bot.name,
				},
				doctype="Raven Channel",
				docname=channel_id,
			)

		def handle_requires_action(self, data, run_id):
			tool_outputs = []

			for tool in data.required_action.submit_tool_outputs.tool_calls:

				function = None

				try:
					function = frappe.get_cached_doc("Raven AI Function", tool.function.name)
				except frappe.DoesNotExistError:
					tool_outputs.append({"tool_call_id": tool.id, "output": "Function not found"})
					return

				# When calling the function, we need to pass the arguments as named params/json
				# Args is a dictionary of the form {"param_name": "param_value"}

				try:
					args = json.loads(tool.function.arguments)

					# Check the type of function and then call it accordingly

					function_output = {}

					if function.type == "Custom Function":
						function_name = frappe.get_attr(function.function_path)

						if bot.allow_bot_to_write_documents:
							# We can commit to the database if writes are allowed
							if function.pass_parameters_as_json:
								function_output = function_name(args)
							else:
								function_output = function_name(**args)
						else:
							# We need to savepoint and then rollback
							frappe.db.savepoint(run_id + "_" + tool.id)
							if function.pass_parameters_as_json:
								function_output = function_name(args)
							else:
								function_output = function_name(**args)
							frappe.db.rollback(save_point=run_id + "_" + tool.id)

					if function.type == "Get Document":
						self.publish_event(
							"Fetching {} {}...".format(function.reference_doctype, args.get("document_id"))
						)
						function_output = get_document(function.reference_doctype, **args)

					if function.type == "Get Multiple Documents":
						self.publish_event(f"Fetching multiple {function.reference_doctype}s...")
						function_output = get_documents(function.reference_doctype, **args)

					if function.type == "Submit Document":
						self.publish_event(f"Submitting {function.reference_doctype} {args.get('document_id')}...")
						function_output = submit_document(function.reference_doctype, **args)

					if function.type == "Cancel Document":
						self.publish_event(f"Cancelling {function.reference_doctype} {args.get('document_id')}...")
						function_output = cancel_document(function.reference_doctype, **args)

					if function.type == "Get Amended Document":
						self.publish_event(
							f"Fetching amended document for {function.reference_doctype} {args.get('document_id')}..."
						)
						function_output = get_amended_document(function.reference_doctype, **args)

					if function.type == "Delete Document":
						self.publish_event(
							"Deleting {} {}...".format(function.reference_doctype, args.get("document_id"))
						)
						function_output = delete_document(function.reference_doctype, **args)

					if function.type == "Delete Multiple Documents":
						self.publish_event(f"Deleting multiple {function.reference_doctype}s...")
						function_output = delete_documents(function.reference_doctype, **args)

					if function.type == "Create Document":
						self.publish_event(f"Creating {function.reference_doctype}...")
						function_output = create_document(function.reference_doctype, data=args, function=function)

						docs_updated.append(
							{"doctype": function.reference_doctype, "document_id": function_output.get("document_id")}
						)

					if function.type == "Create Multiple Documents":
						self.publish_event(f"Creating multiple {function.reference_doctype}s...")
						function_output = create_documents(
							function.reference_doctype, data=args.get("data"), function=function
						)

						for doc_id in function_output.get("documents"):
							docs_updated.append({"doctype": function.reference_doctype, "document_id": doc_id})

					if function.type == "Update Document":
						self.publish_event(f"Updating {function.reference_doctype}...")
						function_output = update_document(
							function.reference_doctype,
							document_id=args.get("document_id"),
							data=args,
							function=function,
						)

						docs_updated.append(
							{"doctype": function.reference_doctype, "document_id": args.get("document_id")}
						)

					if function.type == "Update Multiple Documents":
						self.publish_event(f"Updating multiple {function.reference_doctype}s...")
						function_output = update_documents(
							function.reference_doctype, data=args.get("data"), function=function
						)

						for doc_id in function_output.get("documents"):
							docs_updated.append({"doctype": function.reference_doctype, "document_id": doc_id})

					if function.type == "Attach File to Document":
						doctype = args.get("doctype")
						document_id = args.get("document_id")
						file_path = args.get("file_path")
						self.publish_event(f"Attaching file to {doctype} {document_id}...")
						function_output = attach_file_to_document(doctype, document_id, file_path)

					if function.type == "Get List":
						self.publish_event(f"Fetching list of {function.reference_doctype}...")
						function_output = get_list(
							function.reference_doctype,
							filters=args.get("filters"),
							fields=args.get("fields"),
							limit=args.get("limit", 20),
						)

					if function.type == "Get Value":
						self.publish_event(f"Fetching value for {function.reference_doctype}...")
						function_output = get_value(
							doctype=function.reference_doctype,
							filters=args.get("filters"),
							fieldname=args.get("fieldname"),
						)

					if function.type == "Set Value":
						self.publish_event(f"Setting value for {function.reference_doctype}...")
						function_output = set_value(
							doctype=function.reference_doctype,
							document_id=args.get("document_id"),
							fieldname=args.get("fieldname"),
							value=args.get("value"),
						)

					if function.type == "Get Report Result":
						self.publish_event(f"Running report {args.get('report_name')}...")
						function_output = get_report_result(
							report_name=args.get("report_name"),
							filters=args.get("filters"),
							user=args.get("user", frappe.session.user),
							ignore_prepared_report=args.get("ignore_prepared_report", False),
							are_default_filters=args.get("are_default_filters", True),
						)
					tool_outputs.append(
						{"tool_call_id": tool.id, "output": json.dumps(function_output, default=str)}
					)

				except Exception as e:
					frappe.log_error("Raven AI Error", frappe.get_traceback())

					if bot.debug_mode:
						bot.send_message(
							channel_id=channel_id,
							text=f"<details data-summary='Error in function call'><p>{frappe.get_traceback()}</p></details>",
						)
					tool_outputs.append(
						{
							"tool_call_id": tool.id,
							"output": json.dumps(
								{
									"message": "There was an error in the function call",
									"error": frappe.get_traceback(),
								},
								default=str,
							),
						}
					)

			# Submit all tool_outputs at the same time
			self.submit_tool_outputs(tool_outputs, run_id)

		def submit_tool_outputs(self, tool_outputs, run_id):
			# Use the submit_tool_outputs_stream helper
			with client.beta.threads.runs.submit_tool_outputs_stream(
				thread_id=self.current_run.thread_id,
				run_id=self.current_run.id,
				tool_outputs=tool_outputs,
				event_handler=EventHandler(),
			) as stream:
				self.publish_event("Raven AI is thinking...")
				for text in stream.text_deltas:
					print(text, end="", flush=True)
				print()

	# We need to get the instructions from the bot
	instructions = get_instructions(bot)
	with client.beta.threads.runs.stream(
		thread_id=ai_thread_id,
		assistant_id=assistant_id,
		event_handler=EventHandler(),
		instructions=instructions,
	) as stream:
		try:
			stream.until_done()
		except Exception as e:
			frappe.log_error("Raven AI Error", frappe.get_traceback())
			bot.send_message(
				channel_id=channel_id,
				text=f"There was an error in the AI thread. Please try again.<br/>Error: {str(e)}",
			)
			frappe.publish_realtime(
				"ai_event_clear",
				{
					"channel_id": channel_id,
				},
				doctype="Raven Channel",
				docname=channel_id,
				after_commit=True,
			)


def get_instructions(bot):

	# If no instruction is set, or dynamic instruction is disabled, we return None
	if not bot.instruction or not bot.dynamic_instructions:
		return None

	vars = get_variables_for_instructions()

	# Bot instructions are set by Raven Admins only. The renderer is sandboxed.
	# nosemgrep: frappe-ssti
	instructions = frappe.render_template(bot.instruction, vars)
	return instructions


def get_variables_for_instructions():
	user = frappe.get_cached_doc("User", frappe.session.user)

	employee_company = None
	company = None
	employee_id = None
	department = None

	if "erpnext" in frappe.get_installed_apps():
		employee_id = frappe.db.exists("Employee", {"user_id": frappe.session.user})

		if employee_id:
			employee = frappe.get_cached_doc("Employee", employee_id)
			employee_company = employee.company
			department = employee.department

		company = frappe.defaults.get_user_default("company") or frappe.db.get_single_value(
			"Global Defaults", "default_company"
		)

	return {
		"first_name": user.first_name,
		"full_name": user.full_name,
		"email": user.email,
		"user_id": frappe.session.user,
		"company": company,
		"employee_id": employee_id,
		"department": department,
		"employee_company": employee_company,
		"lang": user.language.upper() if user.language else "EN",
	}
