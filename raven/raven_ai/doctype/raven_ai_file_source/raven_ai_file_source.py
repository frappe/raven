# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

from raven.ai.openai_client import get_open_ai_client


class RavenAIFileSource(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		file: DF.Attach
		file_name: DF.Data | None
		file_type: DF.Data | None
		openai_file_id: DF.Data | None
	# end: auto-generated types

	def before_validate(self):
		# Populate file_name and file_type from file
		if self.file:
			if not self.file_name:
				self.file_name = self.file.split("/")[-1]
			self.file_type = self.file.split(".")[-1]

	def before_insert(self):
		self.create_file_in_openai()

	def create_file_in_openai(self):
		if not self.file:
			return

		client = get_open_ai_client()

		file_doc = frappe.get_doc("File", {"file_url": self.file})
		file_path = file_doc.get_full_path()

		response = client.files.create(file=open(file_path, "rb"), purpose="assistants")

		self.openai_file_id = response.id

	def after_delete(self):
		if self.openai_file_id:
			try:
				client = get_open_ai_client()
				client.files.delete(self.openai_file_id)
			except Exception as e:
				frappe.log_error(f"Error deleting file from OpenAI: {e}")
