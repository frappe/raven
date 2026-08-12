import frappe
from frappe.tests.utils import FrappeTestCase


class TestChannelGroups(FrappeTestCase):
	def setUp(self):
		self.user_a = frappe.get_doc("Raven User", {"user": "Administrator"})

	def test_two_users_can_have_the_same_group_name(self):
		"""group_name is unique per user, not globally — the child table holds every user's rows."""
		user_b = frappe.get_all("Raven User", filters={"name": ("!=", self.user_a.name)}, limit=1)
		if not user_b:
			self.skipTest("needs a second Raven User")

		self.user_a.append("channel_groups", {"group_name": "Design"})
		self.user_a.save()

		other = frappe.get_doc("Raven User", user_b[0].name)
		other.append("channel_groups", {"group_name": "Design"})
		other.save()  # must not raise

		self.assertTrue(any(g.group_name == "Design" for g in other.channel_groups))

	def test_one_user_cannot_have_duplicate_group_names(self):
		self.user_a.append("channel_groups", {"group_name": "Eng"})
		self.user_a.append("channel_groups", {"group_name": "eng"})
		self.assertRaises(frappe.ValidationError, self.user_a.save)

	def test_favorites_is_a_reserved_group_name(self):
		"""Favorites is the pinned_channels pseudo-group — a real group with that name
		could never receive a channel (clients route it to the pin list) and would
		render nowhere. Case-insensitive, matching the duplicate check."""
		self.user_a.append("channel_groups", {"group_name": "favorites"})
		self.assertRaises(frappe.ValidationError, self.user_a.save)
