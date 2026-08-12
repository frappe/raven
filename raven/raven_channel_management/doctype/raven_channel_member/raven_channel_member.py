# Copyright (c) 2023, The Commit Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from raven.notification import subscribe_user_to_topic, unsubscribe_user_to_topic
from raven.utils import create_members_added_system_message, delete_channel_members_cache


class RavenChannelMember(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		allow_notifications: DF.Check
		channel_id: DF.Link
		is_admin: DF.Check
		is_synced: DF.Check
		last_visit: DF.Datetime
		linked_doctype: DF.Link | None
		linked_document: DF.DynamicLink | None
		muted: DF.Check
		user_id: DF.Link
	# end: auto-generated types

	def validate(self):
		if (
			self.has_value_changed("is_admin")
			and not self.flags.in_insert
			and not self.flags.ignore_permissions
		):

			member = frappe.db.exists(
				"Raven Channel Member", {"channel_id": self.channel_id, "user_id": frappe.session.user}
			)
			if member:
				if "Raven Admin" in frappe.get_roles():
					pass
				elif frappe.db.get_value("Raven Channel Member", member, "is_admin") == 1:
					pass
				else:
					frappe.throw(
						_(
							"You don't have permission to assign admins to this channel. Please ask another admin to do this."
						),
						frappe.PermissionError,
					)
			else:
				frappe.throw(
					_(
						"You don't have permission to assign admins to this channel. Please ask another admin to do this."
					),
					frappe.PermissionError,
				)

	def before_insert(self):
		self.last_visit = frappe.utils.now()
		# 1. A user cannot be a member of a channel more than once
		if frappe.db.exists(
			"Raven Channel Member", {"channel_id": self.channel_id, "user_id": self.user_id}
		):
			frappe.throw(_("You are already a member of this channel"), frappe.DuplicateEntryError)
		# if there are no members in the channel, then the member becomes admin
		if frappe.db.count("Raven Channel Member", {"channel_id": self.channel_id}) == 0:
			self.is_admin = 1

		self.allow_notifications = 1

	def after_delete(self):

		member_name = frappe.get_cached_value("Raven User", self.user_id, "full_name")

		current_user_name = frappe.get_cached_value("Raven User", frappe.session.user, "full_name")

		channel_details = self.get_channel_details()

		is_thread = channel_details.is_thread

		if not is_thread:
			# Update the channel list for the user who left the channel
			frappe.publish_realtime(
				"channel_list_updated",
				{
					"channel_id": self.channel_id,
				},
				user=self.user_id,
				after_commit=True,
			)

		# If this was the last member of a private channel, archive the channel
		if (
			frappe.db.count("Raven Channel Member", {"channel_id": self.channel_id}) == 0
			and channel_details.type == "Private"
		):
			frappe.db.set_value("Raven Channel", self.channel_id, "is_archived", 1)

		# If this member was the only admin, then make the next oldest member an admin
		if (
			self.get_admin_count() == 0
			and frappe.db.count("Raven Channel Member", {"channel_id": self.channel_id}) > 0
		):
			first_member = frappe.db.get_value(
				"Raven Channel Member",
				{"channel_id": self.channel_id},
				["name", "user_id"],
				as_dict=1,
				order_by="creation asc",
			)
			frappe.db.set_value("Raven Channel Member", first_member.name, "is_admin", 1)

			first_member_name = frappe.get_cached_value("Raven User", first_member.user_id, "full_name")

			# Add a system message to the channel mentioning the new admin.
			# (As everywhere: `json` is the structured event clients translate;
			# `text` is the plain-English fallback for older clients.)
			frappe.get_doc(
				{
					"doctype": "Raven Message",
					"channel_id": self.channel_id,
					"message_type": "System",
					"text": f"{member_name} was removed by {current_user_name} and {first_member_name} is the new admin of this channel.",
					"json": frappe.as_json(
						{
							"event": "member_removed",
							"removed_by": frappe.session.user,
							"user": self.user_id,
							"new_admin": first_member.user_id,
						}
					),
				}
			).insert(ignore_permissions=True)
		else:
			# If the member who left is the current user, then add a system message to the channel mentioning that the user left
			# (compare IDS, not display names — two users can share a full name)
			if self.user_id == frappe.session.user:
				# Add a system message to the channel mentioning the member who left
				frappe.get_doc(
					{
						"doctype": "Raven Message",
						"channel_id": self.channel_id,
						"message_type": "System",
						"text": f"{member_name} left.",
						"json": frappe.as_json({"event": "user_left", "user": self.user_id}),
					}
				).insert(ignore_permissions=True)
			else:
				# Add a system message to the channel mentioning the member who left
				frappe.get_doc(
					{
						"doctype": "Raven Message",
						"channel_id": self.channel_id,
						"message_type": "System",
						"text": f"{current_user_name} removed {member_name}.",
						"json": frappe.as_json(
							{
								"event": "member_removed",
								"removed_by": frappe.session.user,
								"user": self.user_id,
							}
						),
					}
				).insert(ignore_permissions=True)

	def on_trash(self):
		unsubscribe_user_to_topic(self.channel_id, self.user_id)
		self.invalidate_channel_members_cache()

	def check_if_user_is_member(self):
		is_member = True
		channel_type = self.get_channel_details().type
		owner = self.get_channel_details().owner
		if channel_type == "Private":
			# A user can only add members to a private channel if they are themselves member of the channel or if they are the owner of a new channel
			if (
				owner == frappe.session.user
				and frappe.db.count("Raven Channel Member", {"channel_id": self.channel_id}) == 0
			):
				# User is the owner of a channel and there are no members in the channel
				pass
			elif frappe.db.exists(
				"Raven Channel Member",
				{"channel_id": self.channel_id, "user_id": frappe.session.user},
			):
				# User is a member of the channel
				pass
			elif frappe.session.user == "Administrator":
				# User is Administrator
				pass
			else:
				is_member = False
		return is_member

	def after_insert(self):
		"""
		Subscribe the user to the topic if the channel is not a DM
		"""

		channel_details = self.get_channel_details()
		is_direct_message = channel_details.is_direct_message
		is_thread = channel_details.is_thread

		if not is_thread:
			# Update the channel list for the user who joined the channel
			frappe.publish_realtime(
				"channel_list_updated",
				{
					"channel_id": self.channel_id,
				},
				user=self.user_id,
				after_commit=True,
			)

		if not is_direct_message and self.allow_notifications:
			subscribe_user_to_topic(self.channel_id, self.user_id)

		# Don't send a system message to the channel if the channel is open
		if not is_direct_message and not channel_details.type == "Open":

			if self.flags.ignore_system_message:
				# Bulk addition — the caller (add_channel_members / Raven
				# Channel.add_members) sends ONE combined message for the whole batch.
				pass
			elif self.user_id == frappe.session.user:
				# Send a system message to the channel mentioning the member who joined.
				# `json` carries the structured event so clients can render a
				# translated string; `text` stays as the v2-compatible fallback.
				member_name = frappe.get_cached_value("Raven User", self.user_id, "full_name")
				frappe.get_doc(
					{
						"doctype": "Raven Message",
						"channel_id": self.channel_id,
						"message_type": "System",
						"text": f"{member_name} joined.",
						"json": frappe.as_json({"event": "user_joined", "user": self.user_id}),
					}
				).insert(ignore_permissions=True)
			else:
				create_members_added_system_message(self.channel_id, [self.user_id])

		self.invalidate_channel_members_cache()

	def on_update(self):
		"""
		Check if the notification preference is changed and update the subscription
		"""
		if self.has_value_changed("allow_notifications"):

			is_direct_message = self.get_channel_details().is_direct_message

			if not is_direct_message:
				if self.allow_notifications:
					subscribe_user_to_topic(self.channel_id, self.user_id)
				else:
					unsubscribe_user_to_topic(self.channel_id, self.user_id)

		if self.has_value_changed("is_admin") and not self.flags.in_insert and not self.is_thread():
			# Send a system message to the channel mentioning the member who became admin
			member_name = frappe.get_cached_value("Raven User", self.user_id, "full_name")
			text = (
				f"{member_name} is now an admin." if self.is_admin else f"{member_name} is no longer an admin."
			)
			frappe.get_doc(
				{
					"doctype": "Raven Message",
					"channel_id": self.channel_id,
					"message_type": "System",
					"text": text,
					"json": frappe.as_json(
						{
							"event": "admin_status_changed",
							"user": self.user_id,
							"is_admin": bool(self.is_admin),
						}
					),
				}
			).insert(ignore_permissions=True)

		self.invalidate_channel_members_cache()

	def get_admin_count(self):
		return frappe.db.count("Raven Channel Member", {"channel_id": self.channel_id, "is_admin": 1})

	def is_thread(self):
		return self.get_channel_details().is_thread

	def get_channel_details(self):
		"""
		Keep a cached value of the channel details to avoid multiple database queries
		"""
		if self.flags.channel_details:
			return self.flags.channel_details
		channel_details = frappe.get_cached_value(
			"Raven Channel",
			self.channel_id,
			["type", "owner", "is_direct_message", "is_thread"],
			as_dict=True,
		)
		self.flags.channel_details = channel_details
		return channel_details

	def invalidate_channel_members_cache(self):
		if not self.flags.ignore_cache_invalidation:
			delete_channel_members_cache(self.channel_id)


def on_doctype_update():
	"""
	Add indexes to Raven Channel Member table
	Add unique constraint to Raven Channel Member table
	Ensures that a user can only be a member of a channel once
	Note: Adding a unique constraint automatically adds an index on the fields
	"""
	# Index the selector (channel or message type) first for faster queries (less rows to sort in the next step)

	frappe.db.add_unique(
		"Raven Channel Member",
		fields=["channel_id", "user_id"],
		constraint_name="unique_channel_member",
	)
