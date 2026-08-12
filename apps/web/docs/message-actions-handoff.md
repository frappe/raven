# Raven v3 — Message Actions & Beyond (handoff)

## Architecture primer (what you must know)

- **Action delegation:** `MessageActionMenu` wraps the stream; `closest("[data-message-id]")` → `messageActionTargetAtom`. The action list = `useMessageActions(message)`. Dialogs are driven by `messageDialogAtom` and mounted once via `MessageActionDialogs` (each real dialog lives in `components/features/message/actions/dialogs/`).
- **Batch model (critical):** a multi-file upload = N Raven Messages sharing `message_batch_id`; the caption text sits on one member, the reply linkage on the **last** member. Actions are **batch-level** and resolve to the **last/newest member** (already handled in `blockFromEvent`). `channelMessagesStore.batchMembers(channelID, batchID)` returns members oldest-first.
- **Optimistic contract:** patch the store synchronously → call API → on failure revert. Store primitives: `messageEdited(patch)`, `messageDeleted`, `messagesRestored(snapshot)`, `reactionsUpdated`, `savedUpdated`. Realtime echoes (`message_edited` / `_deleted` / `_reacted` / `_saved`) are idempotent and converge to server truth. Reference implementations: `dialogs/DeleteMessageDialog.tsx` (snapshot/restore) and `actions/useToggleReaction.ts` (re-toggle to undo).

## 1. Inline message editing — DO FIRST

**Backend:** none needed. `useFrappeUpdateDoc("Raven Message", name, { text: newHTML })`. The backend `before_validate` re-derives `content`, mentions, and links from `text` and sets `is_edited` when text changed (`raven_message.py:78`); `on_update` publishes `message_edited` with `message_details` → the store patches it.

**Target resolution:**
- Single text message → itself.
- **Batch** → the caption/text member (`members.find(m => m.text)`). If the batch has no caption, **hide Edit** (simplest).
- Hide Edit for Poll messages and file-only messages with no text.

**Empty-on-save rule (product decision, from v2):**
- new text empty **and** message has **no file** → delete it (`delete_messages([id])`, reuse the delete path).
- new text empty **but** message **has a file** (caption cleared) → just update `text` to `""` — do NOT delete the file.

**UX — inline (Slack/v2 style), not a dialog:**
- New `editingMessageAtom(channelID)` holding the message id (channel-keyed, like `replyToMessageAtom`).
- In the message body renderer, when `editingMessageId === message.name`, render `useRavenEditor({ content: message.text, autofocus: true })` in place of `RichTextRenderer` (omit `filesRef`). Save on Enter, Cancel on Esc.
- Optimistic: `channelMessagesStore.messageEdited(channelID, id, { text: newHTML, is_edited: 1 })` (the rendered body reads `text`; `content` is corrected by the echo). Snapshot `{ text, content, is_edited }` first; revert on API failure.
- **Gotchas:** Esc must cancel edit WITHOUT bubbling to the thread/drawer hotkey (mirror the reply-cancel `stopPropagation` in `useRavenEditor`); only `isOwner`; remove/repurpose the existing edit Dialog stub in `MessageActionDialogs` + the `"edit"` branch of `messageDialogAtom`; `useMessageActions` "edit" onSelect switches from `setDialog` to `setEditing(message)`.
- Lower-effort fallback: keep the Dialog, mount the editor inside it.

**Files:** `useMessageActions.tsx`, `MessageActionDialogs.tsx` (remove edit stub), the message body renderer (`renderers/MessageContent.tsx` / `MessageItem.tsx`), `utils/channelAtoms.ts` (new atom), likely a small `EditMessageComposer.tsx`.

## 2. Create thread
- API: `threads.create_thread(message_id)` (returns the thread channel; threadID === message_id). Then `navigate(\`${channelID}/thread/${message_id}\`)` and `seedThreadMeta`. Only for non-thread messages (guard already present). Replace the `create-thread` stub. Target = last member for a batch.

## 3. Pin / Unpin
- API: `raven_channel.toggle_pin_message(channel_id, message_id)`.
- Optimistic: `messageEdited(channelID, id, { is_pinned: msg.is_pinned ? 0 : 1 })`; revert on failure.
- **Verify:** the realtime event that updates pins + how the pinned bar consumes `pinnedMessagesString` (passed into `ChatStream`); ensure the pinned-list view refreshes. Replace the `pin` stub.

## 4. Save / Unsave
- API: `raven_message.save_message(message_id, add)` (`add` = true to save — **verify** exact contract).
- Optimistic: `savedUpdated(channelID, id, newLikedBy)` (toggle currentUser in `_liked_by`); `message_saved` realtime handler already exists. Replace the `save` stub.

## 5. Forward (most involved — do last among actions)
- API: `raven_message.forward_message(message_receivers, forwarded_message)`.
- Needs a **new channel/DM picker dialog** (`dialogs/ForwardMessageDialog.tsx`) — reuse the channel list + a search filter. Forward the **whole batch**. Not optimistic (cross-channel; toast success/failure). Wire the `messageDialogAtom` `"forward"` branch.

## 6–9. After actions (roadmap)
- **Link previews (Layer 4):** `Raven Link Preview` docs are already created on send (`parse_html_content` → `deferred_insert`). Lazy-fetch preview metadata on viewport via `useHasBeenInView`; render a card.
- **Doc previews (Layer 5)** + finish the Frappe-document **attach** (composer `AttachFrappeDocumentDialog` is still a stub).
- **Threads-list page realtime:** repoint `ThreadsList.tsx` off SWR onto `threadMetaStore` / `unreadThreadsStore` so rows live-update on `thread_reply`.
- **Backend cleanup:** delete `get_all_votes` (`raven/api/raven_poll.py`) once v2 is retired — v3 folded voters into `get_poll`.

## Recommended order
Edit → Create thread → Pin → Save → Forward → (then lazy-data previews). Edit is the headline gap; pin/save/create-thread are quick (APIs ready, optimistic primitives exist); forward needs new UI.

## Per-feature testing checklist
Owner-only gating; batch targeting (caption member for edit, whole batch for delete/forward); optimistic apply + revert on forced failure (offline); realtime echo from a second user; Esc/focus behavior for inline edit inside a thread; empty-edit → delete vs clear-caption.
