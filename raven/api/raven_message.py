from datetime import timedelta

import frappe
from frappe import _
from frappe.query_builder import JoinType, Order
from frappe.query_builder.functions import Coalesce, Count

from raven.api.raven_channel import create_direct_message_channel, get_peer_user_id_from_dm_users
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


IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "heic", "heif"}

# Inline-image display caps (mirror the web client's reserved box). The stored
# aspect ratio is what prevents reflow; the absolute thumbnail size only needs
# to be reasonable.
_IMAGE_THUMBNAIL_MAX_WIDTH = 480
_IMAGE_THUMBNAIL_MAX_HEIGHT = 320


def _file_message_type(file_url: str) -> str:
	ext = file_url.rsplit(".", 1)[-1].split("?")[0].lower() if "." in file_url else ""
	return "Image" if ext in IMAGE_EXTENSIONS else "File"


def _set_image_dimensions(doc):
	"""
	Measure an already-uploaded image and store its intrinsic dimensions plus a
	display thumbnail size, so the client can reserve the exact box before the
	image loads — no layout shift / scroll jump on render.

	Best-effort: anything PIL can't measure (SVG, unreadable upload) is skipped
	silently and the client falls back to a default box.
	"""
	from frappe.core.doctype.file.utils import get_local_image
	from PIL import ImageOps

	try:
		image, _filename, _extn = get_local_image(doc.file)
		# Honour EXIF orientation. Phone photos are often stored rotated with an
		# orientation tag; the browser auto-orients on display, so the box we
		# reserve must use the *displayed* size, not the raw stored size —
		# otherwise a portrait photo reserves a landscape box and reflows on load.
		# In-memory only: we don't rewrite the file (browsers honour the tag).
		image = ImageOps.exif_transpose(image)
		width, height = image.size
	except Exception:
		return

	if not width or not height:
		return

	doc.image_width = width
	doc.image_height = height

	if width > height:
		thumbnail_width = min(width, _IMAGE_THUMBNAIL_MAX_WIDTH)
		thumbnail_height = int(height * thumbnail_width / width)
	else:
		thumbnail_height = min(height, _IMAGE_THUMBNAIL_MAX_HEIGHT)
		thumbnail_width = int(width * thumbnail_height / height)

	doc.thumbnail_width = thumbnail_width
	doc.thumbnail_height = thumbnail_height


def _get_existing_batch(client_id: str):
	"""
	The messages already created for a client_id (= message_batch_id), oldest first,
	or None. This is the idempotency lookup: it runs on every send, so message_batch_id
	is indexed (search_index on the field).
	"""
	names = frappe.get_all(
		"Raven Message",
		filters={"message_batch_id": client_id},
		order_by="creation asc",
		pluck="name",
	)
	return [frappe.get_doc("Raven Message", name) for name in names] if names else None


def _create_batch(channel_id: str, batch_id: str | None, specs: list[dict], send_silently: bool):
	"""Insert the batch's messages in order (attachments first, then text)."""
	created = []
	last_index = len(specs) - 1
	for index, spec in enumerate(specs):
		doc = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": channel_id,
				"message_batch_id": batch_id,
				**spec,
			}
		)
		# Measure images so the client reserves the exact box (no layout shift).
		if doc.message_type == "Image" and doc.file:
			_set_image_dimensions(doc)
		if send_silently:
			doc.flags.send_silently = True
		# Only the last (newest) message updates the channel's last-message summary;
		# the rest skip that write to avoid redundant contention on the channel row.
		if index < last_index:
			doc.flags.skip_channel_summary = True
		doc.insert()
		created.append(doc)

	return created


def _create_batch_idempotent(
	channel_id: str, client_id: str, specs: list[dict], send_silently: bool
):
	"""
	Create the batch at most once for a given client_id, so a retried send can't
	duplicate. A retry (auto-retry on reconnect, or a lost ack) is sequential with
	the attempt it repeats, and the batch is atomic (all-or-none) — so a committed
	send is found here and returned as-is instead of being created again.

	No lock: the only gap is two clients retrying the SAME send within the few-ms
	commit window (e.g. two tabs rehydrating one outbox at the exact same instant).
	That's rare enough that a lock — and the worker it would block — isn't worth it.
	"""
	existing = _get_existing_batch(client_id)
	if existing:
		return existing

	return _create_batch(channel_id, client_id, specs, send_silently)


