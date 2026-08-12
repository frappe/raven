import { useContext, useMemo } from "react"
import { getDefaultStore, useSetAtom } from "jotai"
import { useNavigate } from "react-router-dom"
import { FrappeConfig, FrappeContext, useFrappeGetCall, type FrappeError } from "frappe-react-sdk"
import { toast } from "sonner"
import {
    Bookmark,
    BookmarkMinus,
    Copy,
    Link,
    MessageSquareText,
    Edit3Icon,
    Eye,
    Forward,
    Pin,
    PinOff,
    Reply,
    SmilePlus,
    Trash2,
    ListXIcon,
    ZapIcon,
} from "lucide-react"
import { editingMessageAtom, messageDialogAtom, replyToMessageAtom } from "@utils/channelAtoms"
import { focusComposer } from "@components/features/ChatInput/composerFocus"
import { resolveEditTarget } from "./editTarget"
import { buildFileActions, type MessageAction } from "./fileActions"
import { ReadReceiptsList } from "./ReadReceiptsList"
import { channelMessagesStore } from "@stores/messages/store"
import { parsePinnedIds } from "@stores/messages/selectors"
import { isOptimistic } from "@stores/messages/types"
import { channelStore } from "@stores/channels/store"
import { useChannelPinnedString } from "@stores/channels/useChannelList"
import { seedThreadMeta } from "@stores/threads/useThreadMeta"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { errorResponseToast } from "@components/ui/error-banner"
import type { PollData } from "../renderers/PollMessageContent"
import { useEnabledMessageActions } from "@hooks/useEnabledMessageActions"

export type { MessageAction }

/** Strips rich-text markup so "Copy" puts plain text on the clipboard. */
const toPlainText = (html: string): string => {
    return new DOMParser().parseFromString(html, "text/html").body.textContent ?? ""
}

/**
 * Copy text to the clipboard preserving formatting: writes both `text/html` (so rich
 * targets keep bold/lists/links) and a `text/plain` fallback. Falls back to plain-only
 * if the richer Clipboard API is unavailable or rejected.
 */
const copyRichText = async (html: string, plain: string) => {
    try {
        if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([html], { type: "text/html" }),
                    "text/plain": new Blob([plain], { type: "text/plain" }),
                }),
            ])
            return
        }
    } catch {
        // Fall through to plain text below.
    }
    await navigator.clipboard.writeText(plain)
}

/**
 * The user's active text selection IF it lies within this message, else "". Lets Copy
 * grab just the highlighted part; scoping to the message's `data-message-id` wrapper means
 * a leftover selection in another message falls through to copying the whole message.
 */
const selectionWithinMessage = (messageID: string): string => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return ""
    const text = selection.toString().trim()
    if (!text || !selection.anchorNode || !selection.focusNode) return ""
    const container = document.querySelector(`[data-message-id="${CSS.escape(messageID)}"]`)
    if (!container) return ""
    return container.contains(selection.anchorNode) && container.contains(selection.focusNode) ? text : ""
}

/**
 * Builds the action groups for a message — the single source of truth rendered by the
 * desktop context menu, the mobile bottom sheet, and the hover toolbar's overflow menu.
 * Groups map to visual sections separated by dividers.
 *
 * Mutating actions (edit/delete/pin/save/reactions) all follow one optimistic contract:
 * (1) apply to the channel message store synchronously via its action methods, (2) fire
 * the API call, (3) on failure, put back what was applied and toast. The store's
 * idempotent, monotonic upserts make a window resync a safe universal rollback.
 */
