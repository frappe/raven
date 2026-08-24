import frappe
from frappe import _


def publish_poll_update(poll_id: str):
	"""
	Notify the poll's CHANNEL that the poll changed (a vote, a retraction, a close), so
	clients revalidate it.

	Published to the channel's document room — which v3 clients are ALREADY subscribed to
	for messages — instead of the poll's own document room. This avoids a per-poll document
	subscription (v2 subscribed to every visible Raven Poll, which didn't scale); the event
	rides the existing channel subscription. Payload carries the message id so the client can
	mutate exactly that poll's get_poll cache.
	"""
	msg = frappe.db.get_value(
		"Raven Message", {"poll_id": poll_id}, ["name", "channel_id"], as_dict=True
	)
	if not msg:
		return
	frappe.publish_realtime(
		"poll_update",
		{"poll_id": poll_id, "message_id": msg.name, "channel_id": msg.channel_id},
		doctype="Raven Channel",
		docname=msg.channel_id,
		after_commit=True,
	)


@frappe.whitelist(methods=["POST"])
def create_poll(
	channel_id: str,
	question: str,
	options: list,
	is_multi_choice: bool = None,
	is_anonymous: bool = None,
	end_date: str = None,
	max_choices: int = None,
) -> str:
	"""
	Create a new poll in the Raven Poll doctype.
	"""
	# Check if the current user has access to the channel to create a poll.
	if not frappe.has_permission(doctype="Raven Channel", doc=channel_id, ptype="read"):
		frappe.throw(_("You do not have permission to access this channel"), frappe.PermissionError)

	poll = frappe.get_doc(
		{
			"doctype": "Raven Poll",
			"question": question,
			"is_multi_choice": is_multi_choice,
			"is_anonymous": is_anonymous,
			"end_date": end_date,
			"channel_id": channel_id,
			"max_choices": max_choices,
		}
	)

	for option in options:
		poll.append("options", option)

	poll.insert()

	# Poll message content is the poll question and options separated by a newline. (This would help with the searchability of the poll)
	poll_message_content = f"{question}\n"

	for index, option in enumerate(options):
		poll_message_content += f"{index + 1}. {option['option']}\n"

	# Send a message to the channel with type "poll" and the poll_id.
	message = frappe.get_doc(
		{
			"doctype": "Raven Message",
			"channel_id": channel_id,
			"text": "",
			"content": poll_message_content,
			"message_type": "Poll",
			"poll_id": poll.name,
		}
	)
	message.insert()

	return poll.name


@frappe.whitelist()
def get_poll(message_id: str):
	"""
	Get the poll data from the Raven Poll doctype.
	(Including the poll options, the number of votes for each option and the total number of votes.)
	"""

	# Check if the current user has access to the message.
	if not frappe.has_permission(doctype="Raven Message", doc=message_id, ptype="read"):
		frappe.throw(_("You do not have permission to access this message"), frappe.PermissionError)

	poll_id = frappe.get_cached_value("Raven Message", message_id, "poll_id")

	poll = frappe.get_cached_doc("Raven Poll", poll_id)

	# Check if the current user has already voted in the poll, if so, return the poll with the user's vote from the child table vote_selection.
	raven_poll_vote_selection = frappe.qb.DocType("Raven Poll Vote Selection")
	raven_poll_vote = frappe.qb.DocType("Raven Poll Vote")

	current_user_votes = (
		frappe.qb.from_(raven_poll_vote_selection)
		.join(raven_poll_vote)
		.on(raven_poll_vote_selection.parent == raven_poll_vote.name)
		.select(
			raven_poll_vote_selection.option,
			raven_poll_vote_selection.name,
		)
		.where(raven_poll_vote.poll_id == poll_id)
		.where(raven_poll_vote.user_id == frappe.session.user)
	).run(as_dict=True)

	# For a non-anonymous poll, include who voted for each option so the UI can show voter
	# avatars beside the options — folding in what v2's separate get_all_votes did. Only the
	# user ids; the client resolves them to names/avatars from its user store. Never for
	# anonymous polls — their voters must not be revealed.
	votes_by_option = {}
	if not poll.is_anonymous:
		all_votes = (
			frappe.qb.from_(raven_poll_vote_selection)
			.join(raven_poll_vote)
			.on(raven_poll_vote_selection.parent == raven_poll_vote.name)
			.select(raven_poll_vote_selection.option, raven_poll_vote.user_id)
			.where(raven_poll_vote.poll_id == poll_id)
		).run(as_dict=True)
		for vote in all_votes:
			votes_by_option.setdefault(vote.option, []).append(vote.user_id)

	return {"poll": poll, "current_user_votes": current_user_votes, "votes": votes_by_option}


