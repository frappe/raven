import frappe
from frappe import _
from frappe.query_builder import Order
from frappe.query_builder.functions import Coalesce, Count

from raven.api.raven_channel import get_peer_user_id, is_channel_member
from raven.utils import get_channel_members, get_thread_reply_count


@frappe.whitelist(methods=["GET"])
def get_number_of_replies(thread_id: str):
	"""
	Get the number of replies in a thread
	"""
	return get_thread_reply_count(thread_id)


@frappe.whitelist(methods=["GET"])
def get_all_threads(
	workspace: str = None,
	content: str = None,
	channel_id: str = None,
	is_ai_thread: int = 0,
	start_after: int = 0,
	limit: int = 10,
	only_show_unread: bool = False,
):
	"""
	Get all the threads in which the user is a participant
	(We are not fetching the messages inside a thread here, just the main thread message,
	We will fetch the messages inside a thread when the user clicks on 'View Thread')
	"""

	# Fetch all channels in which is_thread = 1 and the current user is a member

	channel = frappe.qb.DocType("Raven Channel")
	channel_member = frappe.qb.DocType("Raven Channel Member")
	message = frappe.qb.DocType("Raven Message").as_("message")
	thread_messages = frappe.qb.DocType("Raven Message").as_("thread_messages")

	query = (
		frappe.qb.from_(channel)
		.select(
			channel.name,
			channel.workspace,
			channel.last_message_timestamp,
			# channel.last_message_details,
			channel.is_ai_thread,
			channel.is_dm_thread,
			message.name.as_("thread_message_id"),
			message.channel_id,
			message.message_type,
			message.text,
			message.content,
			message.file,
			message.poll_id,
			message.is_bot_message,
			message.bot,
			message.hide_link_preview,
			message.link_doctype,
			message.link_document,
			message.image_height,
			message.image_width,
			message.owner,
			message.creation,
			Count(thread_messages.name).as_("reply_count"),
		)
		.left_join(message)
		.on((message.is_thread == 1) & (message.name == channel.name))
		.left_join(channel_member)
		.on(
			(channel.name == channel_member.channel_id) & (channel_member.user_id == frappe.session.user)
		)
		.left_join(thread_messages)
		.on((channel.name == thread_messages.channel_id) & (thread_messages.message_type != "System"))
		.where(channel_member.user_id == frappe.session.user)
		.where(channel.is_thread == 1)
		.where(channel.is_ai_thread == is_ai_thread)
		.limit(limit)
		.offset(start_after)
		.groupby(channel.name)
	)

	if workspace:
		query = query.where((channel.workspace == workspace) | (channel.is_dm_thread == 1))

	if content:
		query = query.where(message.content.like(f"%{content}%"))

	if channel_id and channel_id != "all":
		query = query.where(message.channel_id == channel_id)

	if only_show_unread == True or only_show_unread == "true":
		query = query.where(
			channel.last_message_timestamp > Coalesce(channel_member.last_visit, "2000-11-11")
		)

	query = query.orderby(channel.last_message_timestamp, order=Order.desc)

	# return
	threads = query.run(as_dict=True)

	for thread in threads:
		# Fetch the participants of the thread if it's not an AI thread or a DM thread
		if not thread["is_ai_thread"] and not thread["is_dm_thread"]:
			thread_members = get_channel_members(thread["name"])
			thread["participants"] = [{"user_id": member} for member in thread_members]

	return threads


@frappe.whitelist(methods=["GET"])
def get_other_threads(
	workspace: str = None,
	content: str = None,
	channel_id: str = None,
	is_ai_thread: int = 0,
	start_after: int = 0,
	limit: int = 10,
):
	"""
	Get all the threads in which the user is not a participant, but is a member of the channel
	"""

	channel_member = frappe.qb.DocType("Raven Channel Member")
	thread_channel = frappe.qb.DocType("Raven Channel").as_("thread_channel")
	main_thread_message = frappe.qb.DocType("Raven Message").as_("main_thread_message")
	thread_channel_member = frappe.qb.DocType("Raven Channel Member").as_("thread_channel_member")
	thread_message = frappe.qb.DocType("Raven Message").as_("thread_message")

	# Build the query to get threads where user is not a participant but has access to main channel
	query = (
		frappe.qb.from_(thread_channel)
		.select(
			thread_channel.name,
			thread_channel.workspace,
			thread_channel.last_message_timestamp,
			# thread_channel.last_message_details,
			thread_channel.is_ai_thread,
			thread_channel.is_dm_thread,
			main_thread_message.name.as_("thread_message_id"),
			main_thread_message.channel_id,
			main_thread_message.message_type,
			main_thread_message.text,
			main_thread_message.content,
			main_thread_message.file,
			main_thread_message.poll_id,
			main_thread_message.is_bot_message,
			main_thread_message.bot,
			main_thread_message.hide_link_preview,
			main_thread_message.link_doctype,
			main_thread_message.link_document,
			main_thread_message.image_height,
			main_thread_message.image_width,
			main_thread_message.owner,
			main_thread_message.creation,
			Count(thread_message.name).as_("reply_count"),
		)
		.left_join(main_thread_message)
		.on((main_thread_message.is_thread == 1) & (main_thread_message.name == thread_channel.name))
		.left_join(thread_message)
		.on(
			(thread_channel.name == thread_message.channel_id) & (thread_message.message_type != "System")
		)
		.left_join(channel_member)
		.on(
			(main_thread_message.channel_id == channel_member.channel_id)
			& (channel_member.user_id == frappe.session.user)
		)
		.left_join(thread_channel_member)
		.on(
			(thread_channel.name == thread_channel_member.channel_id)
			& (thread_channel_member.user_id == frappe.session.user)
		)
		.where(thread_channel.is_thread == 1)
		.where(thread_channel.is_ai_thread == is_ai_thread)
		.where(channel_member.user_id == frappe.session.user)  # User must be member of main channel
		.where(thread_channel_member.user_id.isnull())  # User must NOT be member of thread channel
		.limit(limit)
		.offset(start_after)
		.groupby(thread_channel.name)
	)

	if workspace:
		query = query.where((thread_channel.workspace == workspace) | (thread_channel.is_dm_thread == 1))

	if content:
		query = query.where(main_thread_message.content.like(f"%{content}%"))

	if channel_id and channel_id != "all":
		query = query.where(main_thread_message.channel_id == channel_id)

	query = query.orderby(thread_channel.last_message_timestamp, order=Order.desc)

	threads = query.run(as_dict=True)

	for thread in threads:
		# Fetch the participants of the thread if it's not an AI thread or a DM thread
		if not thread["is_ai_thread"] and not thread["is_dm_thread"]:
			thread_members = get_channel_members(thread["name"])
			thread["participants"] = [{"user_id": member} for member in thread_members]

	return threads


