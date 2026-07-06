import json
from datetime import timedelta

import frappe
from frappe import _
from frappe.query_builder import JoinType, Order
from frappe.query_builder.functions import Coalesce, Count

from raven.api.raven_channel import create_direct_message_channel, get_peer_user_id
from raven.utils import get_channel_member, is_channel_member, track_channel_visit


@frappe.whitelist(methods=["POST"])
def send_message(
	channel_id: str,
	text: str,
	is_reply: bool = False,
	linked_message: str | None = None,
	json_content: dict | str | None = None,
	send_silently: bool = False,
):
	if is_reply:
		doc = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": channel_id,
				"text": text,
				"message_type": "Text",
				"is_reply": is_reply,
				"linked_message": linked_message,
				"json": json_content,
			}
		)
	else:
		doc = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": channel_id,
				"text": text,
				"message_type": "Text",
				"json": json_content,
			}
		)

	if send_silently:
		doc.flags.send_silently = True

	doc.insert()
	return doc


@frappe.whitelist()
def fetch_recent_files(channel_id: str):
	"""
	Fetches recently sent files in a channel
	Check if the user has permission to view the channel
	"""
	if not frappe.has_permission("Raven Channel", doc=channel_id):
		frappe.throw(_("You don't have permission to view this channel"), frappe.PermissionError)
	files = frappe.db.get_all(
		"Raven Message",
		filters={"channel_id": channel_id, "message_type": ["in", ["Image", "File"]]},
		fields=["name", "file", "owner", "creation", "message_type"],
		order_by="creation desc",
		limit_page_length=10,
	)

	return files


def get_messages(channel_id: str):

	messages = frappe.db.get_all(
		"Raven Message",
		filters={"channel_id": channel_id},
		fields=[
			"name",
			"owner",
			"creation",
			"modified",
			"text",
			"file",
			"message_type",
			"message_reactions",
			"is_reply",
			"linked_message",
			"_liked_by",
			"channel_id",
			"thumbnail_width",
			"thumbnail_height",
			"file_thumbnail",
			"link_doctype",
			"link_document",
			"replied_message_details",
			"content",
			"is_edited",
			"is_thread",
			"is_forwarded",
		],
		order_by="creation asc",
	)

	return messages


@frappe.whitelist()
def save_message(message_id: str, add: str | bool = False):
	"""
	Save the message as a bookmark
	"""
	# no need to check if arg add is string, as Yes is being passed, which is what is expected by toggle_like
	if isinstance(add, bool):
		add = "Yes" if add else "No"

	if not frappe.has_permission(doctype="Raven Message", doc=message_id, ptype="read"):
		frappe.throw(_("You don't have permission to save this message"), frappe.PermissionError)

	from frappe.desk.like import toggle_like

	toggle_like("Raven Message", message_id, add)

	liked_by = frappe.db.get_value("Raven Message", message_id, "_liked_by")

	frappe.publish_realtime(
		"message_saved",
		{
			"message_id": message_id,
			"liked_by": liked_by,
		},
		user=frappe.session.user,
	)

	return "message saved"


@frappe.whitelist()
def get_pinned_messages(channel_id: str):

	# check if the user has permission to view the channel
	frappe.has_permission("Raven Channel", doc=channel_id, ptype="read", throw=True)

	pinnedMessagesString = frappe.db.get_value("Raven Channel", channel_id, "pinned_messages_string")
	pinnedMessages = pinnedMessagesString.split("\n") if pinnedMessagesString else []

	return frappe.db.get_all(
		"Raven Message",
		filters={"name": ["in", pinnedMessages]},
		fields=[
			"name",
			"owner",
			"creation",
			"bot",
			"text",
			"file",
			"message_type",
			"message_reactions",
			"_liked_by",
			"channel_id",
			"thumbnail_width",
			"thumbnail_height",
			"file_thumbnail",
			"link_doctype",
			"link_document",
			"replied_message_details",
			"hide_link_preview",
			"is_bot_message",
			"content",
			"is_edited",
			"is_thread",
			"is_forwarded",
		],
		order_by="creation asc",
	)


