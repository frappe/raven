import json
from urllib.parse import urlparse

import frappe
from frappe.frappeclient import FrappeClient
from frappe.utils import get_datetime, get_system_timezone
from pytz import timezone, utc

from raven.raven_cloud_notifications import get_site_name
from raven.utils import get_channel_members, make_api_call

MAX_NOTIFICATION_CONTENT_LENGTH = 1000


def send_notification_for_message(message):
	"""
	Send a push notification for a message.

	This is called in the "after_response" hook for user initiated requests.
	"""

	# if in developer mode or frappe.utils.get_url() is a localhost URL, then we should not send the push notification
	# reason: avoid sending notifications from restored backups from local environments
	if (
		frappe.conf.developer_mode
		or frappe.utils.get_url().startswith("http://localhost")
		or frappe.utils.get_url().startswith("http://127.0.0.1")
	):
		return

	raven_settings = frappe.get_cached_doc("Raven Settings")

	if raven_settings.push_notification_service == "Raven":
		send_push_notification_via_raven_cloud(message, raven_settings)

		return

	channel_doc = frappe.get_cached_doc("Raven Channel", message.channel_id)
	if channel_doc.is_direct_message and not channel_doc.is_self_message:
		message.send_notification_for_direct_message()

	else:
		message.send_notification_for_channel_message()


def send_push_notification_via_raven_cloud(message, raven_settings):
	"""
	Send a push notification via the Raven Cloud API
	"""
	channel_doc = frappe.get_cached_doc("Raven Channel", message.channel_id)

	if channel_doc.is_self_message:
		return

	try:
		channel_members = get_channel_members(message.channel_id)

		users = []

		# Loop over the channel members and add the users who have subscribed to push notifications
		for member in channel_members.values():
			is_dm_or_dm_thread = channel_doc.is_direct_message or channel_doc.is_dm_thread
			# if the channel is a DM or DM thread, then we should add all the users to the list
			# by default. The allow notifications field would be used in future when we expose
			# this setting in the UI to provide an option to the user to opt-out of push
			# notifications for a certain DM user
			if is_dm_or_dm_thread or member.get("allow_notifications") == 1:
				users.append(member.get("user_id"))

		if not users:
			return

		mentions = [user.get("user") for user in message.mentions]

		replied_to = None

		if message.linked_message:
			replied_message_details = message.replied_message_details

			if isinstance(replied_message_details, str):
				replied_message_details = json.loads(message.replied_message_details)

			replied_to = replied_message_details.get("owner")

		mentioned_users = []
		replied_users = []
		final_users = []

		# If this is a bot message, then we should not filter out the push tokens of the
		# message owner since we need to send the notification to the owner as well
		# (it's coming from the bot)
		if not message.is_bot_message:
			# Filter out the push tokens of the message owner
			users = [user for user in users if user != message.owner]

		for user in users:
			if user == replied_to:
				replied_users.append(user)
			elif user in mentions:
				mentioned_users.append(user)
			else:
				final_users.append(user)

		# We now need to construct the payload for the push notification

		if not mentioned_users and not replied_users and not final_users:
			return

		messages = []

		channel_name = f" in #{channel_doc.channel_name}"

		if channel_doc.is_thread:
			channel_name = " in thread"

		if channel_doc.is_direct_message:
			channel_name = ""

		content = message.get_notification_message_content()

		# Truncate the message content to fit within FCM payload limits
		truncated_content = truncate_notification_content(content)

		message_owner, message_owner_image = message.get_message_owner_details()

		workspace = "" if channel_doc.is_dm_thread else channel_doc.workspace

		url = frappe.utils.get_url() + "/raven/"
		if channel_doc.is_direct_message:
			url += "dm-channel/"
		elif workspace and not channel_doc.is_thread:
			url += f"{workspace}/"
		elif channel_doc.is_thread:
			url += "threads/"
		else:
			url += "notifications/"

		url += f"{channel_doc.name}/"

		image = get_image_absolute_url(message_owner_image)

		data = {
			"base_url": frappe.utils.get_url(),
			"message_url": url,
			"sitename": frappe.local.site,
			"message_id": message.name,
			"channel_id": message.channel_id,
			"raven_message_type": message.message_type,
			"channel_type": "DM" if channel_doc.is_direct_message else "Channel",
			"content": truncated_content,
			"from_user": message.owner,
			"type": "New message",
			"is_thread": "1" if channel_doc.is_thread else "0",
			"creation": get_milliseconds_since_epoch(message.creation),
			"image": image if image else "",
		}

		if replied_users:
			messages.append(
				{
					"users": replied_users,
					"notification": {
						"title": f"{message_owner} replied{channel_name}",
						"body": truncated_content,
					},
					"data": data,
					"tag": message.channel_id,
					"click_action": url,
					"image": image,
				}
			)

		if mentioned_users:
			messages.append(
				{
					"users": mentioned_users,
					"notification": {
						"title": f"{message_owner} mentioned you{channel_name}",
						"body": truncated_content,
					},
					"data": data,
					"tag": message.channel_id,
					"click_action": url,
					"image": image,
				}
			)

		if final_users:
			messages.append(
				{
					"users": final_users,
					"notification": {
						"title": f"{message_owner}{channel_name}",
						"body": truncated_content,
					},
					"data": data,
					"tag": message.channel_id,
					"click_action": url,
					"image": image,
				}
			)

		make_post_call_for_notification(messages, raven_settings)

	except Exception as e:
		frappe.log_error(title="Raven Cloud Push Notification Error")


