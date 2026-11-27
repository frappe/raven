---
name: raven
description: Raven chat app data model (workspaces, channels, DMs, threads, messages) and the Raven APIs for common tasks. Use when the user asks to read, summarize, search or send Raven messages, or to manage Raven channels, threads, members, reactions, polls or reminders.
---

# Raven

Raven is a chat app. Read this before you touch any Raven record.

## Data model

```
Raven Workspace            name = workspace_name
 └─ Raven Channel          a channel, a DM, or a thread
     ├─ Raven Channel Member   user_id, is_admin
     └─ Raven Message          channel_id → Raven Channel
```

- **Raven User**: a person or a bot. Its `name` is the user email (for a bot, the bot name).
- **Raven Workspace**: a group of channels. Members are in **Raven Workspace Member**.
- **Raven Channel**: one table with three kinds of rows:
  - Channel: `type` is `Public`, `Private` or `Open`. The `name` is `<workspace>-<channel_name>`, lowercase, spaces as hyphens (`Sales` + `Leads` gives `sales-leads`).
  - DM: `is_direct_message=1`, no workspace, users in `dm_user_1` and `dm_user_2`.
  - Thread: `is_thread=1`. Its `name` is the name of the message that started it.
- **Raven Message**: `channel_id`, `text` (HTML), `content` (plain text), `owner` (sender), `creation`, `message_type` (`Text`, `Image`, `File`, `Poll`, `System`).
  - Thread start: `is_thread=1`. Its replies have `channel_id` = that message name.
  - Quote reply (not a thread): `is_reply=1`, `linked_message` = the quoted message.

## Rules

- **Use the Raven APIs below with `call_api`.** They do permission checks, notifications, realtime updates and unread counts. Generic record tools (`read_records`, `create`, `update`, `delete`) skip some of this. Use them only when no Raven API does the task.
- Never `create` a Raven Message, Channel, Channel Member or Reaction directly.
- Pass `update_last_visit=0` when you read messages, so you do not mark the channel as read for the user.
- Skip `System` messages (joins, renames) unless the user asks for them.
- If you cannot see a channel, the user is not a member. Do not try to go around it.

## Read

| Task | API (`raven.api.` + ...) |
|---|---|
| My channels and DMs | `raven_channel.get_all_channels()` |
| Workspaces | `workspaces.get_list()` |
| Users | `raven_users.get_list()` |
| Channel members | `chat.get_channel_members(channel_id)` |
| Latest messages, newest first | `chat_stream.get_messages(channel_id, limit=50, update_last_visit=0)` |
| Older messages | `chat_stream.get_older_messages(channel_id, from_message, limit=50)` |
| Thread replies | `get_messages` with `channel_id` = thread name |
| My threads | `threads.get_all_threads(workspace, only_show_unread=0, limit=10)` |
| Unread counts | `raven_message.get_unread_count_for_channels()`, `threads.get_unread_threads()` |
| Mentions and reactions to me | `notifications.get_notifications(notification_type="mention", unread_only=1)` |
| Search messages | `search.sqlite_search(query, filters='{"channel_id": "sales-leads"}', limit=20)` |
| Saved messages | `raven_message.get_saved_messages(limit=20)` |
| Pinned messages | `raven_message.get_pinned_messages(channel_id)` |
| Files in a channel | `search.get_channel_files(channel_id)` |
| Reminders, scheduled messages | `reminders.get_reminders()`, `scheduled_message.get_scheduled_messages()` |

## Write

Each write needs the user's approval.

| Task | API (`raven.api.` + ...) |
|---|---|
| Send a message | `raven_message.send_message(channel_id, text)` |
| Quote reply | `send_message(channel_id, text, is_reply=1, linked_message)` |
| Start a thread | `threads.create_thread(message_id)` returns `{"thread_id"}`. Then `send_message` to that id. |
| Get or make a DM | `raven_channel.create_direct_message_channel(user_id)` returns the channel name |
| React or unreact | `reactions.react(message_id, reaction="👍")` (a second call removes it) |
| Create a channel | `raven_channel.create_channel(channel_name, channel_description, type, workspace)` |
| Add members | `raven_channel_member.add_channel_members(channel_id, members=[emails])` |
| Remove a member, leave | `raven_channel_member.remove_channel_member(user_id, channel_id)`, `raven_channel.leave_channel(channel_id)` |
| Pin or unpin | `raven_channel.toggle_pin_message(channel_id, message_id)` |
| Save or unsave | `raven_message.save_message(message_id, add="Yes")` (`"No"` to remove) |
| Forward | `raven_message.forward_message(...)`. Get its arguments with `describe_api` first. |
| Delete messages | `raven_message.delete_messages(message_ids=[...])` |
| Poll | `raven_poll.create_poll(channel_id, question, options=[{"option": "Yes"}, {"option": "No"}])` |
| Vote | `raven_poll.add_vote(message_id, option_id)` |
| Schedule a message | `scheduled_message.create_scheduled_message(channel_id, text, scheduled_time)` |
| Remind me | `reminders.create_reminder(message_id, remind_at, description)` |
| Mark read | `raven_channel.mark_all_messages_as_read(channel_ids=[...])` |
| Join a workspace | `workspaces.join_workspace(workspace)` |

No API exists to edit a message or archive a channel. For those, `update` Raven Message `text` (only the sender can do this) or Raven Channel `is_archived=1`.

Message `text` is HTML. Wrap each paragraph in `<p>`. To mention a user, write
`<span data-type="userMention" data-id="anna@example.com">@Anna</span>`. Raven then notifies Anna.

Times use `YYYY-MM-DD HH:MM:SS` in the site time zone.

## Common requests

- **Summarize a channel**: find it in `get_all_channels`, then `get_messages` with limit 50 to 200. Open threads only when they look important.
- **What did I miss**: get the unread counts and unread mentions, then the latest messages of the unread channels.
- **Tell X something**: find X in `raven_users.get_list`, get the DM, then `send_message`.

## Links

Link each record you mention:

- Channel: `/raven/<workspace>/<channel name>`
- DM: `/raven/dm-channel/<channel name>`
- Message or thread: `/raven/message/<message name>`