@frappe.whitelist(methods=["POST"])
def send_message_with_attachments(
	channel_id: str,
	content: str | None = None,
	files: list[dict] | str | None = None,
	client_id: str | None = None,
	is_reply: bool = False,
	linked_message: str | None = None,
	send_silently: bool = False,
):
	"""
	v3 composer send. Creates one message per (already-uploaded) file first —
	attachments render above the text — then the text message, all stamped with the
	same message_batch_id when the send produces more than one message. Runs in a
	single request transaction, so the batch is all-or-nothing.

	`files` is a list of `{"file_url", "file_size"}` for the already-uploaded
	attachments — the size is denormalized onto each message so the client can show
	it without a File lookup. (A bare URL string per file is also tolerated.)

	`send_silently` suppresses notifications for the whole batch (the flag is set on
	every message before insert).

	Returns the created messages in order. The client reconciles its optimistic
	insert against this response — the ack, not the realtime echo, is authoritative
	for the sender.

	`client_id` is a client-generated id used as the batch id AND the idempotency
	key: a retried send (same client_id) returns the already-created messages
	instead of duplicating them. It is not persisted beyond the batch id.
	"""
	if isinstance(files, str):
		files = frappe.parse_json(files)
	files = files or []

	content = content or ""
	has_text = bool(frappe.utils.strip_html_tags(content).strip())
	# A custom emoji is an inline <img> with no text, so strip_html_tags leaves it
	# empty — but a message that is only a custom emoji is NOT empty. (Standard emojis
	# are unicode text and already count as has_text.)
	has_custom_emoji = 'data-type="customEmoji"' in content
	has_body = has_text or has_custom_emoji

	if not has_body and not files:
		frappe.throw(_("Cannot send an empty message"))

	# Every message from a send carries the client_id as its batch id: it groups
	# multi-message sends in the UI AND lets the client match the realtime echo of
	# each member back to its optimistic placeholder. A unique client_id per send
	# means single messages are never falsely grouped (the renderer groups 2+ only).
	batch_id = client_id

	# Ordered message specs: attachments first (they render above the caption),
	# then the text. Each file carries its url + size (size is read straight from
	# the client's upload response, so no per-file File lookup is needed here).
	specs = []
	for f in files:
		file_url = f["file_url"] if isinstance(f, dict) else f
		file_size = f.get("file_size") if isinstance(f, dict) else None
		specs.append(
			{
				"message_type": _file_message_type(file_url),
				"file": file_url,
				"file_size": file_size or 0,
			}
		)
	if has_body:
		specs.append({"message_type": "Text", "text": content})

	# The reply attaches to the LAST message of the batch — the caption when there
	# is text, otherwise the final attachment. (A files-only reply must still carry
	# the reply)
	if is_reply and linked_message and specs:
		specs[-1]["is_reply"] = True
		specs[-1]["linked_message"] = linked_message

	# Without a client_id there's no idempotency key — just create.
	if not client_id:
		return _create_batch(channel_id, batch_id, specs, send_silently)

	return _create_batch_idempotent(channel_id, client_id, specs, send_silently)


