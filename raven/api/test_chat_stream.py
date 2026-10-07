import datetime

import frappe
from frappe.tests import IntegrationTestCase

from raven.api.chat_stream import get_messages, get_newer_messages, get_older_messages

CHANNEL_ID = "Public Workspace-test-channel"

EXTRA_TEST_RECORD_DEPENDENCIES = ["Raven Workspace"]


def create_messages():
	"""
	Create test messages in the channel
	Higher the number, newer the message
	"""

	# Create 100 messages
	for i in range(100):
		# Set the creation date of the 50th message the same as the 49th message
		if i == 49:
			creation = datetime.datetime.now() - datetime.timedelta(days=100 - i - 1)
		else:
			creation = datetime.datetime.now() - datetime.timedelta(days=100 - i)
		message = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"name": f"{CHANNEL_ID}-{i}",
				"text": f"Test Message {i}",
				"content": f"Test Message {i}",
				"channel_id": CHANNEL_ID,
				"message_type": "Text",
				"creation": creation,
				"modified": creation,
			}
		)
		message.db_insert()


def create_channel():
	channel_doc = frappe.get_doc(
		{
			"doctype": "Raven Channel",
			"channel_name": "Test Channel",
			"type": "Public",
			"workspace": "Public Workspace",
		}
	)
	channel_doc.flags.do_not_add_member = True
	channel_doc.insert()