def make_post_call_for_notification(messages, raven_settings):
	"""
	Make a post call to the push notification server to send the notification
	"""
	# instead of using the frappe client, we will use the requests library to make the post call
	# reason: FrappeClient's post_api method sends data in params which is not ideal for large payloads(Proxy returns JSON Decode errors as the URL is too long)
	# and post_request method uses "cmd" based key in it's payload which is weird semantically

	api_key = raven_settings.push_notification_api_key
	api_secret = raven_settings.get_password("push_notification_api_secret")

	url = f"{raven_settings.push_notification_server_url}/api/method/raven_cloud.api.notification.send_to_users"

	make_api_call(
		url=url,
		api_key=api_key,
		api_secret=api_secret,
		method="POST",
		params={"messages": json.dumps(messages), "site_name": get_site_name()},
	)


# The below functions are used to send push notifications via the Frappe Push Notification Service


def send_notification_to_user(user_id, title, message, data=None, user_image_path=None):
	"""
	Send a push notification to a user
	"""

	try:
		from frappe.push_notification import PushNotification

		push_notification = PushNotification("raven")

		if data is None:
			data = {"base_url": frappe.utils.get_url(), "sitename": frappe.local.site}
		else:
			data["base_url"] = frappe.utils.get_url()
			data["sitename"] = frappe.local.site

		if push_notification.is_enabled():
			icon_url = get_image_absolute_url(user_image_path)
			# v3 has no /channel/:id route — link to the message permalink
			# (client resolves its real home) or fall back to the app root.
			link = None
			if data.get("message_id"):
				link = frappe.utils.get_url() + "/raven/message/" + data.get("message_id")
			elif data.get("channel_id"):
				link = frappe.utils.get_url() + "/raven"
			push_notification.send_notification_to_user(
				user_id=user_id,
				title=title,
				body=message,
				icon=icon_url,
				data=data,
				link=link,
			)
	except ImportError:
		# push notifications are not supported in the current framework version
		pass
	except Exception:
		frappe.log_error("Failed to send push notification")


def send_notification_to_topic(channel_id, title, message, data=None, user_image_path=None):
	"""
	Send a push notification to a channel
	"""

	try:
		from frappe.push_notification import PushNotification

		push_notification = PushNotification("raven")

		if data is None:
			data = {"base_url": frappe.utils.get_url(), "sitename": frappe.local.site}
		else:
			data["base_url"] = frappe.utils.get_url()
			data["sitename"] = frappe.local.site

		if push_notification.is_enabled():
			icon_url = get_image_absolute_url(user_image_path)
			# v3 has no /channel/:id route — link to the message permalink
			# (client resolves its real home) or fall back to the app root.
			link = None
			if data.get("message_id"):
				link = frappe.utils.get_url() + "/raven/message/" + data.get("message_id")
			elif data.get("channel_id"):
				link = frappe.utils.get_url() + "/raven"
			push_notification.send_notification_to_topic(
				topic_name=channel_id,
				title=title,
				body=message,
				icon=icon_url,
				data=data,
				link=link,
			)
	except ImportError:
		# push notifications are not supported in the current framework version
		pass
	except Exception:
		frappe.log_error("Failed to send push notification")


def subscribe_user_to_topic(channel_id, user_id):
	"""
	Subscribe a user to a topic (channel name)
	"""
	notification_service = frappe.db.get_single_value("Raven Settings", "push_notification_service")

	if notification_service == "Raven":
		return

	try:
		from frappe.push_notification import PushNotification

		push_notification = PushNotification("raven")

		if push_notification.is_enabled():
			push_notification.subscribe_topic(user_id=user_id, topic_name=channel_id)
	except ImportError:
		# push notifications are not supported in the current framework version
		pass
	except Exception:
		frappe.log_error("Failed to subscribe user to channel")


def unsubscribe_user_to_topic(channel_id, user_id):
	"""
	Unsubscribe a user to a topic (channel name)
	"""
	notification_service = frappe.db.get_single_value("Raven Settings", "push_notification_service")

	if notification_service == "Raven":
		return

	try:
		from frappe.push_notification import PushNotification

		push_notification = PushNotification("raven")

		if push_notification.is_enabled():
			push_notification.unsubscribe_topic(user_id=user_id, topic_name=channel_id)
	except ImportError:
		# push notifications are not supported in the current framework version
		pass
	except Exception:
		frappe.log_error("Failed to unsubscribe user to channel")


def get_image_absolute_url(image_path):
	if not image_path:
		return None

	if image_path.startswith("/"):
		return frappe.utils.get_url() + image_path
	else:
		return image_path


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


def truncate_notification_content(content):
	"""
	Truncate the push notification message content to fit within FCM payload limits
	"""
	if not content:
		return

	return content[:MAX_NOTIFICATION_CONTENT_LENGTH]
