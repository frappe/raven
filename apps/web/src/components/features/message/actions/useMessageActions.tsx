import { useContext, useMemo } from "react"
import { getDefaultStore, useSetAtom } from "jotai"
import { useNavigate, useParams } from "react-router-dom"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { toast } from "sonner"
import {
    Bookmark,
    BookmarkMinus,
    Copy,
    Link,
    LucideIcon,
    MessageSquareText,
    Pencil,
    Pin,
    PinOff,
    Reply,
    SmilePlus,
    Trash2,
} from "lucide-react"
import { editingMessageAtom, messageDialogAtom, replyToMessageAtom } from "@utils/channelAtoms"
import { resolveEditTarget } from "./editTarget"
import { channelMessagesStore } from "@stores/messages/store"
import { parsePinnedIds } from "@stores/messages/selectors"
import { channelStore } from "@stores/channels/store"
import { useChannelPinnedString } from "@stores/channels/useChannelList"
import { seedThreadMeta } from "@stores/threads/useThreadMeta"
import { getErrorMessage } from "@lib/frappe"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import { useUserCookieData } from "@hooks/useUserCookieData"

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
export const useMessageActions = (message: Message | null): MessageAction[][] => {
    const { name: currentUser } = useUserCookieData()
    const setDialog = useSetAtom(messageDialogAtom)
    const navigate = useNavigate()
    const { call } = useContext(FrappeContext) as FrappeConfig
    // A thread is itself a channel whose id === the parent message id, so a thread
    // reply's channel_id equals the route's threadID. react-router scopes this param
    // to the thread route's subtree, so the channel stream never sees it — letting us
    // tell "inside a thread" apart from "inside a channel" without prop-drilling.
    const { threadID } = useParams()
    // Pinned state lives on the channel, and pinning doesn't change the message object —
    // so subscribe to the channel's pinned string here. Without this, reopening the menu
    // on the same (unchanged) message would return the memo's stale "Pin" label.
    const pinnedString = useChannelPinnedString(message?.channel_id ?? "")

    return useMemo(() => {
        if (!message) return []

        const isOwner = currentUser === message.owner && !message.is_bot_message
        const hasReactions = Object.keys(JSON.parse(message.message_reactions || "{}")).length > 0
        const inThread = message.channel_id === threadID

        // Respond: reply + thread creation (join/mute need membership context we don't load here)
        const respond: MessageAction[] = [
            {
                id: "reply",
                label: _("Reply"),
                icon: Reply,
                // Set the channel's reply target; the composer reads it and shows the banner.
                onSelect: () => getDefaultStore().set(replyToMessageAtom(message.channel_id), message),
            },
        ]
        // Create thread only inside a channel: not on a message that already has one
        // (is_thread), and not on a thread reply (inThread). The thread's id IS the
        // message id; a batch threads off its last/newest member (already this target).
        if (!message.is_thread && !inThread) {
            respond.push({
                id: "create-thread",
                label: _("Create thread"),
                icon: MessageSquareText,
                onSelect: () => {
                    const threadID = message.name
                    // Strip any open /thread/... so we navigate from the channel base.
                    const base = window.location.pathname.split("/thread")[0]?.replace(`/${import.meta.env.VITE_BASE_NAME}`, "")
                    call.post("raven.api.threads.create_thread", { message_id: threadID })
                        .then(() => {
                            // Reflect the new thread on the parent (shows the pill) and seed an
                            // empty reply count, then open it.
                            channelMessagesStore.messageEdited(message.channel_id, threadID, { is_thread: 1 })
                            seedThreadMeta(threadID, 0)
                            navigate(`${base}/thread/${threadID}`)
                        })
                        .catch((e) => toast.error(_("Could not create thread"), { description: getErrorMessage(e) }))
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
                const url = `${window.location.origin}${window.location.pathname}?message_id=${encodeURIComponent(message.name)}`
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

        const organize: MessageAction[] = [
            {
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
                        toast.error(isPinned ? _("Could not unpin message") : _("Could not pin message"), { description: getErrorMessage(e) })
                    })
                },
            },
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
                        toast.error(currentlySaved ? _("Could not unsave message") : _("Could not save message"), { description: getErrorMessage(e) })
                    })
                },
            },
        ]
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
                    icon: Pencil,
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

        return [respond, clipboard, organize, owner].filter((group) => group.length > 0)
    }, [message, currentUser, setDialog, navigate, call, threadID, pinnedString])
}