class TestChatStream(IntegrationTestCase):
	def setUp(self):
		try:
			frappe.delete_doc("Raven Channel", CHANNEL_ID)
		except frappe.exceptions.DoesNotExistError:
			pass
		frappe.clear_cache(doctype="Raven Message")
		create_channel()
		# Messages are ordered by an index. Greater the index, newer the message.
		# So Test Message 99 is the latest message and Test Message 0 is the oldest
		create_messages()

	def tearDown(self):
		frappe.delete_doc("Raven Channel", CHANNEL_ID)
		# We need to remove this database commit
		frappe.db.commit()  # nosemgrep

	def test_get_messages(self):
		"""
		Chat Stream `get_messages` API
		The API should return the latest 'n' messages in the channel - general, ordered by creation date (newest first)
		It should also return if older messages are available.
		Since the API is being tested without a base message, it should not return newer messages
		"""
		response = get_messages(CHANNEL_ID)
		self.assertEqual(len(response["messages"]), 20)

		# Loop over and check indexes of all messages
		for i, message in enumerate(response["messages"]):
			self.assertEqual(message.text, f"Test Message {99-i}")

		# Check if older messages are available
		self.assertEqual(response["has_old_messages"], True)
		self.assertEqual(response["has_new_messages"], False)

		response = get_messages(CHANNEL_ID, limit=80)
		self.assertEqual(len(response["messages"]), 80)

		# Loop over and check indexes of all messages
		for i, message in enumerate(response["messages"]):
			self.assertEqual(message.text, f"Test Message {99-i}")

		# Check if older messages are available
		self.assertEqual(response["has_old_messages"], True)
		self.assertEqual(response["has_new_messages"], False)

		response = get_messages(CHANNEL_ID, limit=100)
		self.assertEqual(len(response["messages"]), 100)

		# Loop over and check indexes of all messages
		for i, message in enumerate(response["messages"]):
			self.assertEqual(message.text, f"Test Message {99-i}")

		# Check if older/newer messages are available
		self.assertEqual(response["has_old_messages"], False)
		self.assertEqual(response["has_new_messages"], False)

		response = get_messages(CHANNEL_ID, limit=1000)
		self.assertEqual(len(response["messages"]), 100)

		# Loop over and check indexes of all messages
		for i, message in enumerate(response["messages"]):
			self.assertEqual(message.text, f"Test Message {99-i}")

		# Check if older/newer messages are available
		self.assertEqual(response["has_old_messages"], False)
		self.assertEqual(response["has_new_messages"], False)

	def test_get_messages_around_base_mid(self):
		"""
		Chat Stream `get_messages` API with a base message in the middle of the list
		The API should return 10 messages before and 9 after the base message
		"""
		base_message_id = frappe.db.get_value(
			"Raven Message", {"text": "Test Message 50", "channel_id": CHANNEL_ID}, "name"
		)

		response = get_messages(CHANNEL_ID, base_message=base_message_id)

		# We should get 20 messages overall
		self.assertEqual(len(response["messages"]), 20)

		# Check if older messages are available
		self.assertEqual(response["has_old_messages"], True)

		# Check if newer messages are available
		self.assertEqual(response["has_new_messages"], True)

		# Loop over and check indexes of all messages
		for i, message in enumerate(response["messages"]):
			self.assertEqual(message.text, f"Test Message {59-i}")

	def test_get_messages_around_base_with_fewer_new_messages(self):
		"""
		Get messages around a base message with fewer new messages (index 95)
		"""
		base_message_id = frappe.db.get_value(
			"Raven Message", {"text": "Test Message 95", "channel_id": CHANNEL_ID}, "name"
		)
		response = get_messages(CHANNEL_ID, base_message=base_message_id)

		# We should get 15 messages overall
		self.assertEqual(len(response["messages"]), 15)

		# Check if older messages are available
		self.assertEqual(response["has_old_messages"], True)

		# Check if newer messages are available
		self.assertEqual(response["has_new_messages"], False)

		# Loop over and check indexes of all messages
		for i, message in enumerate(response["messages"]):
			self.assertEqual(message.text, f"Test Message {99-i}")

	def test_get_messages_around_base_with_fewer_old_messages(self):
		"""
		Get messages around a base message with fewer old messages (index 5)
		"""
		base_message_id = frappe.db.get_value(
			"Raven Message", {"text": "Test Message 5", "channel_id": CHANNEL_ID}, "name"
		)
		response = get_messages(CHANNEL_ID, base_message=base_message_id)

		# We should get 15 messages overall
		self.assertEqual(len(response["messages"]), 15)

		# Check if older messages are available
		self.assertEqual(response["has_old_messages"], False)

		# Check if newer messages are available
		self.assertEqual(response["has_new_messages"], True)

		# Loop over and check indexes of all messages
		for i, message in enumerate(response["messages"]):
			self.assertEqual(message.text, f"Test Message {14-i}")

	def test_get_older_messages(self):
		"""
		Chat Stream `get_older_messages` API
		The API should return messages older than a certain message for a channel, ordered by creation date (newest first)
		"""
		base_message_id = frappe.db.get_value(
			"Raven Message", {"text": "Test Message 50", "channel_id": CHANNEL_ID}, "name"
		)

		response = get_older_messages(CHANNEL_ID, base_message_id)

		# We should get 20 messages overall
		self.assertEqual(len(response["messages"]), 20)

		# Check if older messages are available
		self.assertEqual(response["has_old_messages"], True)

		# Loop over and check indexes of all messages
		for i, message in enumerate(response["messages"]):
			self.assertEqual(message.text, f"Test Message {49-i}")

		# Increase the limit to 50
		response = get_older_messages(CHANNEL_ID, base_message_id, limit=50)

		# We should get 50 messages overall
		self.assertEqual(len(response["messages"]), 50)

		# Check if older messages are available
		self.assertEqual(response["has_old_messages"], False)

		# Loop over and check indexes of all messages
		for i, message in enumerate(response["messages"]):
			self.assertEqual(message.text, f"Test Message {49-i}")

		# Change the base to the 5th message to test whether the flag for older messages is set correctly
		base_message_id = frappe.db.get_value(
			"Raven Message", {"text": "Test Message 5", "channel_id": CHANNEL_ID}, "name"
		)

		response = get_older_messages(CHANNEL_ID, base_message_id)

		# We should get 5 messages overall
		self.assertEqual(len(response["messages"]), 5)

		# Check if older messages are available
		self.assertEqual(response["has_old_messages"], False)

		# # Loop over and check indexes of all messages
		for i, message in enumerate(response["messages"]):
			self.assertEqual(message.text, f"Test Message {4-i}")

	def test_get_newer_messages(self):
		"""
		Chat Stream `get_newer_messages` API
		The API should return messages newer than a certain message for a channel, ordered by creation date (newest first)
		"""
		base_message_id = frappe.db.get_value(
			"Raven Message", {"text": "Test Message 50", "channel_id": CHANNEL_ID}, "name"
		)

		response = get_newer_messages(CHANNEL_ID, base_message_id)

		# We should get 20 messages overall
		self.assertEqual(len(response["messages"]), 20)

		# Check if newer messages are available
		self.assertEqual(response["has_new_messages"], True)

		# Loop over and check indexes of all messages
		for i, message in enumerate(response["messages"]):
			self.assertEqual(message.text, f"Test Message {70-i}")

		# Increase the limit to 50
		response = get_newer_messages(CHANNEL_ID, base_message_id, limit=50)

		# We should get 49 newer messages overall (51 to 99) - the 50th message is the base message + has a timestamp equal to the 49th message
		self.assertEqual(len(response["messages"]), 49)

		# Check if newer messages are available
		self.assertEqual(response["has_new_messages"], False)

		# Loop over and check indexes of all messages
		for i, message in enumerate(response["messages"]):
			self.assertEqual(message.text, f"Test Message {99-i}")