@frappe.whitelist()
def get_saved_messages():
	"""
	Fetches list of all messages liked by the user
	Check if the user has permission to view the message
	"""

	raven_message = frappe.qb.DocType("Raven Message")
	raven_channel = frappe.qb.DocType("Raven Channel")
	raven_channel_member = frappe.qb.DocType("Raven Channel Member")

	query = (
		frappe.qb.from_(raven_message)
		.join(raven_channel, JoinType.left)
		.on(raven_message.channel_id == raven_channel.name)
		.join(raven_channel_member, JoinType.left)
		.on(raven_channel.name == raven_channel_member.channel_id)
		.select(
			raven_message.name,
			raven_message.owner,
			raven_message.creation,
			raven_message.text,
			raven_message.channel_id,
			raven_message.file,
			raven_message.message_type,
			raven_message.message_reactions,
			raven_message._liked_by,
			raven_channel.workspace,
			raven_message.thumbnail_width,
			raven_message.thumbnail_height,
			raven_message.is_bot_message,
			raven_message.bot,
		)
		.where(raven_message._liked_by.like("%" + frappe.session.user + "%"))
		.where(
			(raven_channel.type.isin(["Open", "Public"]))
			| (raven_channel_member.user_id == frappe.session.user)
		)
		.orderby(raven_message.creation, order=Order.asc)
		.distinct()
	)  # Add DISTINCT keyword to retrieve only unique messages

	messages = query.run(as_dict=True)

	return messages


def parse_messages(messages):

	messages_with_date_header = []
	previous_message = None

	for i in range(len(messages)):
		message = messages[i]
		is_continuation = (
			previous_message
			and message["owner"] == previous_message["owner"]
			and (message["creation"] - previous_message["creation"]) < timedelta(minutes=2)
		)
		message["is_continuation"] = int(bool(is_continuation))

		if i == 0 or message["creation"].date() != previous_message["creation"].date():
			messages_with_date_header.append({"block_type": "date", "data": message["creation"].date()})

		messages_with_date_header.append({"block_type": "message", "data": message})

		previous_message = message

	return messages_with_date_header


def check_permission(channel_id):
	if frappe.get_cached_value("Raven Channel", channel_id, "type") == "Private":
		if is_channel_member(channel_id):
			pass
		elif frappe.session.user == "Administrator":
			pass
		else:
			frappe.throw(_("You don't have permission to view this channel"), frappe.PermissionError)


@frappe.whitelist()
def get_messages_with_dates(channel_id: str):
	check_permission(channel_id)
	messages = get_messages(channel_id)
	track_channel_visit(channel_id=channel_id, publish_event_for_user=True, commit=True)
	return parse_messages(messages)


@frappe.whitelist()
def get_unread_count_for_channels():
	"""
	Fetch all channels where the user has unread messages > 0
	"""

	channel = frappe.qb.DocType("Raven Channel")
	channel_member = frappe.qb.DocType("Raven Channel Member")
	message = frappe.qb.DocType("Raven Message")
	query = (
		frappe.qb.from_(channel)
		.left_join(channel_member)
		.on(
			(channel.name == channel_member.channel_id) & (channel_member.user_id == frappe.session.user)
		)
		.where(channel_member.user_id == frappe.session.user)
		.where(channel.is_archived == 0)
		.where(channel.is_thread == 0)
		.where(message.message_type != "System")
		.where(
			message.creation > Coalesce(channel_member.last_visit, "2000-11-11")
		)  # Only count messages after the last visit for performance
		.left_join(message)
		.on(channel.name == message.channel_id)
	)

	channels_query = (
		query.select(channel.name, channel.is_direct_message, Count(message.name).as_("unread_count"))
		.groupby(channel.name, channel.is_direct_message)
		.run(as_dict=True)
	)

	return channels_query


