# Copyright (c) 2024, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestRavenPoll(FrappeTestCase):
	# 1. Only the poll creator is allowed to view the poll in the Raven Poll list view.

	# 2. Only the poll creator is allowed to edit the poll.

	# 3. Only the poll creator is allowed to delete the poll.

	# 4. Only the poll creator is allowed to disable (close) the poll.

	# 5. All users who are part of the channel wherein the poll was created should be allowed to vote on the poll.

	# 6. If poll has option to allow multiple choices (is_multi_choice is checked), users should be allowed to vote on multiple options.
	# But each user should be allowed to vote only once on each option.

	# 7. If poll is not multi-choice, users should be allowed to vote only once.

	# 8. Users should not be able to edit or delete votes cast by other users/themselves but can view votes if the poll is not anonymous.

	# 9. If the poll is anonymous (is_anonymous is checked), all users including the poll creator should not be able to access Raven Poll
	# Vote list view for that poll.

	# 10. If poll is closed (is_disabled is checked), no more votes should be allowed.

	pass
