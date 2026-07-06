# Copyright (c) 2023, The Commit Company and contributors
# For license information, please see license.txt
import datetime
import json

import frappe
from bs4 import BeautifulSoup
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_datetime, get_system_timezone
from pytz import timezone, utc

from raven.api.raven_channel import get_peer_user
from raven.notification import (
	send_notification_for_message,
	send_notification_to_topic,
	send_notification_to_user,
	truncate_notification_content,
)
from raven.utils import (
	get_raven_room,
	is_channel_member,
	refresh_thread_reply_count,
	track_channel_visit,
)


class RavenMessage(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from raven.raven_messaging.doctype.raven_mention.raven_mention import RavenMention

		blurhash: DF.SmallText | None
		bot: DF.Link | None
		channel_id: DF.Link
		content: DF.LongText | None
		file: DF.Attach | None
		file_thumbnail: DF.Attach | None
		hide_link_preview: DF.Check
		image_height: DF.Data | None
		image_width: DF.Data | None
		is_bot_message: DF.Check
		is_edited: DF.Check
		is_forwarded: DF.Check
		is_reply: DF.Check
		is_thread: DF.Check
		json: DF.JSON | None
		link_doctype: DF.Link | None
		link_document: DF.DynamicLink | None
		linked_message: DF.Link | None
		links: DF.SmallText | None
		mentions: DF.Table[RavenMention]
		message_reactions: DF.JSON | None
		message_type: DF.Literal["Text", "Image", "File", "Poll", "System"]
		notification: DF.Data | None
		poll_id: DF.Link | None
		replied_message_details: DF.JSON | None
		text: DF.LongText | None
		thumbnail_height: DF.Data | None
		thumbnail_width: DF.Data | None
	# end: auto-generated types

	def before_validate(self):

		if not self.is_new() and not self.flags.is_ai_streaming:
			# this is not a new message, so it's a previous message being edited
			old_doc = self.get_doc_before_save()
			if old_doc.text != self.text:
				self.is_edited = True

		self.parse_html_content()

	def parse_html_content(self):
		"""
		Parse the HTML content to do the following:
		1. Extract all user mentions
		2. Remove empty trailing paragraphs
		3. Extract the text content
		4. Extract all links and store as | separated string
		"""
		if not self.text:
			return
		if self.message_type == "System":
			return

		soup = BeautifulSoup(self.text, "html.parser")
		self.remove_empty_trailing_paragraphs(soup)
		self.extract_mentions(soup)

		links = []
		for link in soup.find_all("a"):
			href = link.get("href")
			if href:
				links.append(href)
		if links:
			self.links = "|" + "|".join(links) + "|"

		text_content = soup.get_text(" ", strip=True)

		if not text_content:
			# Check if the content has a GIF
			for img in soup.find_all("img"):
				if "media.tenor.com" in img.get("src"):
					text_content = "Sent a GIF"
					break

		self.content = text_content

		if not self.content and self.link_doctype and self.link_document:
			self.content = f"{self.link_doctype} - {self.link_document}"

	def extract_mentions(self, soup):
		"""
		Extract all user mentions from the HTML content
		"""
		self.mentions = []
		unique_mentions = set()
		for d in soup.find_all("span", attrs={"data-type": "userMention"}):
			mention_id = d.get("data-id")
			if mention_id and mention_id not in unique_mentions:
				self.append("mentions", {"user": mention_id})

				frappe.publish_realtime(
					"raven_mention",
					{
						"channel_id": self.channel_id,
						"user_id": mention_id,
					},
					user=mention_id,
					after_commit=True,
				)
				unique_mentions.add(mention_id)

	def remove_empty_trailing_paragraphs(self, soup):
		"""
		Remove p, br tags that are at the end with no content
		"""
		all_tags = soup.find_all(True)
		all_tags.reverse()
		for tag in all_tags:
			if tag.name in ["br", "p"] and not tag.contents:
				tag.extract()
			else:
				break
		self.text = str(soup)

	def validate(self):
		"""
		1. If there is a linked message, the linked message should be in the same channel
		"""
		self.validate_linked_message()
		"""
		2. If the message is of type Poll, the poll_id should be set
		"""
		self.validate_poll_id()

		if not self.is_new() and self.has_value_changed("message_reactions"):
			frappe.throw(
				_("Direct modification of message_reactions is not allowed. Use the Reactions API.")
			)

	def validate_linked_message(self):
		"""
		If there is a linked message, the linked message should be in the same channel
		"""
		if self.linked_message:
			if (
				frappe.get_cached_value("Raven Message", self.linked_message, "channel_id") != self.channel_id
			):
				frappe.throw(_("Linked message should be in the same channel"))

	def validate_poll_id(self):
		"""
		If the message is of type Poll, the poll_id should be set
		"""
		if self.message_type == "Poll" and not self.poll_id:
			frappe.throw(_("Poll ID is mandatory for a poll message"))

	def before_insert(self):
		"""
		If the message is a reply, update the replied_message_details field
		"""
		if self.is_reply and self.linked_message:
			details = frappe.db.get_value(
				"Raven Message",
				self.linked_message,
				["text", "content", "file", "message_type", "owner", "creation"],
				as_dict=True,
			)
			self.replied_message_details = {
				"text": details.text,
				"content": details.content,
				"file": details.file,
				"message_type": details.message_type,
				"owner": details.owner,
				"creation": datetime.datetime.strftime(details.creation, "%Y-%m-%d %H:%M:%S"),
			}

	def after_insert(self):
		if self.message_type != "System":
			last_message_details = self.set_last_message_timestamp()
			self.publish_unread_count_event(last_message_details)

		if self.message_type == "Text":
			self.handle_ai_message()

		self.send_push_notification()

	def handle_ai_message(self):

		# If the message was sent by a bot, do not call the function
		if self.is_bot_message:
			return

		# If AI Integration is not enabled, do not call the function
		raven_settings = frappe.get_cached_doc("Raven Settings")
		if not raven_settings.enable_ai_integration:
			return

		# Check if this channel is an AI Thread channel

		channel_doc = frappe.get_cached_doc("Raven Channel", self.channel_id)

		is_ai_thread = channel_doc.is_ai_thread

		if is_ai_thread:
			from raven.ai.ai import handle_ai_thread_message

			frappe.enqueue(
				method=handle_ai_thread_message,
				message=self,
				timeout=600,
				channel=channel_doc,
				at_front=True,
				job_name="handle_ai_thread_message",
			)

			return

		# If not a part of a AI Thread, then check if this is a DM to a bot - if yes, then we should create a new thread

		is_dm = channel_doc.is_direct_message

		# Only DMs to bots need to be handled (for now)

		if not is_dm:
			return

		# Get the bot user
		peer_user = get_peer_user(self.channel_id, is_dm)

		if not peer_user or peer_user.get("type") != "Bot":
			return

		# Get the bot user doc
		peer_user_doc = frappe.get_cached_doc("Raven User", peer_user.get("user_id"))

		if peer_user_doc.type != "Bot" or not peer_user_doc.bot:
			return

		bot = frappe.get_cached_doc("Raven Bot", peer_user_doc.bot)

		if not bot.is_ai_bot:
			return

		from raven.ai.ai import handle_bot_dm

		frappe.enqueue(
			method=handle_bot_dm,
			message=self,
			bot=bot,
			timeout=600,
			job_name="handle_bot_dm",
			at_front=True,
		)

	def set_last_message_timestamp(self):

		# Update directly via SQL since we do not want to invalidate the document cache
		message_details = json.dumps(
			{
				"message_id": self.name,
				"content": self.content,
				"message_type": self.message_type,
				"owner": self.owner,
				"is_bot_message": self.is_bot_message,
				"bot": self.bot,
			}
		)

		raven_channel = frappe.qb.DocType("Raven Channel")
		query = (
			frappe.qb.update(raven_channel)
			.where(raven_channel.name == self.channel_id)
			.set(raven_channel.last_message_timestamp, self.creation)
			.set(raven_channel.last_message_details, message_details)
		)
		query.run()

		return message_details

	def publish_unread_count_event(self, last_message_details=None):

		channel_doc = frappe.get_cached_doc("Raven Channel", self.channel_id)
		# If the message is a direct message, then we can only send it to one user
		if channel_doc.is_direct_message:

			if not channel_doc.is_self_message:

				peer_user_doc = get_peer_user(self.channel_id, 1)

				if peer_user_doc.get("type") == "User":

					frappe.publish_realtime(
						"raven:unread_channel_count_updated",
						{
							"channel_id": self.channel_id,
							"play_sound": True,
							"sent_by": self.owner,
							"is_dm_channel": True,
							"last_message_timestamp": self.creation,
							"last_message_details": last_message_details,
						},
						user=peer_user_doc.user_id,
						after_commit=True,
					)

			# Need to send this to sender as well since they need to update the last message timestamp
			frappe.publish_realtime(
				"raven:unread_channel_count_updated",
				{
					"channel_id": self.channel_id,
					"play_sound": False,
					"is_dm_channel": True,
					"sent_by": self.owner,
					"last_message_timestamp": self.creation,
					"last_message_details": last_message_details,
				},
				user=self.owner,
				after_commit=True,
			)
		elif channel_doc.is_thread:
			# Get the number of replies in the thread
			reply_count = refresh_thread_reply_count(self.channel_id)

			self.add_mentioned_users_to_thread()

			frappe.publish_realtime(
				"thread_reply",
				{
					"channel_id": self.channel_id,
					"sent_by": self.owner,
					"last_message_timestamp": self.creation,
					"number_of_replies": reply_count,
				},
				after_commit=True,
				room=get_raven_room(),
			)
		else:
			# This event needs to be published to all users on Raven (desk + website)
			frappe.publish_realtime(
				"raven:unread_channel_count_updated",
				{
					"channel_id": self.channel_id,
					"play_sound": False,
					"sent_by": self.owner,
					"is_dm_channel": False,
					"is_thread": channel_doc.is_thread,
					"last_message_timestamp": self.creation,
				},
				after_commit=True,
				room=get_raven_room(),
			)

	def add_mentioned_users_to_thread(self):
		"""
		Add the mentioned users to the thread if they are members of the parent channel but not in the thread
		"""
		if not self.mentions:
			return

		parent_channel_id = frappe.get_cached_value("Raven Message", self.channel_id, "channel_id")
		if parent_channel_id:
			for mention in self.mentions:
				if is_channel_member(parent_channel_id, mention.user) and not is_channel_member(
					self.channel_id, mention.user
				):
					try:
						frappe.get_doc(
							{"doctype": "Raven Channel Member", "channel_id": self.channel_id, "user_id": mention.user}
						).insert(ignore_permissions=True)
					except Exception:
						pass

	def send_push_notification(self):
		# Send Push Notification for the following:
		# 1. If the message is a direct message, send a push notification to the other user
		# 2. If the message has mentions, send a push notification to the mentioned users if they belong to the channel
		# 3. If the message is a reply, send a push notification to the user who is being replied to
		# 4. If the message is in a channel, send a push notification to all the users in the channel (topic)

		if (
			self.message_type == "System"
			or self.flags.send_silently
			or frappe.flags.in_test
			or frappe.flags.in_install
			or frappe.flags.in_patch
			or frappe.flags.in_import
		):
			return

		if frappe.request and hasattr(frappe.request, "after_response"):
			frappe.request.after_response.add(lambda: send_notification_for_message(self))
		else:
			send_notification_for_message(self)

	def get_notification_message_content(self):
		"""
		Gets the content of the message for the push notification
		"""
		if self.message_type == "File":
			return f"📄 Sent a file - {self.content}"
		elif self.message_type == "Image":
			return "📷 Sent a photo"
		elif self.message_type == "Poll":
			return "📊 Sent a poll"
		elif self.text:
			return self.content

	def get_message_owner_details(self):
		"""
		Get the full name of the message owner
		"""
		if self.is_bot_message:
			doc = frappe.get_cached_doc("Raven User", self.bot)
			return doc.full_name, doc.user_image
		else:
			doc = frappe.get_cached_doc("Raven User", self.owner)
			return doc.full_name, doc.user_image

	def send_notification_for_direct_message(self):
		"""
		The message is sent on a DM channel. Get the other user in the channel and send a push notification
		"""
		peer_raven_user = frappe.db.get_value(
			"Raven Channel Member",
			{"channel_id": self.channel_id, "user_id": ("!=", self.owner)},
			"user_id",
		)

		if not peer_raven_user:
			return

		peer_raven_user_doc = frappe.get_cached_doc("Raven User", peer_raven_user)

		# Do not send notification to a bot
		if peer_raven_user_doc.type == "Bot":
			return

		message = self.get_notification_message_content()

		# Truncate the message content to fit within FCM payload limits
		truncated_message = truncate_notification_content(message)

		owner_name, owner_image = self.get_message_owner_details()

		# Prepare content for data payload - truncate if text message
		content = self.content if self.message_type == "Text" else self.file
		if self.message_type == "Text":
			content = truncate_notification_content(content)

		send_notification_to_user(
			user_id=peer_raven_user_doc.user,
			user_image_path=owner_image,
			title=owner_name,
			message=truncated_message,
			data={
				"message_id": self.name,
				"channel_id": self.channel_id,
				"raven_message_type": self.message_type,
				"channel_type": "DM",
				"content": content,
				"from_user": self.owner,
				"type": "New message",
				"image": owner_image,
				"creation": get_milliseconds_since_epoch(self.creation),
			},
		)

	def send_notification_for_channel_message(self):
		"""
		The message was sent on a channel. Send a push notification to all the users in the channel (topic)
		"""
		message = self.get_notification_message_content()

		# Truncate the message content to fit within FCM payload limits
		truncated_message = truncate_notification_content(message)

		is_thread = frappe.get_cached_value("Raven Channel", self.channel_id, "is_thread")

		owner_name, owner_image = self.get_message_owner_details()

		if is_thread:
			title = f"{owner_name} in thread"
		else:
			channel_name = frappe.get_cached_value("Raven Channel", self.channel_id, "channel_name")
			title = f"{owner_name} in #{channel_name}"

		# Prepare content for data payload - truncate if text message
		content = self.content if self.message_type == "Text" else self.file
		if self.message_type == "Text":
			content = truncate_notification_content(content)

		send_notification_to_topic(
			channel_id=self.channel_id,
			user_image_path=owner_image,
			title=title,
			message=truncated_message,
			data={
				"message_id": self.name,
				"channel_id": self.channel_id,
				"raven_message_type": self.message_type,
				"channel_type": "Channel",
				"content": content,
				"from_user": self.owner,
				"type": "New message",
				"is_thread": "1" if is_thread else "0",
				"creation": get_milliseconds_since_epoch(self.creation),
			},
		)

	def after_delete(self):
		frappe.publish_realtime(
			"message_deleted",
			{
				"channel_id": self.channel_id,
				"sender": frappe.session.user,
				"message_id": self.name,
			},
			doctype="Raven Channel",
			# Adding this to automatically add the room for the event via Frappe
			docname=self.channel_id,
		)

		if self.message_type != "System":
			self.publish_unread_count_event()

		# delete poll if the message is of type poll after deleting the message
		if self.message_type == "Poll":
			frappe.delete_doc("Raven Poll", self.poll_id, ignore_permissions=True, delete_permanently=True)

		# TEMP: this is a temp fix for the Desk interface
		self.publish_deprecated_event_for_desk()

	def publish_deprecated_event_for_desk(self):
		# TEMP: this is a temp fix for the Desk interface
		frappe.publish_realtime(
			"message_updated",
			{
				"channel_id": self.channel_id,
				"sender": frappe.session.user,
				"message_id": self.name,
			},
			doctype="Raven Channel",
			docname=self.channel_id,
			after_commit=True,
		)

	def on_update(self):

		# TEMP: this is a temp fix for the Desk interface
		self.publish_deprecated_event_for_desk()

		if self.is_edited or self.is_thread or self.flags.editing_metadata:
			frappe.publish_realtime(
				"message_edited",
				{
					"channel_id": self.channel_id,
					"sender": frappe.session.user,
					"message_id": self.name,
					"message_details": {
						"text": self.text,
						"content": self.content,
						"channel_id": self.channel_id,
						"file": self.file,
						"poll_id": self.poll_id,
						"message_type": self.message_type,
						"is_edited": 1 if self.is_edited else 0,
						"is_thread": self.is_thread,
						"is_forwarded": self.is_forwarded,
						"is_reply": self.is_reply,
						"modified": self.modified,
						"linked_message": self.linked_message,
						"replied_message_details": self.replied_message_details,
						"link_doctype": self.link_doctype,
						"link_document": self.link_document,
						"message_reactions": self.message_reactions,
						"is_bot_message": self.is_bot_message,
						"bot": self.bot,
						"hide_link_preview": self.hide_link_preview,
						"blurhash": self.blurhash,
					},
				},
				doctype="Raven Channel",
				# Adding this to automatically add the room for the event via Frappe
				docname=self.channel_id,
			)
		else:
			after_commit = False
			if self.message_type == "File" or self.message_type == "Image":
				# If the message is a file or an image, then we need to wait for the file to be uploaded
				after_commit = True
				if not self.file:
					return

			if self.message_type == "Poll" or (self.link_doctype and self.link_document):
				# If the message is a poll, then we need to wait for the poll to be created
				after_commit = True

			frappe.publish_realtime(
				"message_created",
				{
					"channel_id": self.channel_id,
					"sender": frappe.session.user,
					"message_id": self.name,
					"message_details": {
						"text": self.text,
						"channel_id": self.channel_id,
						"content": self.content,
						"file": self.file,
						"message_type": self.message_type,
						"is_edited": 1 if self.is_edited else 0,
						"is_thread": self.is_thread,
						"is_forwarded": self.is_forwarded,
						"is_reply": self.is_reply,
						"poll_id": self.poll_id,
						"creation": self.creation,
						"owner": self.owner,
						"modified_by": self.modified_by,
						"modified": self.modified,
						"linked_message": self.linked_message,
						"replied_message_details": self.replied_message_details,
						"link_doctype": self.link_doctype,
						"link_document": self.link_document,
						"message_reactions": self.message_reactions,
						"thumbnail_width": self.thumbnail_width,
						"thumbnail_height": self.thumbnail_height,
						"file_thumbnail": self.file_thumbnail,
						"image_width": self.image_width,
						"image_height": self.image_height,
						"name": self.name,
						"is_bot_message": self.is_bot_message,
						"bot": self.bot,
						"hide_link_preview": self.hide_link_preview,
						"blurhash": self.blurhash,
					},
				},
				doctype="Raven Channel",
				# Adding this to automatically add the room for the event via Frappe
				docname=self.channel_id,
				after_commit=after_commit,
			)

			if self.message_type != "System" and not self.is_bot_message:
				# track the visit of the user to the channel if a new message is created
				track_channel_visit(channel_id=self.channel_id, user=self.owner)
				# frappe.enqueue(method=track_channel_visit, channel_id=self.channel_id, user=self.owner)

			# If this is a new messagge (only applicable for files in on_update), then handle the AI message
			if self.message_type == "File" or self.message_type == "Image":
				if self.file:
					self.handle_ai_message()

	def on_trash(self):
		# delete all the reactions for the message
		frappe.db.delete("Raven Message Reaction", {"message": self.name})
		# if the message is a thread, delete all messages in the thread and the thread channel
		if self.is_thread:
			# Delete the thread channel - this will automatically delete all the messages and their reactions in the thread
			thread_channel_doc = frappe.get_doc("Raven Channel", self.name)
			thread_channel_doc.delete(ignore_permissions=True)

		# delete the pinned message
		is_pinned = frappe.get_all(
			"Raven Pinned Messages", {"message_id": self.name, "parent": self.channel_id}
		)
		if is_pinned:
			channel_doc = frappe.get_doc("Raven Channel", self.channel_id)
			pinned_row = None
			for pinned_message in channel_doc.pinned_messages:
				if pinned_message.message_id == self.name:
					pinned_row = pinned_message
					break
			if pinned_row:
				channel_doc.remove(pinned_row)
				channel_doc.save()


def on_doctype_update():
	"""
	Add indexes to Raven Message table
	"""
	# Index the selector (channel or message type) first for faster queries (less rows to sort in the next step)
	frappe.db.add_index("Raven Message", ["channel_id", "creation"])
	frappe.db.add_index("Raven Message", ["message_type", "creation"])


def get_milliseconds_since_epoch(timestamp: str) -> str:
	"""
	Returns the milliseconds since epoch for a given timestamp
	"""
	datetime_obj = get_datetime(timestamp)

	# Localize the datetime object to system timezone
	time_zone = get_system_timezone()
	system_datetime = timezone(time_zone).localize(datetime_obj)

	# Convert the system datetime to UTC
	utc_datetime = system_datetime.astimezone(utc)

	# Get the timestamp in milliseconds since epoch for the UTC datetime
	seconds_since_epoch = utc_datetime.timestamp()
	return str(seconds_since_epoch * 1000)