@frappe.whitelist()
def get_unread_count_for_channel(channel_id: str):
	channel_member = get_channel_member(channel_id=channel_id)
	if channel_member:
		last_timestamp = frappe.get_cached_value(
			"Raven Channel Member", channel_member["name"], "last_visit"
		)

		return frappe.db.count(
			"Raven Message",
			filters={
				"channel_id": channel_id,
				"creation": (">", last_timestamp),
				"message_type": ["!=", "System"],
			},
		)
	else:
		if frappe.get_cached_value("Raven Channel", channel_id, "type") == "Open":
			return frappe.db.count(
				"Raven Message",
				filters={
					"channel_id": channel_id,
					"message_type": ["!=", "System"],
				},
			)
		else:
			return 0


@frappe.whitelist()
def get_timeline_message_content(doctype: str, docname: str | int):
	channel = frappe.qb.DocType("Raven Channel")
	channel_member = frappe.qb.DocType("Raven Channel Member")
	message = frappe.qb.DocType("Raven Message")
	user = frappe.qb.DocType("User")
	query = (
		frappe.qb.from_(message)
		.select(
			message.creation,
			message.owner,
			message.name,
			message.text,
			message.file,
			channel.name.as_("channel_id"),
			channel.channel_name,
			channel.type,
			channel.is_direct_message,
			user.full_name,
			channel.is_self_message,
		)
		.join(channel)
		.on(message.channel_id == channel.name)
		.join(channel_member)
		.on(
			(message.channel_id == channel_member.channel_id) & (message.owner == channel_member.user_id)
		)
		.join(user)
		.on(message.owner == user.name)
		.where((channel.type != "Private") | (channel_member.user_id == frappe.session.user))
		.where(message.link_doctype == doctype)
		.where(message.link_document == docname)
	)
	data = query.run(as_dict=True)

	timeline_contents = []
	for log in data:

		if log.is_direct_message:
			peer_user_id = get_peer_user_id(log.channel_id, log.is_direct_message, log.is_self_message)
			if peer_user_id:
				log["peer_user"] = frappe.db.get_value("User", peer_user_id, "full_name")
		timeline_contents.append(
			{
				"icon": "share",
				"is_card": True,
				"creation": log.creation,
				"template": "send_message",
				"template_data": log,
			}
		)

	return timeline_contents


file_extensions = {
	"doc": [
		"doc",
		"docx",
		"odt",
		"ott",
		"rtf",
		"txt",
		"dot",
		"dotx",
		"docm",
		"dotm",
		"pages",
	],
	"ppt": [
		"ppt",
		"pptx",
		"odp",
		"otp",
		"pps",
		"ppsx",
		"pot",
		"potx",
		"pptm",
		"ppsm",
		"potm",
		"ppam",
		"ppa",
		"key",
	],
	"xls": [
		"xls",
		"xlsx",
		"csv",
		"ods",
		"ots",
		"xlsb",
		"xlsm",
		"xlt",
		"xltx",
		"xltm",
		"xlam",
		"xla",
		"numbers",
	],
}


