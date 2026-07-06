import frappe


def get_raven_room():
	"""
	Room which any user with the role "Raven User" is subscribed to.
	"""
	# When they open the app, the will be subscribed to the users list.
	# We are just using the doctype room to send events to them
	# If we use "all" instead, then the events are only sent to System Users and not users who do not have Desk access.
	return "doctype:Raven User"


def track_channel_visit(channel_id, user=None, commit=False, publish_event_for_user=False):
	"""
	Track the last visit of the user to the channel.
	If the user is not a member of the channel, create a new member record
	"""

	if frappe.flags.read_only:
		return

	if not user:
		user = frappe.session.user

	# Get the channel member record
	channel_member = get_channel_member(channel_id, user)

	now = frappe.utils.now()

	if channel_member:
		# Update the last visit
		frappe.db.set_value("Raven Channel Member", channel_member["name"], "last_visit", now)

	# Else if the user is not a member of the channel and the channel is open, create a new member record
	elif frappe.get_cached_value("Raven Channel", channel_id, "type") == "Open":
		frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": channel_id,
				"user_id": frappe.session.user,
				"last_visit": now,
			}
		).insert()

	# Need to commit the changes to the database if the request is a GET request
	if commit:
		frappe.db.commit()  # nosempgrep

	if publish_event_for_user:
		frappe.publish_realtime(
			"raven:unread_channel_count_updated",
			{"channel_id": channel_id, "sent_by": frappe.session.user, "last_message_timestamp": now},
			user=user,
		)


# Workspace Members
def get_workspace_members(workspace_id: str):
	"""
	Gets all members of a workspace from the cache
	"""
	cache_key = f"raven:workspace_members:{workspace_id}"

	data = frappe.cache().get_value(cache_key)
	if data:
		return data

	members = frappe.db.get_all(
		"Raven Workspace Member",
		filters={"workspace": workspace_id},
		fields=["name", "user", "is_admin"],
	)

	data = {member.user: member for member in members}
	frappe.cache().set_value(cache_key, data)
	return data


def delete_workspace_members_cache(workspace_id: str):
	cache_key = f"raven:workspace_members:{workspace_id}"
	frappe.cache().delete_value(cache_key)


def get_workspace_member(workspace_id: str, user: str = None) -> dict:
	"""
	Get the workspace member ID
	"""
	if not user:
		user = frappe.session.user

	return get_workspace_members(workspace_id).get(user, None)


def is_workspace_member(workspace_id: str, user: str = None) -> bool:
	"""
	Check if a user is a member of a workspace
	"""
	if not user:
		user = frappe.session.user

	all_members = get_workspace_members(workspace_id)

	return user in all_members


def get_channel_members(channel_id: str):
	"""
	Gets all members of a channel from the cache as a map - also includes the type of the user
	"""
	cache_key = f"raven:channel_members:{channel_id}"

	data = frappe.cache().get_value(cache_key)
	if data:
		return data

	raven_channel_member = frappe.qb.DocType("Raven Channel Member")
	raven_user = frappe.qb.DocType("Raven User")

	query = (
		frappe.qb.from_(raven_channel_member)
		.join(raven_user)
		.on(raven_channel_member.user_id == raven_user.name)
		.select(
			raven_channel_member.name,
			raven_channel_member.user_id,
			raven_channel_member.is_admin,
			raven_channel_member.allow_notifications,
			raven_user.type,
		)
		.where(raven_channel_member.channel_id == channel_id)
		.where(raven_user.enabled == 1)
	)

	members = query.run(as_dict=True)

	data = {member.user_id: member for member in members}
	frappe.cache().set_value(cache_key, data)
	return data


def delete_channel_members_cache(channel_id: str):
	"""
	Delete the channel members cache and clear the push tokens for the channel if the flag is set to True

	By default, the push tokens are cleared when the channel members cache is deleted
	"""
	cache_key = f"raven:channel_members:{channel_id}"
	frappe.cache().delete_value(cache_key)

	frappe.publish_realtime(
		"channel_members_updated",
		{"channel_id": channel_id},
		room=get_raven_room(),
		after_commit=True,
	)


def get_channel_member(channel_id: str, user: str = None) -> dict:
	"""
	Get the channel member ID
	"""

	if not user:
		user = frappe.session.user

	all_members = get_channel_members(channel_id)

	return all_members.get(user, None)


def is_channel_member(channel_id: str, user: str = None) -> bool:
	"""
	Check if a user is a member of a channel
	"""
	if not user:
		user = frappe.session.user

	return user in get_channel_members(channel_id)


def get_raven_user(user_id: str) -> str:
	"""
	Get the Raven User ID of a user
	"""
	# TODO: Run this via cache
	raven_user = frappe.qb.DocType("Raven User")
	query = (
		frappe.qb.from_(raven_user)
		.select(raven_user.name)
		.where((raven_user.user == user_id) | (raven_user.bot == user_id))
		.limit(1)
	)

	result = query.run(pluck=True)

	return result[0] if result else None


def get_thread_reply_count(thread_id: str) -> int:
	"""
	Get the number of replies in a thread
	"""
	return frappe.cache().hget(
		"raven:thread_reply_count",
		thread_id,
		lambda: frappe.db.count(
			"Raven Message", {"channel_id": thread_id, "message_type": ["!=", "System"]}
		),
	)


def refresh_thread_reply_count(thread_id: str):
	"""
	Refresh the thread reply count
	"""
	new_count = frappe.db.count(
		"Raven Message", {"channel_id": thread_id, "message_type": ["!=", "System"]}
	)
	frappe.cache().hset("raven:thread_reply_count", thread_id, new_count)

	return new_count


def clear_thread_reply_count_cache(thread_id: str):
	"""
	Clear the thread reply count cache
	"""
	frappe.cache().hdel("raven:thread_reply_count", thread_id)


def make_api_call(url: str, api_key: str, api_secret: str, method: str, params: dict = None):
	"""
	Make an API call to the given URL
	"""
	from base64 import b64encode

	import requests

	token = b64encode(f"{api_key}:{api_secret}".encode()).decode()
	auth_header = {"Authorization": f"Basic {token}"}

	if method == "GET":
		response = requests.get(url, headers=auth_header, params=params)
	elif method == "POST":
		response = requests.post(url, headers=auth_header, json=params)

	# return response.json only if the response is successful
	if not response.ok:
		frappe.log_error(
			title="Raven Cloud API Error",
			message=f"Failed to make API call to {url}: {response.status_code} {response.text}",
		)
		raise Exception(f"Failed to make API call to {url}: {response.status_code} {response.text}")

	# Return the JSON response
	return response.json()