@frappe.whitelist(methods=["GET"])
def get_unread_threads(workspace: str = None, thread_id: str = None):
	"""
	Get the number of threads in which the user is a participant and has unread messages > 0
	"""

	channel = frappe.qb.DocType("Raven Channel")
	channel_member = frappe.qb.DocType("Raven Channel Member")
	message = frappe.qb.DocType("Raven Message")

	query = (
		frappe.qb.from_(channel)
		.select(channel.name, channel.workspace, Count(message.name).as_("unread_count"))
		.left_join(channel_member)
		.on(
			(channel.name == channel_member.channel_id) & (channel_member.user_id == frappe.session.user)
		)
		.left_join(message)
		.on(channel.name == message.channel_id)
		.where(channel.is_thread == 1)
		.where(channel.is_ai_thread == 0)
		.where(message.message_type != "System")
		.where(message.creation > Coalesce(channel_member.last_visit, "2000-11-11"))
		.where(channel_member.user_id == frappe.session.user)
		.groupby(channel.name)
	)

	if workspace:
		query = query.where((channel.workspace == workspace) | (channel.is_dm_thread == 1))

	if thread_id:
		query = query.where(channel.name == thread_id)

	return query.run(as_dict=True)


@frappe.whitelist(methods=["POST"])
def create_thread(message_id: str):
	"""
	A thread can be created by any user with read access to the channel in which the message has been sent.
	The thread will be created with this user as the first participant.
	(If the user is not the sender of the message, the sender will be added as the second participant)
	"""

	thread_message = frappe.get_doc("Raven Message", message_id)

	channel_doc = frappe.get_cached_doc("Raven Channel", thread_message.channel_id)

	# Convert the message to a thread
	thread_channel = frappe.get_doc(
		{
			"doctype": "Raven Channel",
			"channel_name": message_id,
			"workspace": channel_doc.workspace,
			"type": "Private",
			"is_thread": 1,
			"is_dm_thread": channel_doc.is_direct_message,
			"description": thread_message.content,
		}
	).insert()

	users_added_to_thread = []

	# Add the creator of the original message as a participant
	creator = thread_message.owner

	if creator != frappe.session.user:
		frappe.get_doc(
			{"doctype": "Raven Channel Member", "channel_id": thread_channel.name, "user_id": creator}
		).insert(ignore_permissions=True)
		users_added_to_thread.append(creator)

	else:
		# By now, the creator of the thread and the creator of the original message should be added as participants

		# In a DM channel (not self message), it is possible that the creator of the thread is also the creator of the original message
		# In this case, the creator is already a participant of the thread, but it's peer is not.

		if channel_doc.is_direct_message == 1 and not channel_doc.is_self_message:
			# Get the peer of the DM channel
			peer_user_id = get_peer_user_id(channel_doc.name, 1)

			if peer_user_id:
				frappe.get_doc(
					{
						"doctype": "Raven Channel Member",
						"channel_id": thread_channel.name,
						"user_id": peer_user_id,
					}
				).insert(ignore_permissions=True)
				users_added_to_thread.append(peer_user_id)

	# In the original message, any mentioned users should also be added as participants
	for mention in thread_message.mentions:
		if mention.user not in users_added_to_thread:
			try:
				# Check if this user is a member of the parent channel
				if is_channel_member(channel_doc.name, mention.user):
					frappe.get_doc(
						{
							"doctype": "Raven Channel Member",
							"channel_id": thread_channel.name,
							"user_id": mention.user,
						}
					).insert(ignore_permissions=True)
					users_added_to_thread.append(mention.user)
			except Exception:
				pass

	# Update the message to mark it as a thread
	thread_message.is_thread = 1
	thread_message.save(ignore_permissions=True)

	return {"channel_id": thread_message.channel_id, "thread_id": thread_channel.name}