@frappe.whitelist()
def get_all_files_shared_in_channel(
	channel_id: str,
	file_name: str | None = None,
	file_type: str | None = None,
	start_after: int = 0,
	page_length: int | None = None,
):

	# check if the user has permission to view the channel
	check_permission(channel_id)

	message = frappe.qb.DocType("Raven Message")
	user = frappe.qb.DocType("Raven User")
	file = frappe.qb.DocType("File")

	query = (
		frappe.qb.from_(message)
		.join(file)
		.on(message.name == file.attached_to_name)
		.join(user)
		.on(message.owner == user.name)
		.select(
			file.name,
			file.file_name,
			file.file_type,
			file.file_size,
			file.file_url,
			message.owner,
			message.creation,
			message.message_type,
			message.thumbnail_width,
			message.thumbnail_height,
			message.file_thumbnail,
			user.full_name,
			user.user_image,
			message.name.as_("message_id"),
		)
		.where(message.channel_id == channel_id)
	)

	# search for file name
	if file_name:
		query = query.where(file.file_name.like("%" + file_name + "%"))

	# search for file type
	if file_type:
		if file_type == "image":
			query = query.where(message.message_type == "Image")
		elif file_type == "file":
			query = query.where(message.message_type == "File")
		elif file_type == "pdf":
			query = query.where(file.file_type == "pdf")
		else:
			# Get the list of extensions for the given file type
			extensions = file_extensions.get(file_type)
			if extensions:
				query = query.where((file.file_type).isin(extensions))
	else:
		query = query.where(message.message_type.isin(["Image", "File"]))

	files = (
		query.orderby(message.creation, order=Order["desc"])
		.limit(page_length)
		.offset(start_after)
		.run(as_dict=True)
	)

	return files


@frappe.whitelist()
def get_count_for_pagination_of_files(
	channel_id: str, file_name: str | None = None, file_type: str | None = None
):

	# check if the user has permission to view the channel
	check_permission(channel_id)

	message = frappe.qb.DocType("Raven Message")
	# user = frappe.qb.DocType("Raven User")
	file = frappe.qb.DocType("File")

	query = (
		frappe.qb.from_(message)
		.join(file, JoinType.left)
		.on(message.name == file.attached_to_name)
		.select(Count(message.name).as_("count"))
		.where(message.channel_id == channel_id)
	)

	# search for file name
	if file_name:
		query = query.where(file.file_name.like("%" + file_name + "%"))

	# search for file type
	if file_type:
		if file_type == "image":
			query = query.where(message.message_type == "Image")
		elif file_type == "pdf":
			query = query.where(file.file_type == "pdf")
		else:
			# Get the list of extensions for the given file type
			extensions = file_extensions.get(file_type)
			if extensions:
				query = query.where((file.file_type).isin(extensions))
	else:
		query = query.where(message.message_type.isin(["Image", "File"]))
	count = query.run(as_dict=True)

	return count[0]["count"]


@frappe.whitelist(methods=["POST"])
def forward_message(message_receivers: list[dict], forwarded_message: dict):
	"""
	Forward a message to multiple users/ or in multiple channels
	"""
	for receiver in message_receivers:
		if receiver["type"] == "User":
			# send forwarded message as a DM to the user
			# get DM channel ID, create a copy of the message and send it to the channel, change the message owner to current sender
			dm_channel_id = create_direct_message_channel(receiver["name"])
			add_forwarded_message_to_channel(dm_channel_id, forwarded_message)
		else:
			# send forwarded message to the channel
			add_forwarded_message_to_channel(receiver["name"], forwarded_message)

	return "messages forwarded"


def add_forwarded_message_to_channel(channel_id: str, forwarded_message: dict):
	"""
	Forward a message to a channel - copy over the message,
	change the owner to the current user and timestamp to now,
	mark it as forwarded
	"""
	# If the forwarded message has a file, we need to remove the "fid" from the URL - this is done so that the new user can access the file
	if forwarded_message.get("file"):
		forwarded_message["file"] = forwarded_message["file"].split("?")[0]
	doc = frappe.get_doc(
		{
			"doctype": "Raven Message",
			**forwarded_message,
			"channel_id": channel_id,
			"name": None,
			"owner": frappe.session.user,
			"creation": frappe.utils.now_datetime(),
			"modified": frappe.utils.now_datetime(),
			"is_continuation": 0,
			"is_edited": 0,
			"is_reply": 0,
			"is_forwarded": 1,
			"is_thread": 0,
			"replied_message_details": None,
			"message_reactions": None,
			"linked_message": None,
		}
	)
	doc.insert()
	return "message forwarded"
