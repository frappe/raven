# Endpoints to remove later

Whitelisted endpoints that the web app (`apps/web`) no longer calls. Checked on 2026-10-15 against `develop`, and against the native app on the `native-bundled` branch.

Before deleting one, search `apps/web`, `packages` and the native app again. Some method names are built at runtime, like `raven.api.notification.${method}` in `apps/web/src/lib/push.ts`.

## Used only by the old mobile app

Remove these once old builds of the mobile app (`apps/mobile`) are no longer in use.

| Endpoint | File |
|---|---|
| `raven.api.mentions.get_mentions` | `raven/api/mentions.py` |
| `raven.api.mentions.get_unread_mention_count` | `raven/api/mentions.py` |
| `raven.api.raven_channel.mark_all_messages_as_read` | `raven/api/raven_channel.py` |
| `raven.api.raven_message.get_all_files_shared_in_channel` | `raven/api/raven_message.py` |
| `raven.api.raven_poll.get_all_votes` | `raven/api/raven_poll.py` |
| `raven.api.threads.get_number_of_replies` | `raven/api/threads.py` |

## Not used by any app

Left over from the v2 frontend.

| Endpoint | File | Note |
|---|---|---|
| `raven.ai.google_ai.get_document_ai_processors` | `raven/ai/google_ai.py` | |
| `raven.api.ai_features.get_saved_prompts` | `raven/api/ai_features.py` | |
| `raven.api.events.create_event` | `raven/api/events.py` | |
| `raven.api.raven_channel.transfer_channel_to_workspace` | `raven/api/raven_channel.py` | Has tests in `raven/tests/test_transfer_channel.py` |
| `raven.api.raven_channel_member.mark_channel_as_unread` | `raven/api/raven_channel_member.py` | The web app listens for the event it sends (`stores/unread/useUnreadRealtime.ts`). Keep it if "mark as unread" is planned. |
| `raven.api.raven_channel_member.remove_channel_member` | `raven/api/raven_channel_member.py` | |
| `raven.api.raven_message.fetch_recent_files` | `raven/api/raven_message.py` | |
| `raven.api.raven_users.add_users_to_raven` | `raven/api/raven_users.py` | |
| `raven.api.search.get_search_result` | `raven/api/search.py` | |
| `raven.api.workspaces.can_create_channel` | `raven/api/workspaces.py` | |
| `raven.api.workspaces.get_workspace_member_count` | `raven/api/workspaces.py` | |
| `raven.api.workspaces.is_workspace_admin` | `raven/api/workspaces.py` | |
| `raven.api.workspaces.update_workspace_members` | `raven/api/workspaces.py` | |

## Keep, even though `apps/web` doesn't call them

| Endpoint | Why |
|---|---|
| `raven.api.native.boot` | The native app uses it. |
| `raven.api.raven_mobile.get_client_id` | The native app uses it. |
| `raven.api.raven_mobile.create_oauth_client` | Run with `bench execute`. It doesn't need `@frappe.whitelist`. |
| `raven.raven_integrations.doctype.raven_incoming_webhook.raven_incoming_webhook.handle_incoming_webhook` | Called by outside systems. |
| `raven.api.raven_channel.get_channels` | The Desk "Send a Raven" dialog uses it. |
| `raven.api.raven_message.get_timeline_message_content` | The Desk form timeline uses it. |
