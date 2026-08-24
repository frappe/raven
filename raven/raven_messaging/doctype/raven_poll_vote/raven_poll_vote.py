# Copyright (c) 2024, The Commit Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.query_builder.functions import Count


class RavenPollVote(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from raven.raven_messaging.doctype.raven_poll_vote_selection.raven_poll_vote_selection import (
			RavenPollVoteSelection,
		)

		poll_id: DF.Link
		user_id: DF.Link
		vote_selection: DF.Table[RavenPollVoteSelection]
	# end: auto-generated types

	def validate(self):
		# Check if the user_id is the same as the logged in user
		if self.user_id != frappe.session.user:
			frappe.throw(_("You can only vote for yourself."))

		if not self.vote_selection:
			frappe.throw(_("Please select at least one option."))

		# Check user hasn't already voted (matches UNIQUE(poll_id, user_id))
		if frappe.db.exists("Raven Poll Vote", {"poll_id": self.poll_id, "user_id": self.user_id}):
			frappe.throw(_("You have already voted in this poll."))

		# check if the poll is still open
		poll = frappe.get_cached_doc("Raven Poll", self.poll_id)
		if poll.is_disabled:
			frappe.throw(_("This poll is closed."))

		# Single-select: only one option allowed
		if not poll.is_multi_choice and len(self.vote_selection) > 1:
			frappe.throw(_("This poll only allows one selection."))

		# check duplicate vote on application level with same option selection
		selected_options = [s.option for s in self.vote_selection]
		if len(selected_options) != len(set(selected_options)):
			frappe.throw(_("Cannot select the same option multiple times."))

		# Check if the poll is multi-select and the number of options selected is greater than the max choices
		if poll.is_multi_choice and poll.max_choices and len(selected_options) > poll.max_choices:
			frappe.throw(_(f"You cannot select more than {poll.max_choices} options for this poll."))

	def after_insert(self):
		update_poll_votes(self.poll_id)

	def after_delete(self):
		update_poll_votes(self.poll_id)


def update_poll_votes(poll_id):
	"""
	To update all the votes in a poll, instead of updating the document directly, just write to the child table to avoid setting the "modified" timestamp.
	"""
	poll = frappe.get_doc("Raven Poll", poll_id, for_update=True)
	# get votes for each option
	poll_vote = frappe.qb.DocType("Raven Poll Vote")
	poll_vote_selection = frappe.qb.DocType("Raven Poll Vote Selection")

	poll_votes = (
		frappe.qb.from_(poll_vote)
		.inner_join(poll_vote_selection)
		.on(poll_vote.name == poll_vote_selection.parent)
		.select(poll_vote_selection.option, Count(poll_vote.name).as_("votes"))
		.where(poll_vote.poll_id == poll_id)
		.groupby(poll_vote_selection.option)
		.run(as_dict=True)
	)

	vote_map = {v.option: v.votes for v in poll_votes}

	# Update each option
	for option in poll.options:
		option.votes = vote_map.get(option.name, 0)
		frappe.db.set_value(
			"Raven Poll Option", option.name, "votes", option.votes, update_modified=False
		)

	# Count total unique voters (each Raven Poll Vote = 1 voter)
	total_votes = frappe.db.count("Raven Poll Vote", filters={"poll_id": poll_id})

	frappe.db.set_value("Raven Poll", poll_id, "total_votes", total_votes, update_modified=False)
	poll.total_votes = total_votes

	poll.notify_update()


def on_doctype_update():
	"""
	Add unique constraint on (poll_id, user_id).
	Only runs during fresh install - existing installs use patch.
	"""
	if frappe.flags.in_install:
		frappe.db.add_unique(
			"Raven Poll Vote",
			fields=["poll_id", "user_id"],
			constraint_name="unique_poll_vote_user",
		)
