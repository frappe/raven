# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _
from frappe.model.document import Document
from openai import APIConnectionError

from raven.ai.openai_client import (
	code_interpreter_file_types,
	file_search_file_types,
	get_open_ai_client,
)
from raven.utils import get_raven_user


class RavenBot(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from raven.raven_ai.doctype.raven_ai_bot_files.raven_ai_bot_files import RavenAIBotFiles
		from raven.raven_ai.doctype.raven_bot_functions.raven_bot_functions import RavenBotFunctions

		allow_bot_to_write_documents: DF.Check
		bot_functions: DF.Table[RavenBotFunctions]
		bot_name: DF.Data
		debug_mode: DF.Check
		description: DF.SmallText | None
		dynamic_instructions: DF.Check
		enable_code_interpreter: DF.Check
		enable_file_search: DF.Check
		file_sources: DF.Table[RavenAIBotFiles]
		google_document_processor_id: DF.Data | None
		image: DF.AttachImage | None
		instruction: DF.LongText | None
		is_ai_bot: DF.Check
		is_standard: DF.Check
		model: DF.Data | None
		model_provider: DF.Literal["OpenAI", "Local LLM"]
		module: DF.Link | None
		openai_assistant_id: DF.Data | None
		openai_vector_store_id: DF.Data | None
		raven_user: DF.Link | None
		reasoning_effort: DF.Literal["low", "medium", "high"]
		temperature: DF.Float
		top_p: DF.Float
		use_google_document_parser: DF.Check
	# end: auto-generated types

	def validate(self):
		if self.is_ai_bot and not self.instruction:
			frappe.throw(_("Please provide an instruction for this AI Agent."))

		if self.use_google_document_parser and not self.google_document_processor_id:
			frappe.throw(_("Please select a Document Processor for this bot."))

		self.validate_functions()

	def validate_functions(self):
		if not self.allow_bot_to_write_documents:
			for f in self.bot_functions:
				needs_write = frappe.db.get_value(
					"Raven AI Function", f.function, "requires_write_permissions"
				)
				if needs_write:
					frappe.throw(
						f"This agent is not allowed to write documents. Please remove the function {f.function} or allow the agent to write documents."
					)

	def on_update(self):
		"""
		When a bot is updated, create/update the Raven User for it

		TODO: Generate JSON files when a Standard Bot is created or updated
		"""
		if self.raven_user:
			raven_user = frappe.get_doc("Raven User", self.raven_user)
			raven_user.type = "Bot"
			raven_user.bot = self.name
			raven_user.full_name = self.bot_name
			raven_user.first_name = self.bot_name
			raven_user.user_image = self.image
			raven_user.enabled = 1
			raven_user.save()
		else:
			raven_user = frappe.new_doc("Raven User")
			raven_user.type = "Bot"
			raven_user.bot = self.name
			raven_user.full_name = self.bot_name
			raven_user.first_name = self.bot_name
			raven_user.user_image = self.image
			raven_user.enabled = 1
			raven_user.save()

			self.db_set("raven_user", raven_user.name)

		if self.is_ai_bot:
			# Only create OpenAI assistant if using OpenAI provider (not for Agents SDK)
			if self.model_provider == "OpenAI":
				# Skip assistant creation if we're using Agents SDK even with OpenAI
				# TODO: In future, we should completely phase out assistant creation
				if not self.openai_assistant_id:
					self.create_openai_assistant()
				else:
					self.update_openai_assistant()
			else:
				# For Local LLM or future Agents SDK, no assistant needed
				if self.openai_assistant_id:
					# Clear assistant ID if switching from OpenAI to Local LLM
					self.db_set("openai_assistant_id", None)
					return

	def before_insert(self):
		if self.is_ai_bot and not self.openai_assistant_id:
			# Only create OpenAI assistant if using OpenAI provider (not for Agents SDK)
			if self.model_provider == "OpenAI":
				# Skip assistant creation for Local LLM
				self.create_openai_assistant()
			elif self.model_provider == "Local LLM":
				# For Local LLM, we don't need an OpenAI assistant
				return

	def on_trash(self):
		if self.openai_assistant_id:
			self.delete_openai_assistant()

		if self.raven_user:
			frappe.db.set_value("Raven User", self.raven_user, "bot", None)
			self.db_set("raven_user", None)
			frappe.delete_doc("Raven User", self.raven_user)

	def create_openai_assistant(self):
		# Create an OpenAI Assistant for the bot (legacy - being phased out for Agents SDK)
		# Check again to ensure we're not creating for Local LLM
		if self.model_provider == "Local LLM":
			return

		client = get_open_ai_client()

		# Sometimes users face an issue with the OpenAI API returning an error for "model_not_found"
		# This is usually because the user has not added funds to their OpenAI account.
		# We need to show this error to the user if the openAI API returns an error for "model_not_found"

		model = self.model or "gpt-4o"

		reasoning_effort = self.reasoning_effort or "medium"

		try:
			assistant = client.beta.assistants.create(
				instructions=self.instruction,
				model=model,
				name=self.bot_name,
				description=self.description or "",
				tools=self.get_tools_for_assistant(),
				tool_resources=self.get_tool_resources_for_assistant(),
				reasoning_effort=reasoning_effort if model.startswith("o") else None,
				temperature=self.temperature or 1,
				top_p=self.top_p or 1,
			)
			# Update the tools which were activated for the bot
			self.db_set("openai_assistant_id", assistant.id)
			self.check_and_update_enabled_tools(assistant)

		except APIConnectionError as e:
			frappe.throw(
				_(
					"Connection to OpenAI API failed. Please check your Organization ID and API Key for any extra spaces. Error: {0}"
				).format(str(e))
			)
		except Exception as e:
			if "model_not_found" in str(e):
				frappe.throw(
					_(
						f"<strong>There was an error creating the agent in OpenAI.</strong><br/>It is possible that your OpenAI account does not have enough funds or the model {model} is not available. Please add funds to your OpenAI account and try again.<br><br/>Error: {e}"
					)
				)
			else:
				frappe.throw(str(e))

	def update_openai_assistant(self):
		# Update the OpenAI Assistant for the bot (legacy - being phased out for Agents SDK)

		# Additional check because it is being used in Raven AI Function
		if not self.is_ai_bot:
			return

		# Don't update assistant for Local LLM bots
		if self.model_provider == "Local LLM":
			return

		client = get_open_ai_client()

		model = self.model or "gpt-4o"
		reasoning_effort = self.reasoning_effort or "medium"

		try:
			assistant = client.beta.assistants.update(
				self.openai_assistant_id,
				instructions=self.instruction,
				name=self.bot_name,
				description=self.description or "",
				tools=self.get_tools_for_assistant(),
				tool_resources=self.get_tool_resources_for_assistant(),
				model=model,
				reasoning_effort=reasoning_effort if model.startswith("o") else None,
				temperature=self.temperature or 1,
				top_p=self.top_p or 1,
			)
			self.check_and_update_enabled_tools(assistant)
		except Exception as e:
			if "model_not_found" in str(e):
				frappe.throw(
					_(
						f"<strong>There was an error updating the agent in OpenAI.</strong><br/>It is possible that your OpenAI account does not have enough funds or the model {model} is not available. Please check your account and try again.<br><br/>Error: {e}"
					)
				)
			else:
				frappe.throw(str(e))

	def check_and_update_enabled_tools(self, assistant):
		# Check if the tools which were activated for the bot are still available
		# If not, deactivate them
		try:
			available_tools = [tool.type for tool in assistant.tools]

			code_interpreter_enabled = "code_interpreter" in available_tools
			file_search_enabled = "file_search" in available_tools

			if self.enable_code_interpreter and not code_interpreter_enabled:
				self.db_set("enable_code_interpreter", 0)
				frappe.msgprint(
					_(
						"The code interpreter tool is not available for the model {0}, hence it has been disabled."
					).format(self.model)
				)

			if self.enable_file_search and not file_search_enabled:
				self.db_set("enable_file_search", 0)
				frappe.msgprint(
					_(
						"The file search tool is not available for the model {0}, hence it has been disabled."
					).format(self.model)
				)
		except Exception as e:
			frappe.log_error(
				f"Raven AI Bot Tool Check Error for {self.name}",
				str(e),
			)

	def get_tools_for_assistant(self):
		# Add the function to the assistant
		tools = []

		if self.enable_file_search:
			tools.append(
				{
					"type": "file_search",
				}
			)

		if self.enable_code_interpreter:
			tools.append(
				{
					"type": "code_interpreter",
				}
			)

		for f in self.bot_functions:
			function_def = frappe.db.get_value("Raven AI Function", f.function, "function_definition")
			if function_def:
				tools.append({"type": "function", "function": json.loads(function_def)})

		return tools

	def get_tool_resources_for_assistant(self):
		if not self.enable_file_search and not self.enable_code_interpreter:
			return None

		# Check if the bot has any file sources
		if not self.file_sources:
			return None

		# Join file sources with Raven AI Bot Files
		file_source_ids = [f.file for f in self.file_sources]

		files = frappe.get_all(
			"Raven AI File Source",
			filters={"name": ["in", file_source_ids]},
			fields=["file_type", "openai_file_id"],
		)

		# Some files can be added as a resource for both file search and code interpreter

		code_interpreter_files = [
			f.openai_file_id for f in files if f.file_type.lower() in code_interpreter_file_types
		]

		tool_resources = {}

		if code_interpreter_files:
			tool_resources["code_interpreter"] = {"file_ids": code_interpreter_files}

		file_search_files = [
			f.openai_file_id for f in files if f.file_type.lower() in file_search_file_types
		]

		# Create a vector store for the assistant if it doesn't exist. Else update the existing vector store

		if file_search_files:
			if not self.openai_vector_store_id:
				self.create_vector_store(file_search_files)
			else:
				self.update_vector_store(file_search_files)

			tool_resources["file_search"] = {"vector_store_ids": [self.openai_vector_store_id]}

		# Check if the tool resources are empty
		if tool_resources.get("file_search") or tool_resources.get("code_interpreter"):
			return tool_resources
		else:
			return None

	def create_vector_store(self, file_ids: list[str]):
		# Create a new vector store for the assistant
		client = get_open_ai_client()
		vector_store = client.vector_stores.create(
			name=self.name,
			file_ids=file_ids,
		)

		self.openai_vector_store_id = vector_store.id

	def update_vector_store(self, file_ids: list[str]):
		# Update the vector store for the assistant
		client = get_open_ai_client()

		existing_vector_store_files = client.vector_stores.files.list(
			vector_store_id=self.openai_vector_store_id, limit=100
		)

		existing_vector_store_file_ids = [f.id for f in existing_vector_store_files.data]

		deleted_files = [f for f in existing_vector_store_file_ids if f not in file_ids]

		added_files = [f for f in file_ids if f not in existing_vector_store_file_ids]

		if added_files:
			vector_store_file_batch = client.vector_stores.file_batches.create(
				vector_store_id=self.openai_vector_store_id,
				file_ids=added_files,
			)

		if deleted_files:
			for file_id in deleted_files:
				client.vector_stores.files.delete(
					vector_store_id=self.openai_vector_store_id,
					file_id=file_id,
				)

	def delete_openai_assistant(self):
		# Delete the OpenAI Assistant for the bot
		# Delete the vector store for the assistant
		try:
			client = get_open_ai_client()
			client.beta.assistants.delete(self.openai_assistant_id)
			if self.openai_vector_store_id:
				client.vector_stores.delete(self.openai_vector_store_id)
		except Exception:
			frappe.log_error(
				f"Error deleting OpenAI Assistant {self.openai_assistant_id} for bot {self.name}"
			)

	# Raven Bot Methods

	def is_member(self, channel_id: str) -> None | str:
		"""
		Check if the bot is a member of the channel
		Returns None if the bot is not a member of the channel
		Returns the member_id if the bot is a member of the channel
		"""
		member_id = frappe.db.exists(
			"Raven Channel Member", {"channel_id": channel_id, "user_id": self.raven_user}
		)
		if member_id:
			return member_id
		return None

	def add_to_channel(self, channel_id: str) -> str:
		"""
		Add the bot to a channel as a member

		If the bot is already a member of the channel, this function does nothing

		Returns the member_id of the bot in the channel
		"""

		existing_member = self.is_member(channel_id)

		if not existing_member:
			raven_channel_member = frappe.get_doc(
				doctype="Raven Channel Member", user_id=self.raven_user, channel_id=channel_id
			)
			raven_channel_member.insert()
			return raven_channel_member.name
		else:
			return existing_member

	def remove_from_channel(self, channel_id: str) -> None:
		"""
		Remove the bot from a channel as a member
		"""

		existing_member = self.is_member(channel_id)
		if existing_member:
			frappe.delete_doc("Raven Channel Member", existing_member)

	def get_dm_channel_id(self, user_id: str) -> str | None:
		"""
		Get the channel_id of a Direct Message channel with a user
		"""
		# The User's Raven User ID
		user_raven_user = frappe.db.get_value("Raven User", {"user": user_id}, "name")
		if not user_raven_user:
			return None

		# get canonical order of the users
		if self.raven_user > user_raven_user:
			dm_user_1, dm_user_2 = self.raven_user, user_raven_user
		else:
			dm_user_1, dm_user_2 = user_raven_user, self.raven_user

		channel_name = frappe.db.get_value(
			"Raven Channel",
			filters={
				"is_direct_message": 1,
				"dm_user_1": dm_user_1,
				"dm_user_2": dm_user_2,
			},
		)
		if channel_name:
			return channel_name
		return None

	def send_message(
		self,
		channel_id: str,
		text: str = None,
		link_doctype: str = None,
		link_document: str = None,
		markdown: bool = False,
		notification_name: str = None,
		file: str = None,
	) -> str:
		"""
		Send a text message to a channel

		channel_id: The channel_id of the channel to send the message to

		You need to provide either text or link_doctype and link_document
		text: The text of the message in HTML format. If markdown is True, the text will be converted to HTML.

		Optional:
		link_doctype: The doctype of the document to link the message to
		link_document: The name of the document to link the message to
		markdown: If True, the text will be converted to HTML.
		file: The file to send to the user.

		Returns the message ID of the message sent
		"""

		message_type = "Text"

		if file:
			fileExt = ["jpg", "JPG", "jpeg", "JPEG", "png", "PNG", "gif", "GIF", "webp", "WEBP"]
			if file.split(".")[-1] in fileExt:
				message_type = "Image"
			else:
				message_type = "File"

		if markdown:
			text = frappe.utils.md_to_html(text)
			# Remove trailing newline if it exists
			text = text.rstrip("\n")
		doc = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": channel_id,
				"text": text,
				"message_type": message_type,
				"file": file,
				"is_bot_message": 1,
				"bot": self.raven_user,
				"link_doctype": link_doctype,
				"link_document": link_document,
				"notification": notification_name,
			}
		)
		# Bots can probably send messages without permissions? Upto the end user to create bots.
		# Besides sending messages is not a security concern, unauthorized reading of messages is.
		doc.insert(ignore_permissions=True)
		return doc.name

	def create_direct_message_channel(self, user_id: str) -> str:
		"""
		Creates a direct message channel between the bot and a user

		If the channel already exists, returns the channel_id of the existing channel

		Throws an error if the user is not a Raven User
		"""
		channel_id = self.get_dm_channel_id(user_id)

		if channel_id:
			return channel_id
		else:
			# The user's raven_user document
			user_raven_user = get_raven_user(user_id)
			if not user_raven_user:
				frappe.throw(f"User {user_id} is not added as a Raven User")

			# get canonical order of the users
			if self.raven_user > user_raven_user:
				dm_user_1, dm_user_2 = self.raven_user, user_raven_user
			else:
				dm_user_1, dm_user_2 = user_raven_user, self.raven_user

			channel = frappe.get_doc(
				{
					"doctype": "Raven Channel",
					"channel_name": dm_user_1 + " _ " + dm_user_2,
					"is_direct_message": 1,
				}
			)
			channel.flags.is_created_by_bot = True
			channel.insert()
			return channel.name

	def send_direct_message(
		self,
		user_id: str,
		text: str = None,
		link_doctype: str = None,
		link_document: str = None,
		markdown: bool = False,
		notification_name: str = None,
		file: str = None,
	) -> str:
		"""
		Send a text message to a user in a Direct Message channel

		user_id: The User's 'name' field to send the message to

		You need to provide either text or link_doctype and link_document
		text: The text of the message in HTML format. If markdown is True, the text will be converted to HTML.

		Optional:
		link_doctype: The doctype of the document to link the message to
		link_document: The name of the document to link the message to
		markdown: If True, the text will be converted to HTML.
		file: The file to send to the user.

		Returns the message ID of the message sent
		"""

		channel_id = self.create_direct_message_channel(user_id)

		if channel_id:
			return self.send_message(
				channel_id, text, link_doctype, link_document, markdown, notification_name, file
			)

	def get_last_message(self, channel_id: str = None, message_type: str = None) -> Document | None:
		"""
		Gets the last message sent by the bot
		"""
		filters = {"bot": self.name}
		if channel_id is not None:
			filters["channel_id"] = channel_id
		if message_type is not None:
			filters["message_type"] = message_type

		return frappe.get_last_doc("Raven Message", filters=filters, order_by="creation desc")

	def get_previous_messages(
		self, channel_id: str = None, message_type: str = None, date: str = None
	) -> list[str]:
		"""
		Gets the previous messages sent by the bot
		"""
		filters = {"bot": self.name}
		if channel_id is not None:
			filters["channel_id"] = channel_id
		if message_type is not None:
			filters["message_type"] = message_type
		if date is not None:
			filters["creation"] = [">", date]

		return frappe.get_all("Raven Message", filters=filters, order_by="creation desc", pluck="name")
