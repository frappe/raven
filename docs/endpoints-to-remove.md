# Endpoints to remove later

Whitelisted endpoints that no app calls any more. First checked on 2026-10-15; rechecked on 2026-10-22 against `develop` by listing every `@frappe.whitelist` in the package and searching for each dotted path in `apps/web`, `packages`, Raven's own Python, hooks, the Desk JS under `raven/public/js`, the docs, raven-cloud and HRMS. The native app bundles the web app and has no calls of its own.

On 2026-10-22 the unused endpoints were deleted, along with the `events`, `mentions`, `chat` and `upload_file` modules, fourteen package hooks nothing imported, and the `linkpreview` and `blurhash-python` dependencies. Five Python-only functions lost their `@frappe.whitelist`. What is left below needs a decision.

Before deleting one, search again. Some method names are built at runtime, like `raven.api.notification.${method}` in `apps/web/src/lib/push.ts`.

## Decide first

| Endpoint | File | Note |
|---|---|---|
| `raven.api.preview_links.hide_link_preview` | `raven/api/preview_links.py` | No app calls it. The `hide_link_preview` field stays either way: messages, the chat stream and threads read it. Same decision as the todo item about the UI never setting it: add the UI, or drop the endpoint. |

## Keep

| Endpoint | Why |
|---|---|
| `raven.api.raven_message.send_message` | The documented API that bots and outside systems post with. No app calls it. |
| `raven.raven_integrations.doctype.raven_incoming_webhook.raven_incoming_webhook.handle_incoming_webhook` | Called by outside systems. |
| `raven.api.notification.subscribe` and `unsubscribe` | Built at runtime in `lib/push.ts`, so a plain search misses them. |
| `raven.api.native.boot` and `raven.api.raven_mobile.get_client_id` | The native app. |
| `raven.api.raven_channel_member.mark_channel_as_unread` | Added in frappe/raven#2182 for "mark as unread". The web app already listens for the event it sends (`stores/unread/useUnreadRealtime.ts`); the UI is still to come. |
| `raven.api.raven_channel.transfer_channel_to_workspace` | Added in frappe/raven#2182 as an admin tool, with `raven/tests/test_transfer_channel.py`. Stays whitelisted so a client can call it later. |
| `raven.api.raven_channel.get_channels` | The Desk "Send a Raven" timeline button (`raven/public/js/timeline_button.js`, loaded through `app_include_js`) lists channels with it and inserts the message with `frappe.db.insert`. If that button goes with the rest of the Desk integration, this endpoint and `raven/public/js` go too. |

Everything else is called from the web app.

## Python dependencies

From `pyproject.toml`, checked against the imports in the package.

| Package | Status |
|---|---|
| `markitdown`, `pandas` | Imported lazily in `raven/ai/conversation_file_handler.py`, with a user-facing "library not installed" message when missing. Only the AI file handler needs them. Could leave the hard dependencies. |
| `openai`, `openai-agents`, `google-cloud-documentai` | AI only. The Document Processors settings pages still use `raven.ai.google_ai`. These go when AI goes. |

The v3 upload path (`send_message_with_attachments`) never computed a blurhash, so the `blurhash` field on Raven Message is empty for every new image. If a blurred placeholder is wanted back, that is the path to add it to.
