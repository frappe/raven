# Copyright (c) 2023, The Commit Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from raven.utils import delete_channel_members_cache, get_raven_room


class RavenChannel(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from raven.raven.doctype.raven_pinned_messages.raven_pinned_messages import RavenPinnedMessages

		channel_description: DF.SmallText | None
		channel_name: DF.Data
		dm_user_1: DF.Link | None
		dm_user_2: DF.Link | None
		is_ai_thread: DF.Check
		is_archived: DF.Check
		is_direct_message: DF.Check
		is_dm_thread: DF.Check
		is_self_message: DF.Check
		is_synced: DF.Check
		is_thread: DF.Check
		last_message_details: DF.JSON | None
		last_message_id: DF.Data | None
		last_message_timestamp: DF.Datetime | None
		linked_doctype: DF.Link | None
		linked_document: DF.DynamicLink | None
		openai_thread_id: DF.Data | None
		pinned_messages: DF.Table[RavenPinnedMessages]
		pinned_messages_string: DF.SmallText | None
		thread_bot: DF.Link | None
		type: DF.Literal["Private", "Public", "Open"]
		workspace: DF.Link | None
	# end: auto-generated types

	def on_trash(self):

		# TODO: Delete all threads and polls inside this channel
		# delete all members when channel is deleted
		frappe.db.delete("Raven Channel Member", {"channel_id": self.name})

		# delete all messages when channel is deleted
		frappe.db.delete("Raven Message", {"channel_id": self.name})

		# delete all reactions when channel is deleted
		frappe.db.delete("Raven Message Reaction", {"channel_id": self.name})

		# Delete the pinned channels
		frappe.db.delete("Raven Pinned Channels", {"channel_id": self.name})

		# Delete all channel groups
		frappe.db.delete("Raven Grouped Channels", {"channel_id": self.name})

		delete_channel_members_cache(self.name)

		if not self.is_thread:
			# Update the channel list for all users
			frappe.publish_realtime(
				"channel_list_updated",
				{
					"channel_id": self.name,
				},
				room=get_raven_room(),
				after_commit=True,
			)

		# If the channel was a thread, (i.e. a message exists with the same name), remove the 'is_thread' flag from the message
		if self.is_thread and frappe.db.exists("Raven Message", {"name": self.name}):
			message_channel_id = frappe.get_cached_value("Raven Message", self.name, "channel_id")
			frappe.db.set_value("Raven Message", self.name, "is_thread", 0)
			# Update the message which used to be a thread
			frappe.publish_realtime(
				"message_edited",
				{
					"channel_id": message_channel_id,
					"sender": frappe.session.user,
					"message_id": self.name,
					"message_details": {
						"is_thread": 0,
					},
				},
				doctype="Raven Channel",
				docname=message_channel_id,
			)

	def on_update(self):
		if not self.is_thread:
			# Update the channel list for all users
			frappe.publish_realtime(
				"channel_list_updated",
				{
					"channel_id": self.name,
				},
				room=get_raven_room(),
				after_commit=True,
			)

	def after_insert(self):
		"""
		After inserting a channel, we need to check if it is a direct message channel or not.

		If it is a direct message channel, we can add both the users as members.

		If it is a self message channel, we will add only the same user as a member.

		For all other channels, we will add the current user as a member if it is not created by a bot.
		If it is created by a bot, we will add the bot as a member.
		"""
		# add current user as channel member
		if not frappe.flags.in_install and not self.flags.do_not_add_member:

			if self.type in ("Open", "Public") and not self.is_thread:
				# Update the channel list for all users
				frappe.publish_realtime(
					"channel_list_updated",
					{
						"channel_id": self.name,
					},
					room=get_raven_room(),
					after_commit=True,
				)

			if self.is_direct_message == 1:
				# Add both users as members
				raven_users = self.channel_name.split(" _ ")
				unique_raven_users = list(set(raven_users))
				self.add_members(unique_raven_users)
			else:
				# Can ignore permissions here because the user who creates the channel should be an admin of the channel
				frappe.get_doc(
					{
						"doctype": "Raven Channel Member",
						"channel_id": self.name,
						"user_id": frappe.session.user,
						"is_admin": 1,
					}
				).insert(ignore_permissions=True)

	def validate(self):
		# If the user trying to modify the channel is not the owner or channel member, then don't allow
		old_doc = self.get_doc_before_save()

		if self.is_direct_message == 1:
			if old_doc:
				if old_doc.get("channel_name") != self.channel_name:
					frappe.throw(
						_("You cannot change the name of a direct message channel"),
						frappe.ValidationError,
					)

		if not self.is_dm_thread and not self.is_direct_message:
			# If it's not a direct message channel, it needs a workspace
			if not self.workspace:
				frappe.throw(_("You need to specify a workspace for this channel"), frappe.ValidationError)

		if old_doc and old_doc.get("is_archived") != self.is_archived:
			if frappe.db.exists(
				"Raven Channel Member",
				{"channel_id": self.name, "user_id": frappe.session.user, "is_admin": 1},
			):
				pass
			elif "Raven Admin" in frappe.get_roles() and frappe.db.get_value(
				"Raven Channel Member", {"channel_id": self.name, "user_id": frappe.session.user}
			):
				pass
			elif frappe.session.user == "Administrator":
				pass
			else:
				frappe.throw(
					_("You don't have permission to archive/unarchive this channel"),
					frappe.PermissionError,
				)
		if not self.flags.is_created_by_bot and not self.flags.ignore_channel_member_check:
			if self.type == "Private" or self.type == "Public":
				if (
					self.owner == frappe.session.user
					and frappe.db.count("Raven Channel Member", {"channel_id": self.name}) <= 1
				):
					pass
				elif frappe.db.exists(
					"Raven Channel Member", {"channel_id": self.name, "user_id": frappe.session.user}
				):
					pass
				elif frappe.session.user == "Administrator":
					pass
				else:
					frappe.throw(_("You don't have permission to modify this channel"), frappe.PermissionError)

		# Check if this channel exists in the current workspace
		if self.workspace and self.flags.in_insert:
			if frappe.db.exists(
				"Raven Channel", {"channel_name": self.channel_name, "workspace": self.workspace}
			):
				frappe.throw(
					_("A channel with this name already exists in this workspace."), frappe.ValidationError
				)

	def before_validate(self):
		if self.is_self_message == 1:
			self.is_direct_message = 1

		if self.is_direct_message == 1:
			self.type = "Private"
			users = self.channel_name.split(" _ ")
			if len(users) == 2:
				# Canonical order - user1 > user_2(alphabetically)
				if users[0] > users[1]:
					self.dm_user_1, self.dm_user_2 = users[0], users[1]
				else:
					self.dm_user_1, self.dm_user_2 = users[1], users[0]
			else:
				self.dm_user_1 = self.dm_user_2 = users[0]

		if self.is_direct_message == 0:
			self.channel_name = self.channel_name.strip().lower().replace(" ", "-")

		if not self.is_direct_message and not self.workspace and not self.is_dm_thread:
			workspaces = frappe.get_all("Raven Workspace")
			if len(workspaces) == 1:
				self.workspace = workspaces[0].name

		self.set_pinned_messages_string()

	def set_pinned_messages_string(self):
		self.pinned_messages_string = "\n".join([message.message_id for message in self.pinned_messages])

	def add_members(self, members, is_admin=0):
		# members is a list of Raven User IDs
		for member in members:
			doc = frappe.db.exists(
				"Raven Channel Member",
				{"channel_id": self.name, "user_id": member},
			)
			if doc:
				continue
			else:
				channel_member = frappe.get_doc(
					{
						"doctype": "Raven Channel Member",
						"channel_id": self.name,
						"user_id": member,
						"is_admin": is_admin,
					}
				)
				channel_member.insert(ignore_permissions=True)

	def autoname(self):
		if self.is_direct_message == 0 and self.is_thread == 0:
			# Add workspace name to the channel name
			self.name = (
				self.workspace.lower().replace(" ", "-")
				+ "-"
				+ self.channel_name.strip().lower().replace(" ", "-")
			)
		elif self.is_thread:
			self.name = self.channel_name


def on_doctype_update():
	"""
	Add unique constraint on dm_user_1 and dm_user_2 to prevent duplicate DM channels.
	NULL values are ignored by MySQL/MariaDB unique constraints, so this only affects DM channels.
	"""
	frappe.db.add_unique(
		"Raven Channel",
		fields=["dm_user_1", "dm_user_2"],
		constraint_name="unique_dm_channel",
	)
