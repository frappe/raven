# Copyright (c) 2023, The Commit Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils.data import get_url


class RavenUser(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from raven.raven.doctype.raven_pinned_channels.raven_pinned_channels import RavenPinnedChannels

		availability_status: DF.Literal["", "Available", "Away", "Do not disturb", "Invisible"]
		bot: DF.Link | None
		chat_style: DF.Literal["Simple", "Left-Right"]
		custom_status: DF.Data | None
		enabled: DF.Check
		first_name: DF.Data | None
		full_name: DF.Data
		last_mention_viewed_on: DF.Datetime | None
		pinned_channels: DF.Table[RavenPinnedChannels]
		type: DF.Literal["User", "Bot"]
		user: DF.Link | None
		user_image: DF.AttachImage | None
	# end: auto-generated types

	def autoname(self):
		if self.type == "Bot":
			self.name = self.bot
		else:
			self.name = self.user

	def before_validate(self):
		if self.user:
			self.type = "User"
		if not self.full_name:
			self.full_name = self.first_name

	def validate(self):
		if self.type == "Bot" and not self.bot:
			frappe.throw(_("Bot is mandatory"))

		if self.type == "User" and not self.user:
			frappe.throw(_("User is mandatory"))

	def before_insert(self):
		if self.type != "Bot":
			self.update_photo_from_user()

	def after_insert(self):
		self.invalidate_user_list_cache()

	def on_update(self):
		self.invalidate_user_list_cache()

	def on_trash(self):
		"""
		Remove the Raven User from all channels
		"""
		frappe.db.delete("Raven Channel Member", {"user_id": self.user})

	def after_delete(self):
		"""
		Remove the Raven User role from the user.
		"""
		if self.user:
			user = frappe.get_doc("User", self.user)
			user.flags.ignore_permissions = True
			user.flags.deleting_raven_user = True
			user.remove_roles("Raven User")
			user.save()

		self.invalidate_user_list_cache()

	def invalidate_user_list_cache(self):

		from raven.api.raven_users import get_users

		get_users.clear_cache()

	def update_photo_from_user(self):
		"""
		We need to create a new File record for the user image and attach it to the Raven User record.
		Why not just copy the URL from the User record? Because the URL is not accessible to the Raven User,
		and Frappe creates a duplicate file in the system (that is public) but does not update the URL in the field.
		"""
		user_image = frappe.db.get_value("User", self.user, "user_image")

		if isinstance(user_image, str) and user_image.startswith("/"):
			user_image = get_url(user_image)

		try:
			if user_image and not self.user_image:
				image_file = frappe.get_doc(
					{
						"doctype": "File",
						"file_url": user_image,
						"attached_to_doctype": "Raven User",
						"attached_to_name": self.user,
						"attached_to_field": "user_image",
						"is_private": 1,
					}
				).insert(ignore_permissions=True)
				self.user_image = image_file.file_url
		except Exception:
			pass


def add_user_to_raven(doc, method):
	# called when the user is inserted or updated
	# If the auto-create setting is set to True, check if the user is a System user. If yes, then create a Raven User record for the user.
	# Else, check if the user has a Raven User role. If yes, then create a Raven User record for the user if not already created.

	# If the user is already added to Raven, do nothing.
	if not doc.flags.deleting_raven_user:
		if frappe.db.exists("Raven User", {"user": doc.name}):
			# Check if the role is still present. If not, then inactivate the Raven User record.
			has_raven_role = False
			for role in doc.get("roles"):
				if role.role == "Raven User":
					has_raven_role = True
					break

			if has_raven_role:
				raven_user = frappe.get_doc("Raven User", {"user": doc.name})
				if not raven_user.full_name:
					raven_user.full_name = doc.full_name or doc.first_name

				if not raven_user.first_name:
					raven_user.first_name = doc.first_name
				raven_user.enabled = doc.enabled
				raven_user.save(ignore_permissions=True)
			else:
				raven_user = frappe.get_doc("Raven User", {"user": doc.name})
				if not raven_user.full_name:
					raven_user.full_name = doc.full_name or doc.first_name

				if not raven_user.first_name:
					raven_user.first_name = doc.first_name
				raven_user.enabled = 0
				raven_user.save(ignore_permissions=True)
		else:
			# Raven user does not exist.
			# Only create raven user if it exists in the system.
			if frappe.db.exists("User", doc.name):
				# Check if the user is a system user.
				auto_add = False
				if doc.user_type == "System User":
					auto_add = frappe.db.get_single_value("Raven Settings", "auto_add_system_users")

				if auto_add or "Raven User" in [d.role for d in doc.get("roles")]:
					doc.append("roles", {"role": "Raven User"})
					# Create a Raven User record for the user.
					raven_user = frappe.new_doc("Raven User")
					raven_user.user = doc.name
					raven_user.full_name = doc.full_name or doc.first_name
					raven_user.first_name = doc.first_name
					raven_user.enabled = doc.enabled
					raven_user.insert(ignore_permissions=True)


def remove_user_from_raven(doc, method):
	# called when the user is deleted
	# If the user is deleted, then delete the Raven User record for the user.
	if frappe.db.exists("Raven User", {"user": doc.name}):
		raven_user = frappe.get_doc("Raven User", {"user": doc.name})
		raven_user.delete(ignore_permissions=True)