@frappe.whitelist(methods=["POST"])
def delete_messages(message_ids: list[str]):
	"""
	Bulk delete messages since messages can be grouped in the UI
	"""
	# Sort ascending so we delete oldest first: the newest message is the one most likely to
	# be the channel's last message, so deleting it LAST means the channel summary is recomputed
	# only once (and lands on the correct pre-batch message). Every member except that last one
	# skips the channel-summary recompute/event — so the unread-count event is broadcast once
	# instead of once per deleted message. (The per-message message_deleted + search removal
	# still fire for each.)
	messages = frappe.get_all(
		"Raven Message", filters={"name": ["in", message_ids]}, order_by="creation asc", pluck="name"
	)
	for index, message_id in enumerate(messages):
		doc = frappe.get_doc("Raven Message", message_id)
		if index < len(messages) - 1:
			doc.flags.skip_channel_summary = True
		doc.delete(delete_permanently=True)


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

	liked_by, channel_id = frappe.db.get_value(
		"Raven Message", message_id, ["_liked_by", "channel_id"]
	)

	frappe.publish_realtime(
		"message_saved",
		{
			"channel_id": channel_id,
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
			raven_channel.is_thread,
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

	# Resolve each message's real (parent) channel so the client can filter and route
	# thread replies. A thread message lives in a thread channel (Raven Channel.is_thread = 1)
	# whose name equals the thread's root message; the parent is that root message's channel.
	# Non-thread messages are their own parent.
	for message in messages:
		is_thread_channel = message.pop("is_thread", 0)
		if is_thread_channel:
			parent_channel_id = frappe.db.get_value("Raven Message", message["channel_id"], "channel_id")
			message["parent_channel_id"] = parent_channel_id or message["channel_id"]
		else:
			message["parent_channel_id"] = message["channel_id"]

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
		.where(message.owner != frappe.session.user)
		.left_join(message)
		.on(channel.name == message.channel_id)
	)

	channels_query = (
		query.select(
			channel.name,
			channel.is_direct_message,
			# Count a batch (a multi-part send sharing message_batch_id — e.g. several files)
			# as ONE unread; un-batched messages fall back to their unique name.
			Count(Coalesce(message.message_batch_id, message.name)).distinct().as_("unread_count"),
		)
		.groupby(channel.name, channel.is_direct_message)
		.run(as_dict=True)
	)

	return channels_query


@frappe.whitelist()
def get_unread_count_for_channel(channel_id: str):
	"""
	Deprecated - not used in v3
	"""
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
				"owner": ["!=", frappe.session.user],
			},
		)
	else:
		if frappe.get_cached_value("Raven Channel", channel_id, "type") == "Open":
			return frappe.db.count(
				"Raven Message",
				filters={
					"channel_id": channel_id,
					"message_type": ["!=", "System"],
					"owner": ["!=", frappe.session.user],
				},
			)
		else:
			return 0


@frappe.whitelist()
def get_message_readers(message_id: str):
	"""
	Return the channel members who have read `message_id`.

	A member has read the message when their `last_visit` watermark is at or
	after the message's creation. The message author is excluded (they
	trivially read their own message). Accepted caveat: in Open channels a user
	who can see the channel but has no Raven Channel Member record (never
	visited) does not appear.
	"""
	message = frappe.db.get_value(
		"Raven Message", message_id, ["channel_id", "creation", "owner"], as_dict=True
	)
	if not message:
		frappe.throw(_("Message not found"))

	frappe.has_permission("Raven Channel", doc=message.channel_id, throw=True)

	member = frappe.qb.DocType("Raven Channel Member")
	readers = (
		frappe.qb.from_(member)
		.select(member.user_id, member.last_visit)
		.where(member.channel_id == message.channel_id)
		.where(member.last_visit >= message.creation)
		.where(member.user_id != message.owner)
		.orderby(member.last_visit, order=Order.asc)
		.run(as_dict=True)
	)
	return readers


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
			channel.dm_user_1,
			channel.dm_user_2,
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
			peer_user_id = get_peer_user_id_from_dm_users(log)
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
	# Forwarding drops the reply link (linked_message lives in the source channel); inline the
	# replied message as a blockquote once, up front, so the quote survives every forward.
	if forwarded_message.get("is_reply"):
		quote = build_reply_blockquote(forwarded_message.get("replied_message_details"))
		if quote:
			forwarded_message["text"] = quote + (forwarded_message.get("text") or "")

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


def build_reply_blockquote(replied_message_details) -> str:
	"""
	Build a Tiptap-compatible blockquote (HTML) from a message's replied_message_details,
	used when forwarding a reply so the quoted message is inlined into the forwarded body.
	"""
	if not replied_message_details:
		return ""

	details = replied_message_details
	if isinstance(details, str):
		details = frappe.parse_json(details)
	if not details:
		return ""

	owner = details.get("owner")
	author = (owner and frappe.get_cached_value("User", owner, "full_name")) or owner or ""

	# Text replies keep their rich HTML body; for any other type (Image, File, Poll, ...)
	# `content` holds the derived teaser (e.g. the file/image name).
	if details.get("message_type") == "Text" and details.get("text"):
		body = details["text"]
	else:
		body = f"<p>{frappe.utils.escape_html(details.get('content') or '')}</p>"

	return (
		f"<blockquote><p><strong>{frappe.utils.escape_html(author)}</strong></p>{body}</blockquote>"
	)
