# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from raven.utils import delete_channel_members_cache, delete_workspace_members_cache


class RavenWorkspaceMember(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		is_admin: DF.Check
		user: DF.Link
		workspace: DF.Link
	# end: auto-generated types

	def validate(self):
		# Check if the user is already a member of the workspace
		conditions = {"workspace": self.workspace, "user": self.user}

		if self.name:
			conditions["name"] = ["!=", self.name]
		if frappe.db.exists("Raven Workspace Member", conditions):
			frappe.throw(_("User is already a member of the workspace"))

		self.validate_other_admins_exist()

	def validate_other_admins_exist(self):
		"""
		Check if there are other admins in the workspace
		"""
		if self.has_value_changed("is_admin") and not self.is_admin:
			other_admins = frappe.db.count(
				"Raven Workspace Member",
				{"workspace": self.workspace, "is_admin": True, "name": ["!=", self.name]},
			)
			if other_admins == 0:
				frappe.throw(
					_(
						"You cannot delete the last admin of the workspace. Please assign another user as the admin, or delete the workspace instead."
					)
				)

	def after_insert(self):
		self.invalidate_workspace_members_cache()

	def on_update(self):
		self.invalidate_workspace_members_cache()

	def on_trash(self):
		self.check_last_admin()
		self.delete_channel_members_for_user()
		self.invalidate_workspace_members_cache()

	def check_last_admin(self):
		"""
		Check if the user is the last admin of the workspace
		"""
		other_admin = frappe.db.count(
			"Raven Workspace Member",
			{"workspace": self.workspace, "is_admin": True, "name": ["!=", self.name]},
		)
		if other_admin == 0:
			frappe.throw(
				_(
					"You cannot delete the last admin of the workspace. Please assign another user as the admin, or delete the workspace instead."
				)
			)

	def delete_channel_members_for_user(self):
		"""
		Delete all channel members for this user in this workspace
		"""
		workspace_channels = frappe.get_all("Raven Channel", {"workspace": self.workspace}, pluck="name")
		for channel in workspace_channels:
			frappe.db.delete("Raven Channel Member", {"channel_id": channel, "user_id": self.user})
			if not self.flags.ignore_cache_invalidation:
				delete_channel_members_cache(channel)

	def invalidate_workspace_members_cache(self):
		"""
		Invalidate the workspace members cache
		"""
		if not self.flags.ignore_cache_invalidation:
			delete_workspace_members_cache(self.workspace)


def on_doctype_update():
	"""
	Add indexes to Raven Workspace Member table
	"""
	# Index the selector first for faster queries (less rows to sort in the next step)
	frappe.db.add_index("Raven Workspace Member", ["workspace", "user"])
