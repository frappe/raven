# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class RavenWorkspace(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		can_only_join_via_invite: DF.Check
		description: DF.SmallText | None
		logo: DF.AttachImage | None
		only_admins_can_create_channels: DF.Check
		type: DF.Literal["Public", "Private"]
		workspace_name: DF.Data
	# end: auto-generated types

	def after_insert(self):
		# A save can't change the name; only insert, rename and delete touch the cached list.
		self.invalidate_workspace_list_cache()
		if not frappe.flags.in_patch:
			self.create_member_for_owner()

	def after_rename(self, old, new, merge=False):
		self.invalidate_workspace_list_cache()

	def after_delete(self):
		self.invalidate_workspace_list_cache()

	def invalidate_workspace_list_cache(self):
		from raven.api.workspaces import get_workspace_names

		get_workspace_names.clear_cache()

	def on_trash(self):
		# Delete all members when the workspace is deleted
		frappe.db.delete("Raven Workspace Member", {"workspace": self.name})

		# Delete all pinned workspaces
		frappe.db.delete("Raven User Pinned Workspaces", {"workspace": self.name})

		# Delete all channels when the workspace is deleted
		channels = frappe.db.get_all("Raven Channel", {"workspace": self.name})
		for channel in channels:
			# use delete doc to delete the channel ,it's members and messages
			frappe.delete_doc("Raven Channel", channel.name, delete_permanently=True)

	def create_member_for_owner(self):
		member = frappe.new_doc("Raven Workspace Member")
		member.workspace = self.name
		member.user = self.owner
		member.is_admin = True
		member.insert(ignore_permissions=True)