@frappe.whitelist(methods=["POST"])
def add_vote(message_id: str, option_id: str | list):

	# Check if the current user has access to the message.
	if not frappe.has_permission(doctype="Raven Message", doc=message_id, ptype="read"):
		frappe.throw(_("You do not have permission to access this message"), frappe.PermissionError)

	poll_id = frappe.get_cached_value("Raven Message", message_id, "poll_id")
	is_poll_multi_choice = frappe.get_cached_value("Raven Poll", poll_id, "is_multi_choice")
	is_disabled = frappe.get_cached_value("Raven Poll", poll_id, "is_disabled")

	# Check if the poll is closed
	if is_disabled:
		frappe.throw(_("This poll is closed and no longer accepting votes"), frappe.PermissionError)

	# Normalize option_id to list (backward compatible)
	options = option_id if isinstance(option_id, list) else [option_id]

	# For single-select, ensure only one option
	if not is_poll_multi_choice and len(options) > 1:
		frappe.throw(_("This poll only allows one selection."))

	# Create ONE vote record with selections in child table
	vote = frappe.get_doc(
		{
			"doctype": "Raven Poll Vote",
			"poll_id": poll_id,
			"user_id": frappe.session.user,
			"vote_selection": [{"option": opt} for opt in options],
		}
	)
	vote.insert()

	publish_poll_update(poll_id)

	return "Vote added successfully."


@frappe.whitelist(methods=["POST"])
def retract_vote(poll_id: str):
	# delete all votes by the user for the poll (this takes care of the case where the user has voted for multiple options in the same poll)
	user = frappe.session.user

	# Check if the poll is closed
	is_disabled = frappe.get_cached_value("Raven Poll", poll_id, "is_disabled")
	if is_disabled:
		frappe.throw(
			_("This poll is closed and you can no longer retract your vote"), frappe.PermissionError
		)

	votes = frappe.get_all(
		"Raven Poll Vote", filters={"poll_id": poll_id, "user_id": user}, fields=["name"]
	)
	if not votes:
		frappe.throw(_("You have not voted for any option in this poll."))
	else:
		for vote in votes:
			frappe.delete_doc("Raven Poll Vote", vote.name, delete_permanently=True)

		publish_poll_update(poll_id)


@frappe.whitelist()
def get_all_votes(poll_id: str):

	# Check if the current user has access to the poll
	if not frappe.has_permission(doctype="Raven Poll", doc=poll_id, ptype="read"):
		frappe.throw(_("You do not have permission to access this poll"), frappe.PermissionError)

	poll_doc = frappe.get_cached_doc("Raven Poll", poll_id)

	if poll_doc.is_anonymous:
		frappe.throw(
			_("This poll is anonymous. You do not have permission to access the votes."),
			frappe.PermissionError,
		)
	else:
		# Get all votes for this poll from the child table vote_selection.
		raven_poll_vote_selection = frappe.qb.DocType("Raven Poll Vote Selection")
		raven_poll_vote = frappe.qb.DocType("Raven Poll Vote")

		votes = (
			frappe.qb.from_(raven_poll_vote_selection)
			.join(raven_poll_vote)
			.on(raven_poll_vote_selection.parent == raven_poll_vote.name)
			.select(
				raven_poll_vote_selection.option, raven_poll_vote_selection.name, raven_poll_vote.user_id
			)
			.where(raven_poll_vote.poll_id == poll_id)
		).run(as_dict=True)

		# Initialize results dictionary
		results = {
			option.name: {"users": [], "count": option.votes} for option in poll_doc.options if option.votes
		}

		# Process votes
		for vote in votes:
			option = vote["option"]
			results[option]["users"].append(vote["user_id"])

		# Calculate total votes (use unique voters, not sum of all votes)
		total_votes = poll_doc.total_votes or 0

		# Calculate percentages
		for result in results.values():
			if total_votes > 0:
				result["percentage"] = (result["count"] / total_votes) * 100
			else:
				result["percentage"] = 0

		return results


@frappe.whitelist(methods=["POST"])
def close_poll(poll_id: str):
	"""
	Close a poll by setting is_disabled to 1 (only poll owner can close the poll)
	"""
	poll_owner = frappe.get_cached_value("Raven Poll", poll_id, "owner")
	is_poll_closed = frappe.get_cached_value("Raven Poll", poll_id, "is_disabled")

	# Check if the current user is the owner of the poll
	if poll_owner != frappe.session.user:
		frappe.throw(_("Only the poll owner can close the poll"), frappe.PermissionError)

	# Check if the poll is already closed
	if is_poll_closed:
		frappe.throw(_("This poll is already closed"), frappe.PermissionError)

	# Close the poll
	frappe.db.set_value("Raven Poll", poll_id, "is_disabled", 1)

	# Notify the channel (not the poll doc) so clients revalidate — see publish_poll_update.
	publish_poll_update(poll_id)

	return "Poll closed successfully."
