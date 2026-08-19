import json

import frappe
from frappe import _

from raven.utils import is_channel_member


@frappe.whitelist(methods=["POST"])
def react(message_id: str, reaction: str, is_custom: bool = False, emoji_name: str = None):
	"""
	API to react/unreact to a message.
	Checks if the user can react to the message
	First checks if the user has already reacted to the message.
	If yes, then unreacts (deletes), else reacts (creates).
	"""

	if not frappe.has_permission("Raven Message", doc=message_id, ptype="read"):
		frappe.throw(_("You do not have permission to react to this message"), frappe.PermissionError)

	channel_id = frappe.get_cached_value("Raven Message", message_id, "channel_id")

	if is_custom:
		# The reaction is a custom emoji with a URL
		reaction_escaped = emoji_name
	else:
		reaction_escaped = reaction.encode("unicode-escape").decode("utf-8").replace("\\u", "")
	user = frappe.session.user

	try:
		# Try to insert the reaction first
		frappe.get_doc(
			{
				"doctype": "Raven Message Reaction",
				"reaction": reaction,
				"message": message_id,
				"channel_id": channel_id,
				"owner": user,
				"is_custom": is_custom,
				"reaction_escaped": reaction_escaped,
			}
		).insert(ignore_permissions=True)

		return "Ok"

	except frappe.exceptions.UniqueValidationError:
		# If the reaction already exists, delete it
		frappe.db.delete(
			"Raven Message Reaction",
			filters={"message": message_id, "owner": user, "reaction_escaped": reaction_escaped},
		)

		# frappe.db.delete is a raw SQL delete — it runs NO document hooks, so
		# RavenMessageReaction.after_delete never fires on this path and the
		# message owner's client was never told to update its notification
		# badge (the count stuck until the next focus/reconnect reconcile).
		# Publish the same event here. `removed`: the client can't know locally
		# whether the message still has OTHER unread reactions, so it refetches
		# its unread set instead of blindly deleting the id.
		message_owner = frappe.get_cached_value("Raven Message", message_id, "owner")
		if message_owner and message_owner != user:
			frappe.publish_realtime(
				"raven_reaction_notification",
				{"message_id": message_id, "removed": True},
				user=message_owner,
				after_commit=True,
			)

		# Hook to trigger when delete reaction
		for fn in frappe.get_hooks("raven_message_reaction_after_delete"):
			frappe.get_attr(fn)(message_id)

		calculate_message_reaction(message_id, channel_id)

		return "Ok"
	except Exception as e:
		frappe.throw(_("Error reacting to message {0}").format(str(e)))


def calculate_message_reaction(message_id, channel_id: str = None, do_not_publish: bool = False):

	reactions = frappe.get_all(
		"Raven Message Reaction",
		fields=["owner", "reaction", "is_custom", "reaction_escaped"],
		filters={"message": message_id},
		order_by="creation",
	)

	total_reactions = {}

	for reaction_item in reactions:
		item_key = reaction_item.reaction_escaped if reaction_item.is_custom else reaction_item.reaction
		if item_key in total_reactions:
			existing_reaction = total_reactions[item_key]
			new_users = set(existing_reaction.get("users"))
			new_users.add(reaction_item.owner)
			total_reactions[item_key] = {
				"count": len(new_users),
				"users": list(new_users),
				"reaction": reaction_item.reaction,
				"is_custom": reaction_item.is_custom,
			}

		else:
			total_reactions[item_key] = {
				"count": 1,
				"users": [reaction_item.owner],
				"reaction": reaction_item.reaction,
				"is_custom": reaction_item.is_custom,
			}
	frappe.db.set_value(
		"Raven Message",
		message_id,
		"message_reactions",
		json.dumps(total_reactions, indent=4),
		update_modified=False,
	)

	if do_not_publish:
		return

	frappe.publish_realtime(
		"message_reacted",
		{
			"channel_id": channel_id,
			"sender": frappe.session.user,
			"message_id": message_id,
			"reactions": json.dumps(total_reactions),
		},
		doctype="Raven Channel",
		docname=channel_id,  # Adding this to automatically add the room for the event via Frappe
		after_commit=False,
	)