class TestThreadsSidecar(IntegrationTestCase):
	def setUp(self):
		for name in frappe.get_all("Raven Channel", {"channel_name": "threads-sidecar"}, pluck="name"):
			frappe.delete_doc("Raven Channel", name, force=True)
		channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": "Threads Sidecar",
				"type": "Public",
				"workspace": "Public Workspace",
			}
		)
		channel.flags.do_not_add_member = True
		self.channel = channel.insert().name

	def tearDown(self):
		frappe.delete_doc("Raven Channel", self.channel, force=True)

	def test_threads_sidecar(self):
		"""
		Every chat stream page carries the members and reply count of each thread started in it,
		in the same shape as get_thread_details. Messages without a thread are left out.
		"""
		from raven.api.threads import create_thread, get_thread_details

		plain = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel,
				"text": "Plain",
				"message_type": "Text",
			}
		).insert(ignore_permissions=True)
		root = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel,
				"text": "Thread root",
				"message_type": "Text",
			}
		).insert(ignore_permissions=True)
		created = create_thread(root.name)
		try:
			frappe.get_doc(
				{"doctype": "Raven Message", "channel_id": root.name, "text": "Reply", "message_type": "Text"}
			).insert(ignore_permissions=True)

			threads = get_messages(self.channel)["threads"]
			self.assertEqual(list(threads), [root.name])
			self.assertEqual(threads[root.name], get_thread_details(root.name))
			self.assertEqual(threads[root.name]["message_count"], 1)
			for meta in threads[root.name]["members"].values():
				self.assertEqual(set(meta), {"is_admin", "channel_member_name"})

			# create_thread answers with the same details, before any reply.
			self.assertEqual(created["message_count"], 0)
			self.assertEqual(created["members"], threads[root.name]["members"])

			# Jump to a message: one side-car for the whole page.
			around = get_messages(self.channel, base_message=root.name)
			self.assertEqual(around["threads"], {root.name: threads[root.name]})

			self.assertEqual(get_older_messages(self.channel, root.name)["threads"], {})
			self.assertEqual(
				get_newer_messages(self.channel, plain.name)["threads"], {root.name: threads[root.name]}
			)
		finally:
			frappe.delete_doc("Raven Channel", root.name, force=True)

	def test_thread_list_details(self):
		"""
		The thread list carries get_thread_details for each channel thread when asked,
		and v2's participants by default.
		"""
		from raven.api.threads import create_thread, get_all_threads, get_thread_details

		root = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel,
				"text": "Thread root",
				"message_type": "Text",
			}
		).insert(ignore_permissions=True)
		create_thread(root.name)
		try:
			v3 = [
				t for t in get_all_threads(channel_id=self.channel, fetch_members=False, with_details=True)
			]
			self.assertEqual([t["name"] for t in v3], [root.name])
			self.assertEqual(v3[0]["details"], get_thread_details(root.name))
			self.assertNotIn("participants", v3[0])

			v2 = get_all_threads(channel_id=self.channel)
			self.assertIn("participants", v2[0])
			self.assertNotIn("details", v2[0])
		finally:
			frappe.delete_doc("Raven Channel", root.name, force=True)
