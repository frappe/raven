import { useContext, useMemo } from "react"
import { getDefaultStore, useSetAtom } from "jotai"
import { useNavigate } from "react-router-dom"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { toast } from "sonner"
import {
    Bookmark,
    BookmarkMinus,
    Copy,
    Link,
    LucideIcon,
    MessageSquareText,
    Edit3Icon,
    Pin,
    PinOff,
    Reply,
    SmilePlus,
    Trash2,
} from "lucide-react"
import { editingMessageAtom, messageDialogAtom, replyToMessageAtom } from "@utils/channelAtoms"
import { focusComposer } from "@components/features/ChatInput/composerFocus"
import { resolveEditTarget } from "./editTarget"
import { channelMessagesStore } from "@stores/messages/store"
import { parsePinnedIds } from "@stores/messages/selectors"
import { channelStore } from "@stores/channels/store"
import { useChannelPinnedString } from "@stores/channels/useChannelList"
import { seedThreadMeta } from "@stores/threads/useThreadMeta"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { errorResponseToast } from "@components/ui/error-banner"

export type MessageAction = {
    id: string
    label: string
    icon: LucideIcon
    onSelect: () => void
    /** Renders in the destructive style (delete). */
    danger?: boolean
}

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
 * Builds the action groups for a message — the single source of truth rendered
 * by the desktop context menu, the mobile bottom sheet, and (later) the hover
 * toolbar. Groups map to visual sections separated by dividers.
 *
 * Mutating actions (edit/delete/pin/save/reactions) follow the optimistic
 * contract when implemented: (1) apply to the channel message store
 * synchronously via its action methods, (2) fire the API call, (3) on failure,
 * resync the channel window and toast. The store's idempotent, monotonic
 * upserts make resync a safe universal rollback.
 */
export const useMessageActions = (
    message: Message | null,
    options?: {
        /** Whether the user can INTERACT with this channel/thread (reply, create
         *  thread, pin). Comes from the host's composer gate — membership +
         *  not-archived — which, unlike the channel store, also knows THREAD
         *  membership. Defaults to true for callers without a gate. */
        canInteract?: boolean
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
    const { name: currentUser } = useUserCookieData()
    const setDialog = useSetAtom(messageDialogAtom)
    const navigate = useNavigate()
    const { call } = useContext(FrappeContext) as FrappeConfig
    // Pinned state lives on the channel, and pinning doesn't change the message object —
    // so subscribe to the channel's pinned string here. Without this, reopening the menu
    // on the same (unchanged) message would return the memo's stale "Pin" label.
    const pinnedString = useChannelPinnedString(message?.channel_id ?? "")

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

        // Clipboard & files
        const clipboard: MessageAction[] = []
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
                navigator.clipboard.writeText(url)
                toast.success(_("Link copied"))
            },
        })
        // No per-file Download here: it's ambiguous for a batch (which file?), and the
        // attachment preview / lightbox already offers an unambiguous per-file download.

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

        return { groups: [respond, clipboard, organize, owner].filter((group) => group.length > 0), isOwner }
    }, [message, currentUser, setDialog, navigate, call, pinnedString, canInteract])
}
