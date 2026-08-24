import frappe
from frappe.tests import IntegrationTestCase

from raven.api.raven_channel import create_direct_message_channel
from raven.api.threads import create_thread

EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestPermissions(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

	def setUp(self):

		# test is a Raven Admin, test1 and test 3 are Raven Users, test2 is neither

		user = frappe.get_doc("User", "test@example.com")
		user.add_roles("Raven Admin")
		user.add_roles("Raven User")

		user1 = frappe.get_doc("User", "test1@example.com")
		user1.add_roles("Raven User")
		user1.remove_roles("Raven Admin")

		user2 = frappe.get_doc("User", "test2@example.com")
		user2.remove_roles("Raven Admin")
		user2.remove_roles("Raven User")

		user3 = frappe.get_doc("User", "test3@example.com")
		user3.add_roles("Raven User")

	def tearDown(self):
		# Reset the user
		frappe.db.rollback()
		frappe.set_user("Administrator")
		frappe.clear_cache()

	def create_test_workspace(self, workspace_type="Public", only_admins_can_create_channels=False):
		test_workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": "Test Workspace",
				"type": workspace_type,
				"only_admins_can_create_channels": only_admins_can_create_channels,
			}
		)
		return test_workspace

	def create_test_channel(
		self, channel_type="Open", workspace_name="Test Workspace", channel_name="test-channel"
	):
		test_channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": channel_name,
				"type": channel_type,
				"workspace": workspace_name,
			}
		)
		return test_channel

	def create_test_message(self, channel_id):
		test_message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": channel_id,
				"message_type": "Text",
				"message": "Test Message",
			}
		)
		return test_message

	def test_workspace_create_permissions(self):

		# CREATE: Raven Admin can create a workspace, but other users cannot
		frappe.set_user("test@example.com")

		test_workspace = self.create_test_workspace()
		test_workspace.insert()
		self.assertEqual(test_workspace.name, "Test Workspace")

		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			test_workspace.insert()

		frappe.set_user("test2@example.com")
		with self.assertRaises(frappe.PermissionError):
			test_workspace.insert()

	def test_workspace_update_permissions(self):
		# UPDATE: Workspace admins can update/delete workspaces but not other users

		frappe.set_user("test@example.com")

		test_workspace = self.create_test_workspace()
		test_workspace.insert()

		test_workspace.reload()

		test_workspace.can_only_join_via_invite = 1
		test_workspace.save()

		self.assertEqual(test_workspace.can_only_join_via_invite, 1)

		frappe.set_user("test1@example.com")
		test_workspace.can_only_join_via_invite = 0
		with self.assertRaises(frappe.PermissionError):
			test_workspace.save()

		# Add test1 as a workspace member
		test_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"workspace": test_workspace.name,
				"user": "test1@example.com",
			}
		)
		test_workspace_member.insert(ignore_permissions=True)

		# Since test1 is now a member, but not an admin, they cannot update the workspace

		frappe.set_user("test1@example.com")
		test_workspace.can_only_join_via_invite = 0

		with self.assertRaises(frappe.PermissionError):
			test_workspace.save()

		# Now make test1 an admin
		frappe.set_user("test@example.com")
		test_workspace_member.is_admin = 1
		test_workspace_member.save(ignore_permissions=True)

		# test1 should now be able to update the workspace
		frappe.set_user("test1@example.com")
		test_workspace.can_only_join_via_invite = 0
		test_workspace.save()

		self.assertEqual(test_workspace.can_only_join_via_invite, 0)

	def test_workspace_read_permissions(self):
		# READ: Public workspaces are readable by all Raven Users, private workspaces are readable only by members

		frappe.set_user("test@example.com")
		test_workspace = self.create_test_workspace(workspace_type="Public")
		test_workspace.insert()

		self.assertEqual(test_workspace.name, "Test Workspace")

		frappe.set_user("test1@example.com")
		# test1 should be able to read the workspace
		self.assertTrue(frappe.has_permission(test_workspace, ptype="read"))

		# test2 should not be able to read the workspace
		frappe.set_user("test2@example.com")
		self.assertFalse(frappe.has_permission(test_workspace, ptype="read"))

		frappe.set_user("test@example.com")
		test_workspace.type = "Private"
		test_workspace.save()

		# Test1 is not a member of the private workspace, so they cannot read it
		frappe.set_user("test1@example.com")
		self.assertFalse(frappe.has_permission(test_workspace, ptype="read"))

		# Make test1 a member of the private workspace
		test_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"workspace": test_workspace.name,
				"user": "test1@example.com",
			}
		)
		test_workspace_member.insert(ignore_permissions=True)

		self.assertTrue(frappe.has_permission(test_workspace, ptype="read"))

		# Test2 is not a Raven User, so they cannot read the workspace
		frappe.set_user("test2@example.com")
		self.assertFalse(frappe.has_permission(test_workspace, ptype="read"))

	def test_workspace_member_create_permissions(self):
		"""
		If it's a public workspace, any Raven User can join the workspace

		If it's a private workspace, only workspace admins can add members
		"""

		frappe.set_user("test@example.com")
		test_workspace = self.create_test_workspace(workspace_type="Public")
		test_workspace.insert()

		# TESTS for a public workspace
		# Test user is an admin of the workspace

		# It's a public workspace, so any Raven User can join the workspace
		# Test1 should be able to join the workspace
		frappe.set_user("test1@example.com")

		test1_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test1@example.com",
				"workspace": test_workspace.name,
			}
		)
		test1_workspace_member.insert()

		self.assertEqual("test1@example.com", test1_workspace_member.user)

		# But test1 cannot add another user to the workspace. Only test3 can join the workspace on their own.
		test3_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test3@example.com",
				"workspace": test_workspace.name,
			}
		)
		with self.assertRaises(frappe.PermissionError):
			test3_workspace_member.insert()

		# A workspace admin can add a member to the workspace
		frappe.set_user("test@example.com")
		test3_workspace_member.insert()

		self.assertEqual("test3@example.com", test3_workspace_member.user)

		test3_workspace_member.delete()

		# Test2 should not be able to join the workspace since it's not a Raven User
		frappe.set_user("test2@example.com")
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc(
				{
					"doctype": "Raven Workspace Member",
					"user": "test2@example.com",
					"workspace": test_workspace.name,
				}
			).insert()

		# Test Workspace should have 2 members
		self.assertEqual(
			2, frappe.db.count("Raven Workspace Member", {"workspace": test_workspace.name})
		)

		frappe.set_user("test@example.com")
		# Delete the workspace member
		test1_workspace_member.delete()

		# TESTS for a private workspace

		# Now convert the workspace to private
		test_workspace.type = "Private"
		test_workspace.save()

		# Test1 should not be able to join the workspace
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc(
				{
					"doctype": "Raven Workspace Member",
					"user": "test1@example.com",
					"workspace": test_workspace.name,
				}
			).insert()

		# Test2 should not be able to join the workspace
		frappe.set_user("test2@example.com")
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc(
				{
					"doctype": "Raven Workspace Member",
					"user": "test2@example.com",
					"workspace": test_workspace.name,
				}
			).insert()

		# Test 1 as an admin should be able to add a member to the workspace
		frappe.set_user("test@example.com")
		test1_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test1@example.com",
				"workspace": test_workspace.name,
			}
		)
		test1_workspace_member.insert()

		self.assertEqual("test1@example.com", test1_workspace_member.user)

		# test1 is not an admin, so they cannot add a member to the workspace
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc(
				{
					"doctype": "Raven Workspace Member",
					"user": "test3@example.com",
					"workspace": test_workspace.name,
				}
			).insert()

		# Make test1 an admin and they should be able to add a member to the workspace
		test1_workspace_member.is_admin = 1
		test1_workspace_member.save(ignore_permissions=True)

		test3_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test3@example.com",
				"workspace": test_workspace.name,
			}
		)

		test3_workspace_member.insert()

		self.assertEqual("test3@example.com", test3_workspace_member.user)

		self.assertEqual(
			3, frappe.db.count("Raven Workspace Member", {"workspace": test_workspace.name})
		)

	def test_workspace_member_update_permissions(self):
		"""
		Workspace members can be updated by admins only since it contains the "is_admin" field
		"""

		frappe.set_user("test@example.com")
		test_workspace = self.create_test_workspace(workspace_type="Private")
		test_workspace.insert()

		test1_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test1@example.com",
				"workspace": test_workspace.name,
			}
		)
		test1_workspace_member.insert()

		# Test1 is not an admin, so they cannot update the workspace member
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			test1_workspace_member.is_admin = 1
			test1_workspace_member.save()

		# Test3 is not a member of the workspace, so they cannot update the workspace member
		frappe.set_user("test3@example.com")
		with self.assertRaises(frappe.PermissionError):
			test1_workspace_member.is_admin = 1
			test1_workspace_member.save()

		# Test@example.com is an admin, so they can update the workspace member
		frappe.set_user("test@example.com")
		test1_workspace_member.is_admin = 1
		test1_workspace_member.save()

	def test_workspace_member_delete_permissions(self):
		"""
		Workspace members can be deleted either by admins or by the user themselves
		"""

		frappe.set_user("test@example.com")
		test_workspace = self.create_test_workspace(workspace_type="Private")
		test_workspace.insert()

		test1_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test1@example.com",
				"workspace": test_workspace.name,
			}
		)
		test1_workspace_member.insert()

		test3_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test3@example.com",
				"workspace": test_workspace.name,
			}
		)
		test3_workspace_member.insert()

		# Test1 is not an admin, so they cannot delete other workspace members
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			test3_workspace_member.delete()

		# Test@example.com is an admin, so they can delete the workspace member
		frappe.set_user("test@example.com")
		test3_workspace_member.delete()

		self.assertEqual(
			2, frappe.db.count("Raven Workspace Member", {"workspace": test_workspace.name})
		)

		# Test1 should be able to delete themselves
		frappe.set_user("test1@example.com")
		test1_workspace_member.delete()

		self.assertEqual(
			1, frappe.db.count("Raven Workspace Member", {"workspace": test_workspace.name})
		)

	def test_workspace_member_read_permissions(self):
		"""
		Workspace members can be read by all members of the workspace
		"""

		frappe.set_user("test@example.com")
		test_workspace = self.create_test_workspace(workspace_type="Private")
		test_workspace.insert()

		test1_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test1@example.com",
				"workspace": test_workspace.name,
			}
		)
		test1_workspace_member.insert()

		test3_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test3@example.com",
				"workspace": test_workspace.name,
			}
		)
		test3_workspace_member.insert()

		# Test1 should be able to read the workspace member
		frappe.set_user("test1@example.com")
		self.assertTrue(frappe.has_permission(test3_workspace_member, ptype="read"))

		# Delete test3
		test3_workspace_member.delete(ignore_permissions=True)

		# Test 3 should not be able to read the workspace member
		frappe.set_user("test3@example.com")
		self.assertFalse(frappe.has_permission(test1_workspace_member, ptype="read"))

	def test_channel_create_permissions(self):
		"""
		Channels can be created by admins of a workspace

		DM channels can be created by any Raven User

		Threads can be created by any member of a channel
		"""

		# Regular channels

		frappe.set_user("test@example.com")

		test_workspace = self.create_test_workspace(
			workspace_type="Public", only_admins_can_create_channels=True
		)
		test_workspace.insert()

		# Test user should be able to create a channel since they are an admin of the workspace
		test_channel = self.create_test_channel(workspace_name=test_workspace.name)
		test_channel.insert()

		self.assertEqual(test_channel.name, f"{test_workspace.name}-test-channel")

		test_channel.delete()

		# Test1 should not be able to create a channel since they are not a member of the workspace
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			test_channel.insert()

		# Add test1 as a workspace member
		test1_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test1@example.com",
				"workspace": test_workspace.name,
			}
		)
		test1_workspace_member.insert(ignore_permissions=True)

		# Test1 should not be able to create a channel in the workspace since they are not an admin
		with self.assertRaises(frappe.PermissionError):
			test_channel.insert()

		# Make test1 an admin
		test1_workspace_member.is_admin = 1
		test1_workspace_member.save(ignore_permissions=True)

		# Test1 should now be able to create a channel in the workspace
		test_channel.insert()

		self.assertEqual(test_channel.name, f"{test_workspace.name}-test-channel")

		test_channel.delete()

		# Make test1 not an admin of the workspace
		test1_workspace_member.is_admin = 0
		test1_workspace_member.save(ignore_permissions=True)

		# Allow any workspace member to create a channel
		test_workspace.only_admins_can_create_channels = 0
		test_workspace.save(ignore_permissions=True)

		# Test1 should now be able to create a channel in the workspace
		test_channel.insert()

		self.assertEqual(test_channel.name, f"{test_workspace.name}-test-channel")

		test_channel.delete()

		# Direct Message Channels

		# test1 should be able to create a direct message channel with test3 since both are Raven Users
		dm_t1_t3 = create_direct_message_channel(user_id="test3@example.com")

		# test2 should not be able to create a direct message channel with test3 since test2 is not a Raven User
		frappe.set_user("test2@example.com")
		with self.assertRaises(frappe.PermissionError):
			create_direct_message_channel(user_id="test3@example.com")

		# Threads

		frappe.set_user("test@example.com")

		test_channel = self.create_test_channel(workspace_name=test_workspace.name)
		test_channel.insert()

		# Test is now an admin of the channel as well as the workspace

		# Add test1 as a member of the channel (not admin)
		test1_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": test_channel.name,
				"user_id": "test1@example.com",
			}
		)
		test1_channel_member.insert(ignore_permissions=True)

		# Create a test message in the test channel
		test_message = self.create_test_message(channel_id=test_channel.name)
		test_message.insert()

		# Test and Test1 should be able to create a thread from this message since they are members of the channel.
		# Test is an admin of the workspace and channel, and Test1 is just a member of the workspace and channel.
		thread1 = create_thread(message_id=test_message.name)

		self.assertEqual(thread1["channel_id"], test_channel.name)
		self.assertEqual(thread1["thread_id"], test_message.name)

		test_message.delete()

		# Create a new message in the channel
		test_message = self.create_test_message(channel_id=test_channel.name)
		test_message.insert()

		# Test1 should be able to create a thread from this message even though they did not create the message, but they are a member of the channel
		frappe.set_user("test1@example.com")
		thread2 = create_thread(message_id=test_message.name)

		self.assertEqual(thread2["channel_id"], test_channel.name)
		self.assertEqual(thread2["thread_id"], test_message.name)

		frappe.set_user("test@example.com")
		test_message.delete()

		# Remove test1 as a member of the channel - we need to clear the cache now
		test1_channel_member.delete()
		frappe.clear_cache()

		# only test@example.com is a member of the channel now
		self.assertEqual(1, frappe.db.count("Raven Channel Member", {"channel_id": test_channel.name}))

		# Message created by test@example.com
		test_message = self.create_test_message(channel_id=test_channel.name)
		test_message.insert()

		# Now test1 should not be able to create a thread from a message sent in a channel they are not a member of
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			create_thread(message_id=test_message.name)

	def test_channel_delete_permissions(self):
		"""
		Only admins of a channel can delete a channel.
		DM channels cannot be deleted.
		Threads cannot be deleted directly. They are deleted when the message they are tied to is deleted.
		"""

		# Test is an admin of the workspace and channel

		frappe.set_user("test@example.com")
		test_workspace = self.create_test_workspace(workspace_type="Public")
		test_workspace.insert()

		# Add test1 as a member of the workspace
		test1_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test1@example.com",
				"workspace": test_workspace.name,
			}
		)
		test1_workspace_member.insert(ignore_permissions=True)

		test_channel = self.create_test_channel(workspace_name=test_workspace.name)
		test_channel.insert()

		# Test@example.com is an admin of the workspace and channel, so they can delete the channel
		test_channel.delete()

		self.assertFalse(frappe.db.exists("Raven Channel", test_channel.name))

		test_channel = self.create_test_channel(workspace_name=test_workspace.name)
		test_channel.insert()

		# Add test1 as a member of the channel
		test1_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": test_channel.name,
				"user_id": "test1@example.com",
			}
		)
		test1_channel_member.insert(ignore_permissions=True)
		# Test1 should not be able to delete the channel since they are not an admin - just a member
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			test_channel.delete()

		# Make test1 an admin of the channel
		test1_channel_member.is_admin = 1
		test1_channel_member.save(ignore_permissions=True)

		# Test1 should now be able to delete the channel
		test_channel.delete()

		self.assertFalse(frappe.db.exists("Raven Channel", test_channel.name))

		# Create a DM channel
		dm_t1_t3 = create_direct_message_channel(user_id="test3@example.com")

		# No one should be able to delete a DM channel
		frappe.set_user("test@example.com")
		with self.assertRaises(frappe.PermissionError):
			frappe.delete_doc("Raven Channel", dm_t1_t3)

		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			frappe.delete_doc("Raven Channel", dm_t1_t3)

		frappe.set_user("test3@example.com")
		with self.assertRaises(frappe.PermissionError):
			frappe.delete_doc("Raven Channel", dm_t1_t3)

		# Threads can not be deleted directly. They are deleted when the message is deleted.
		# Create a new channel
		frappe.set_user("test@example.com")
		test_channel = self.create_test_channel(workspace_name=test_workspace.name)
		test_channel.insert()

		# Create a new message in the channel
		test_message = self.create_test_message(channel_id=test_channel.name)
		test_message.insert()

		# Create a thread from the message
		thread = create_thread(message_id=test_message.name)

		frappe.set_user("test1@example.com")

		# Test1 should not be able to delete the thread channel
		with self.assertRaises(frappe.PermissionError):
			frappe.delete_doc("Raven Channel", test_message.name)

		frappe.set_user("test@example.com")

		# Test should be able to delete the thread channel
		frappe.delete_doc("Raven Channel", test_message.name)
		# The thread channel should be deleted automatically
		self.assertFalse(frappe.db.exists("Raven Channel", test_message.name))

		# Create a thread again for the same message
		thread = create_thread(message_id=test_message.name)

		# Delete the message
		test_message.delete()

		# The thread channel should be deleted automatically
		self.assertFalse(frappe.db.exists("Raven Channel", test_message.name))

	def test_channel_update_permissions(self):
		"""
		Only admins of a channel can update a channel.

		Updates to a channel could be the name, description, type etc.
		"""

		frappe.set_user("test@example.com")

		test_workspace = self.create_test_workspace(workspace_type="Public")
		test_workspace.insert()

		test_channel = self.create_test_channel(workspace_name=test_workspace.name)
		test_channel.insert()

		# Test@example.com is an admin of the channel, so they can update the channel
		test_channel.channel_name = "updated-channel-name"
		test_channel.save()

		self.assertEqual(test_channel.channel_name, "updated-channel-name")

		# Test1 should not be able to update the channel since they are not a member of the channel
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			test_channel.channel_name = "updated-channel-name-new"
			test_channel.save()

		# Add test1 as a member of the channel
		test1_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": test_channel.name,
				"user_id": "test1@example.com",
			}
		).insert(ignore_permissions=True)

		# Test1 should not be able to update the channel since they are not an admin
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			test_channel.channel_name = "updated-channel-name-new"
			test_channel.save()

		# Make test1 an admin of the channel
		test1_channel_member.is_admin = 1
		test1_channel_member.save(ignore_permissions=True)

		# Test1 should now be able to update the channel
		test_channel.channel_name = "updated-channel-name-new"
		test_channel.save()

		self.assertEqual(test_channel.channel_name, "updated-channel-name-new")

	def test_channel_read_permissions(self):
		"""
		If the channel is public or open, a workspace member can read the channel.
		If the channel is private, only members of the channel can read the channel.
		"""

		frappe.set_user("test@example.com")
		test_workspace = self.create_test_workspace(workspace_type="Public")
		test_workspace.insert()

		# Test is a member of the workspace.
		# Add test1 as a member of the workspace
		test1_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test1@example.com",
				"workspace": test_workspace.name,
			}
		)
		test1_workspace_member.insert(ignore_permissions=True)

		# Create a public channel
		public_channel = self.create_test_channel(
			workspace_name=test_workspace.name, channel_type="Public", channel_name="public-channel"
		)
		public_channel.insert()

		# Create a private channel
		private_channel = self.create_test_channel(
			workspace_name=test_workspace.name, channel_type="Private", channel_name="private-channel"
		)
		private_channel.insert()

		# Create an open channel
		open_channel = self.create_test_channel(
			workspace_name=test_workspace.name, channel_type="Open", channel_name="open-channel"
		)
		open_channel.insert()

		frappe.clear_cache()

		# Test and Test1 should be able to read the open and public channels since they are members of the workspace.
		# Test3 should not be able to read any channel since they are not a member of the workspace.

		self.assertTrue(frappe.has_permission("Raven Channel", doc=public_channel.name))
		self.assertTrue(frappe.has_permission("Raven Channel", doc=open_channel.name))

		frappe.set_user("test1@example.com")
		self.assertTrue(frappe.has_permission("Raven Channel", doc=public_channel.name))
		self.assertTrue(frappe.has_permission("Raven Channel", doc=open_channel.name))

		frappe.set_user("test3@example.com")
		self.assertFalse(frappe.has_permission("Raven Channel", doc=public_channel.name))
		self.assertFalse(frappe.has_permission("Raven Channel", doc=open_channel.name))

		# Test should be able to read the private channel, test1 and test3 should not be able to read the private channel
		frappe.set_user("test@example.com")
		self.assertTrue(frappe.has_permission("Raven Channel", doc=private_channel.name))

		frappe.set_user("test1@example.com")
		self.assertFalse(frappe.has_permission("Raven Channel", doc=private_channel.name))

		frappe.set_user("test3@example.com")
		self.assertFalse(frappe.has_permission("Raven Channel", doc=private_channel.name))

		# Add test1 as a member of the private channel
		test1_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": private_channel.name,
				"user_id": "test1@example.com",
			}
		).insert(ignore_permissions=True)

		frappe.set_user("test1@example.com")
		self.assertTrue(frappe.has_permission("Raven Channel", doc=private_channel.name))

		test1_channel_member.delete()

		frappe.clear_cache()

		# Create a thread in the private channel
		frappe.set_user("test@example.com")
		test_message = self.create_test_message(channel_id=private_channel.name)
		test_message.insert()

		thread = create_thread(message_id=test_message.name)

		# Test should be able to read the thread since they are a member of the channel
		self.assertTrue(frappe.has_permission("Raven Channel", doc=test_message.name))

		# Test1 should not be able to read the thread since they are not a member of the channel
		frappe.set_user("test1@example.com")
		self.assertFalse(frappe.has_permission("Raven Channel", doc=test_message.name))

		# Add test1 as a member of the private channel
		test1_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": private_channel.name,
				"user_id": "test1@example.com",
			}
		).insert(ignore_permissions=True)

		frappe.clear_cache()
		# Now test1 should be able to read the thread
		self.assertTrue(frappe.has_permission("Raven Channel", doc=test_message.name))

		# Test3 should not be able to read the thread since they are not a member of the channel
		frappe.set_user("test3@example.com")
		self.assertFalse(frappe.has_permission("Raven Channel", doc=test_message.name))

	def test_channel_member_permissions(self):
		"""
		Workspace members can join open and public channels in the workspace.
		Non-workspace members cannot join any channels in a workspace.

		An existing channel member can add another user to a private channel provided they are also a member of the workspace.

		Channel members can modify their own channel member document, but they cannot make themselves admins of a channel.

		Only admins of a channel can delete the channel or add/remove admins from the channel.
		"""

		frappe.set_user("test@example.com")
		test_workspace = self.create_test_workspace(workspace_type="Public")
		test_workspace.insert()

		# Add test1 as a member of the workspace
		test1_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test1@example.com",
				"workspace": test_workspace.name,
			}
		).insert(ignore_permissions=True)

		# Test3 will not be a member of this workspace.

		open_channel = self.create_test_channel(
			workspace_name=test_workspace.name, channel_type="Open", channel_name="open-channel"
		)
		open_channel.insert()

		public_channel = self.create_test_channel(
			workspace_name=test_workspace.name, channel_type="Public", channel_name="public-channel"
		)
		public_channel.insert()

		private_channel = self.create_test_channel(
			workspace_name=test_workspace.name, channel_type="Private", channel_name="private-channel"
		)
		private_channel.insert()

		# Test1 should be able to join the open and public channels

		frappe.set_user("test1@example.com")
		# Create a channel member document for test1 in the open channel
		test1_open_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": open_channel.name,
				"user_id": "test1@example.com",
			}
		).insert()

		test1_public_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": public_channel.name,
				"user_id": "test1@example.com",
			}
		).insert()

		self.assertTrue(
			frappe.db.exists(
				"Raven Channel Member", {"channel_id": open_channel.name, "user_id": "test1@example.com"}
			)
		)
		self.assertTrue(
			frappe.db.exists(
				"Raven Channel Member", {"channel_id": public_channel.name, "user_id": "test1@example.com"}
			)
		)

		# But test1 cannot join the private channel
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc(
				{
					"doctype": "Raven Channel Member",
					"channel_id": private_channel.name,
					"user_id": "test1@example.com",
				}
			).insert()

		# Test3 cannot join any channel in the workspace
		frappe.set_user("test3@example.com")
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc(
				{
					"doctype": "Raven Channel Member",
					"channel_id": open_channel.name,
					"user_id": "test3@example.com",
				}
			).insert()

		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc(
				{
					"doctype": "Raven Channel Member",
					"channel_id": private_channel.name,
					"user_id": "test3@example.com",
				}
			).insert()

		# Test can add test1 to the private channel
		frappe.set_user("test@example.com")
		test1_private_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": private_channel.name,
				"user_id": "test1@example.com",
			}
		).insert()

		self.assertTrue(
			frappe.db.exists(
				"Raven Channel Member", {"channel_id": private_channel.name, "user_id": "test1@example.com"}
			)
		)

		# Test cannot add test3 to any channel since test3 is not a member of the workspace
		frappe.set_user("test@example.com")
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc(
				{
					"doctype": "Raven Channel Member",
					"channel_id": private_channel.name,
					"user_id": "test3@example.com",
				}
			).insert()

		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc(
				{
					"doctype": "Raven Channel Member",
					"channel_id": open_channel.name,
					"user_id": "test3@example.com",
				}
			).insert()

		# Write permissions

		frappe.clear_cache()

		# Test1 cannot make themselves an admin of any channel
		frappe.set_user("test1@example.com")
		with self.assertRaises(frappe.PermissionError):
			test1_open_channel_member.is_admin = 1
			test1_open_channel_member.save()

		with self.assertRaises(frappe.PermissionError):
			test1_public_channel_member.is_admin = 1
			test1_public_channel_member.save()

		with self.assertRaises(frappe.PermissionError):
			test1_private_channel_member.is_admin = 1
			test1_private_channel_member.save()

		# Test1 can update their own channel member document. This would include changing notification preferences
		self.assertTrue(
			frappe.has_permission("Raven Channel Member", doc=test1_open_channel_member.name, ptype="write")
		)
		self.assertTrue(
			frappe.has_permission(
				"Raven Channel Member", doc=test1_public_channel_member.name, ptype="write"
			)
		)
		self.assertTrue(
			frappe.has_permission(
				"Raven Channel Member", doc=test1_private_channel_member.name, ptype="write"
			)
		)

		# Test can make test1 an admin of channels it is an admin of
		frappe.set_user("test@example.com")
		test1_open_channel_member.reload()
		test1_open_channel_member.is_admin = 1
		test1_open_channel_member.save()

		test1_private_channel_member.reload()
		test1_private_channel_member.is_admin = 1
		test1_private_channel_member.save()

		self.assertTrue(
			frappe.db.get_value("Raven Channel Member", test1_open_channel_member.name, "is_admin")
		)
		self.assertTrue(
			frappe.db.get_value("Raven Channel Member", test1_private_channel_member.name, "is_admin")
		)

		# Remove test1 as an admin of the private channel
		test1_private_channel_member.is_admin = 0
		test1_private_channel_member.save()

		self.assertFalse(
			frappe.db.get_value("Raven Channel Member", test1_private_channel_member.name, "is_admin")
		)

		# Deletion checks
		# Users can delete their own channel member document
		# Admins can delete any channel member
		# Non-admins cannot delete other channel members

		frappe.set_user("test@example.com")

		# Add test3 as a workspace member
		test3_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test3@example.com",
				"workspace": test_workspace.name,
			}
		).insert()

		# Add test3 as a member of the open channel
		test3_open_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": open_channel.name,
				"user_id": "test3@example.com",
			}
		).insert()

		# Add test3 as a member of the private channel
		test3_private_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": private_channel.name,
				"user_id": "test3@example.com",
			}
		).insert()

		frappe.clear_cache()

		frappe.set_user("test1@example.com")

		# Test1 can delete test3 from the channel since it's an admin
		test3_open_channel_member.delete()

		# Test1 cannot delete test3 from the channel since it's not an admin
		with self.assertRaises(frappe.PermissionError):
			test3_private_channel_member.delete()

		# Test1 cannot make Test3 an admin of the channel
		with self.assertRaises(frappe.PermissionError):
			test3_private_channel_member.is_admin = 1
			test3_private_channel_member.save()

		# Test1 can delete their own channel member document
		test1_open_channel_member.delete()
		test1_public_channel_member.delete()
		test1_private_channel_member.delete()

		frappe.set_user("test3@example.com")

		# Test3 can delete their own channel member document
		test3_open_channel_member.delete()
		test3_private_channel_member.delete()

		# Threads
		frappe.set_user("test@example.com")
		test_message = self.create_test_message(channel_id=private_channel.name)
		test_message.insert()

		# Add test1 as a member of the private channel
		test1_private_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": private_channel.name,
				"user_id": "test1@example.com",
			}
		).insert()

		thread = create_thread(message_id=test_message.name)

		frappe.set_user("test1@example.com")
		self.assertTrue(frappe.has_permission("Raven Channel", doc=thread["thread_id"], ptype="read"))

		# Test1 can join the thread channel
		test1_thread_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": thread["thread_id"],
				"user_id": "test1@example.com",
			}
		).insert()

	def test_message_permissions(self):
		"""
		A user can send messages to a channel if they are a member of the channel.

		A user cannot create, write, or delete a message if they are not the owner of the message.
		"""

		frappe.set_user("test@example.com")
		test_workspace = self.create_test_workspace(workspace_type="Private")
		test_workspace.insert()

		# Add test1 as a member of the workspace
		test1_workspace_member = frappe.get_doc(
			{
				"doctype": "Raven Workspace Member",
				"user": "test1@example.com",
				"workspace": test_workspace.name,
			}
		).insert()

		open_channel = self.create_test_channel(
			workspace_name=test_workspace.name, channel_type="Open", channel_name="open-channel"
		)
		open_channel.insert()

		test_message = self.create_test_message(channel_id=open_channel.name)
		test_message.insert()

		# Test can read the message since they are a member of the channel
		self.assertTrue(frappe.has_permission("Raven Message", doc=test_message.name, ptype="read"))

		# test can update or delete the message since they are the owner of the message and a member of the channel.
		test_message.message = "Edited message"
		test_message.save()

		self.assertEqual(test_message.message, "Edited message")

		test_message.delete()

		self.assertFalse(frappe.db.exists("Raven Message", test_message.name))

		# Create test message again
		test_message = self.create_test_message(channel_id=open_channel.name)
		test_message.insert()

		frappe.set_user("test1@example.com")

		# Test1 cannot create a message since they are not a member of the channel
		with self.assertRaises(frappe.PermissionError):
			self.create_test_message(channel_id=open_channel.name).insert()

		frappe.set_user("test@example.com")
		# Add test1 as a member of the channel
		test1_channel_member = frappe.get_doc(
			{
				"doctype": "Raven Channel Member",
				"channel_id": open_channel.name,
				"user_id": "test1@example.com",
			}
		).insert()

		frappe.clear_cache()

		frappe.set_user("test1@example.com")

		# Test1 can now send a message to the channel
		test1_message = self.create_test_message(channel_id=open_channel.name)
		test1_message.insert()

		# Test1 can update and delete their own message
		test1_message.message = "Edited message"
		test1_message.save()

		self.assertEqual(test1_message.message, "Edited message")

		test1_message.delete()

		self.assertFalse(frappe.db.exists("Raven Message", test1_message.name))

		# Add test1 message again
		test1_message = self.create_test_message(channel_id=open_channel.name)
		test1_message.insert()

		# Test1 cannot update or delete test's message
		with self.assertRaises(frappe.PermissionError):
			test_message.message = "Edited message"
			test_message.save()

		with self.assertRaises(frappe.PermissionError):
			test_message.delete()

		# If test1 is removed from the channel, they cannot update or delete messages in the channel
		test1_channel_member.delete()

		frappe.clear_cache()

		frappe.set_user("test1@example.com")

		with self.assertRaises(frappe.PermissionError):
			test1_message.message = "Edited message"
			test1_message.save()

		with self.assertRaises(frappe.PermissionError):
			test1_message.delete()
