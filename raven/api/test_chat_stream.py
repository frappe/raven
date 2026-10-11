import datetime

import frappe
from frappe.tests import IntegrationTestCase

from raven.api.chat_stream import get_messages, get_newer_messages, get_older_messages

# Channel autoname slugs the workspace: "Public Workspace" + "Test Channel".
CHANNEL_ID = "public-workspace-test-channel"

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