export const useMessageActions = (
    message: Message | null,
    options?: {
        /** Whether the user can INTERACT with this channel/thread (reply, create
         *  thread, pin). Comes from the host's composer gate — membership +
         *  not-archived — which, unlike the channel store, also knows THREAD
         *  membership. Defaults to true for callers without a gate. */
        canInteract?: boolean
        /** Whether to build the FILE actions (copy file link / download / download all /
         *  attach to document). Defaults to true.
         *
         *  Set false while they can't be seen. Building them resolves the message's batch
         *  via `channelMessagesStore.batchMembers`, which scans the channel's whole loaded
         *  window — cheap once, wasteful on a hover-driven path. The hover toolbar renders
         *  only reply/create-thread/edit as buttons and shows the rest solely inside its
         *  ellipsis dropdown, so it passes its open state here and pays the scan when the
         *  dropdown actually opens. The context menu, which only ever targets a message on
         *  right-click or long-press, leaves this alone. */
        includeFileActions?: boolean
    },
): {
    /** Action groups (visual sections) — menus/sheets/toolbar all render from these. */
    groups: MessageAction[][]
    /** The current user sent this message (and it's not a bot message) — exposed so
     *  consumers with owner-dependent PRESENTATION (the toolbar hides quick-Reply on
     *  own messages) don't re-derive the rule. */
    isOwner: boolean
} => {
    const canInteract = options?.canInteract ?? true
    const includeFileActions = options?.includeFileActions ?? true
    const { name: currentUser } = useUserCookieData()
    const setDialog = useSetAtom(messageDialogAtom)
    const navigate = useNavigate()
    const { call } = useContext(FrappeContext) as FrappeConfig
    // Pinned state lives on the channel, and pinning doesn't change the message object —
    // so subscribe to the channel's pinned string here. Without this, reopening the menu
    // on the same (unchanged) message would return the memo's stale "Pin" label.
    const pinnedString = useChannelPinnedString(message?.channel_id ?? "")
    // Poll state, for the "Retract vote" action. Same SWR key as the poll card,
    // and the menu only ever targets a visible message — so this is a cache
    // read, not a new request. Null key skips the hook for non-poll messages.
    const isPoll = message?.message_type === "Poll"
    const { data: pollData, mutate: mutatePoll } = useFrappeGetCall<{ message: PollData }>(
        "raven.api.raven_poll.get_poll",
        { message_id: message?.name },
        isPoll && message ? ["poll", message.name] : null,
        { dedupingInterval: 10000 },
    )
    const enabledActions = useEnabledMessageActions()

    return useMemo(() => {
        if (!message) return { groups: [], isOwner: false }

        const isOwner = currentUser === message.owner && !message.is_bot_message
        const hasReactions = Object.keys(JSON.parse(message.message_reactions || "{}")).length > 0

        // Respond: reply + thread creation — members only (see canInteract above)
        const respond: MessageAction[] = []
        if (canInteract) {
            respond.push({
                id: "reply",
                label: _("Reply"),
                icon: Reply,
                // Set the channel's reply target; the composer reads it and shows the
                // banner. focusComposer here (inside the select gesture) is what opens
                // the keyboard on iOS — a post-render effect can't. The mobile action
                // sheet's onCloseAutoFocus is prevented so its close doesn't steal
                // the focus right back.
                onSelect: () => {
                    getDefaultStore().set(replyToMessageAtom(message.channel_id), message)
                    focusComposer(message.channel_id)
                },
            })
        }
        // Create thread only inside a channel: not on a message that already has one
        // (is_thread), only when the message's channel is a real channel/DM in the
        // store, and only for MEMBERS. The store check is what excludes thread replies
        // EVERYWHERE (channel thread route, threads page, notification/search panes):
        // a thread is a channel the channel store never holds, so an unknown
        // channel_id means "inside a thread". The thread's id IS the message id; a
        // batch threads off its newest member.
        const parentChannel = channelStore.getChannel(message.channel_id)
        if (!message.is_thread && parentChannel && canInteract) {
            respond.push({
                id: "create-thread",
                label: _("Create thread"),
                icon: MessageSquareText,
                onSelect: () => {
                    const threadID = message.name
                    // Thread route under the message's REAL channel — the current path is
                    // useless in panes (notifications/search/saved carry no channel base).
                    const base = parentChannel.is_direct_message === 1
                        ? `/dm-channel/${encodeURIComponent(parentChannel.name)}`
                        : `/${encodeURIComponent(parentChannel.workspace ?? "")}/${encodeURIComponent(parentChannel.name)}`
                    // Coming from elsewhere (a pane)? The channel opens fresh — also select
                    // the new thread's root message in it (same rule as the thread pill).
                    const pathname = window.location.pathname.replace(`/${import.meta.env.VITE_BASE_NAME}`, "")
                    const target = pathname.startsWith(base)
                        ? `${base}/thread/${threadID}`
                        : `${base}/thread/${threadID}?message_id=${encodeURIComponent(threadID)}`
                    call.post("raven.api.threads.create_thread", { message_id: threadID })
                        .then(() => {
                            // Reflect the new thread on the parent (shows the pill) and seed an
                            // empty reply count, then open it.
                            channelMessagesStore.messageEdited(message.channel_id, threadID, { is_thread: 1 })
                            seedThreadMeta(threadID, 0)
                            navigate(target)
                        })
                        .catch((e) => errorResponseToast(_("Could not create thread"), e))
                },
            })
        }

        // Clipboard: forward, copy text, copy message link
        const clipboard: MessageAction[] = []
        // Forward sits with copy/link — all three take this message somewhere else.
        // NOT gated on canInteract: that flag is membership in the SOURCE channel and
        // governs writing back into it, while a forward writes into a different channel
        // whose permission the server checks on insert. So someone reading a message in
        // the search or notification pane can still forward it.
        // Polls can't be copied without either sharing or orphaning their poll doc; a
        // System notice (joins/leaves) means nothing anywhere else; and an optimistic
        // message has no server copy to forward yet.
        if (message.message_type !== "Poll" && message.message_type !== "System" && !isOptimistic(message)) {
            clipboard.push({
                id: "forward",
                label: _("Forward"),
                icon: Forward,
                onSelect: () => setDialog({ type: "forward", message }),
            })
        }
        if (message.text || message.content) {
            clipboard.push({
                id: "copy",
                label: _("Copy"),
                icon: Copy,
                onSelect: () => {
                    // A partial selection copies just that text. A full copy preserves the
                    // message's formatting (HTML) for rich paste targets, with a plain fallback.
                    const selected = selectionWithinMessage(message.name)
                    const html = message.text ?? ""
                    if (selected) {
                        navigator.clipboard.writeText(selected)
                    } else if (html.trimStart().startsWith("<")) {
                        copyRichText(html, toPlainText(html))
                    } else {
                        navigator.clipboard.writeText(toPlainText(message.content ?? html))
                    }
                    toast.success(_("Copied to clipboard"))
                },
            })
        }
        clipboard.push({
            id: "copy-link",
            label: _("Copy message link"),
            icon: Link,
            onSelect: () => {
                // One canonical shape for EVERY message — the /message resolver route
                // redirects it to the right place (channel, DM, or thread reply).
                // Pathname-based links broke inside threads (?message_id belongs to
                // the channel's stream) and in the notification/search panes (no
                // channel in the URL at all).
                const base = import.meta.env.VITE_BASE_NAME ? `/${import.meta.env.VITE_BASE_NAME}` : ""
                const url = `${window.location.origin}${base}/message/${encodeURIComponent(message.name)}`
                navigator.clipboard
                    .writeText(url)
                    .then(() => toast.success(_("Link copied")))
                    .catch(() => toast.error(_("Could not copy link")))
            },
        })

        // File actions (copy file link, download, download all, attach to document)
        // render as their own group — a divider above them on every surface — so
        // they're built separately and kept out of the clipboard group above.
        const fileActions = includeFileActions ? buildFileActions(message, { setDialog }) : []

        // Custom actions (admin-defined "Raven Message Action" docs): one parent
        // entry whose children render as a submenu / drawer sub-view. Absent
        // entirely on sites with none — the common case. Not gated on canInteract:
        // running an action only needs read access to the message (the server
        // enforces exactly that).
        const customActions: MessageAction[] = []
        if (enabledActions.length > 0) {
            customActions.push({
                id: "custom-actions",
                label: _("Actions"),
                icon: ZapIcon,
                children: enabledActions.map((action) => ({
                    id: `custom-action-${action.name}`,
                    label: action.action_name,
                    onSelect: () => setDialog({ type: "custom-action", message, actionID: action.name }),
                })),
            })
        }

        // Organize: pin, save, reactions.
        // Pinned state lives on the CHANNEL (pinned_messages_string, newline-separated
        // ids), not the message — the stream DERIVES each message's is_pinned from it
        // (selectors.ts) and the header reads it for the pinned bar. So both the label
        // and the optimistic toggle go through the channel store, never the message's
        // own is_pinned (which the decorator overwrites).
        const isPinned = parsePinnedIds(pinnedString).has(message.name)
        // Saved state lives in `_liked_by` (a JSON array of user ids — Frappe's like
        // mechanism, reused for bookmarks).
        const isSaved = (JSON.parse(message._liked_by || "[]") as string[]).includes(currentUser)

        const organize: MessageAction[] = []
        // Pinning is a channel mutation — members only (same rule as reply/thread),
        // and CHANNELS only: pins live on the channel doc and render in the channel's
        // pinned bar, which threads don't have — so no Pin on thread messages
        // (parentChannel is undefined there; threads never enter the channel store).
        if (canInteract && parentChannel) {
            organize.push({
                id: "pin",
                label: isPinned ? _("Unpin") : _("Pin"),
                icon: isPinned ? PinOff : Pin,
                onSelect: () => {
                    // Optimistically add/remove the id in the channel's pinned set; revert on
                    // failure. patchChannel no-ops if the channel isn't in the store (threads),
                    // so the API call still drives the server in that case.
                    const prev = channelStore.getChannel(message.channel_id)?.pinned_messages_string ?? ""
                    const ids = parsePinnedIds(prev)
                    ids.has(message.name) ? ids.delete(message.name) : ids.add(message.name)
                    channelStore.patchChannel(message.channel_id, { pinned_messages_string: [...ids].join("\n") })
                    call.post("raven.api.raven_channel.toggle_pin_message", {
                        channel_id: message.channel_id,
                        message_id: message.name,
                    }).catch((e) => {
                        channelStore.patchChannel(message.channel_id, { pinned_messages_string: prev })
                        errorResponseToast(isPinned ? _("Could not unpin message") : _("Could not pin message"), e)
                    })
                },
            })
        }
        organize.push(
            {
                id: "save",
                label: isSaved ? _("Unsave") : _("Save"),
                icon: isSaved ? BookmarkMinus : Bookmark,
                onSelect: () => {
                    // Optimistically add/remove the current user in `_liked_by`; revert on
                    // failure. The realtime `message_saved` echo converges to server truth.
                    const prevLiked = channelMessagesStore.getState(message.channel_id).byId.get(message.name)?._liked_by ?? message._liked_by
                    const liked = JSON.parse(prevLiked || "[]") as string[]
                    const currentlySaved = liked.includes(currentUser)
                    const nextLiked = currentlySaved ? liked.filter((user) => user !== currentUser) : [...liked, currentUser]
                    channelMessagesStore.savedUpdated(message.channel_id, message.name, JSON.stringify(nextLiked))
                    call.post("raven.api.raven_message.save_message", { message_id: message.name, add: !currentlySaved }).catch((e) => {
                        channelMessagesStore.savedUpdated(message.channel_id, message.name, prevLiked)
                        errorResponseToast(currentlySaved ? _("Could not unsave message") : _("Could not save message"), e)
                    })
                },
            },
        )
        if (hasReactions) {
            organize.push({
                id: "reactions",
                label: _("View reactions"),
                icon: SmilePlus,
                onSelect: () => setDialog({ type: "reactions", message }),
            })
        }
        // Who has read it — sits with the other "view what happened to this message"
        // actions, right under View reactions. Open to everyone in the channel, and
        // NOT gated on canInteract — it reads state, it doesn't mutate the channel,
        // so it stays available in archived channels. Desktop menus fly the list out
        // as a nested submenu (a glance, no dialog needed); the mobile action sheet
        // runs onSelect instead, opening it as its own bottom sheet — the same flow
        // as View reactions.
        organize.push({
            id: "read-receipts",
            label: _("Read by"),
            icon: Eye,
            onSelect: () => setDialog({ type: "read-receipts", message }),
            submenu: () => <ReadReceiptsList message={message} />,
        })

        // Owner-only, destructive last
        const owner: MessageAction[] = []
        if (isOwner) {
            // Edit is inline (not a dialog): flag this message as the channel's edit
            // target and the body renderer swaps in the editor. Hidden when there's
            // no editable text (poll / caption-less file). A batch edits its caption.
            const editTarget = resolveEditTarget(message)
            if (editTarget) {
                owner.push({
                    id: "edit",
                    label: _("Edit"),
                    icon: Edit3Icon,
                    onSelect: () => getDefaultStore().set(editingMessageAtom(editTarget.channel_id), editTarget.name),
                })
            }
            owner.push({
                id: "delete",
                label: _("Delete"),
                icon: Trash2,
                danger: true,
                onSelect: () => setDialog({ type: "delete", message }),
            })
        }

        // Poll: retract your vote. Shown only when the poll is loaded, you have
        // voted, and the poll is still open (the server enforces the same rules).
        const pollActions: MessageAction[] = []
        const pollInfo = isPoll ? pollData?.message : undefined
        const hasVoted = (pollInfo?.current_user_votes.length ?? 0) > 0
        const pollClosed = pollInfo?.poll.is_disabled === 1
        if (pollInfo && hasVoted && !pollClosed && canInteract) {
            pollActions.push({
                id: "retract-vote",
                label: _("Retract vote"),
                icon: ListXIcon,
                onSelect: () => {
                    call
                        .post("raven.api.raven_poll.retract_vote", { poll_id: pollInfo.poll.name })
                        // The realtime poll_update event also revalidates this key;
                        // mutating directly just makes it instant for the voter.
                        .then(() => mutatePoll())
                        .catch((e) => errorResponseToast(_("Could not retract your vote"), e as FrappeError))
                },
            })
        }

        return { groups: [respond, pollActions, clipboard, fileActions, customActions, organize, owner].filter((group) => group.length > 0), isOwner }
    }, [message, currentUser, setDialog, navigate, call, pinnedString, canInteract, isPoll, pollData, mutatePoll, includeFileActions, enabledActions])
}
