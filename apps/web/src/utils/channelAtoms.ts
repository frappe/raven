import { atom } from "jotai";
import { atomFamily } from 'jotai-family'
import type { Message } from "@raven/types/common/Message";

export type DrawerType = '' | 'members' | 'files' | 'pins' | 'links' | 'threads' | 'settings'

export const channelDrawerAtom = atomFamily((_channelID: string) => atom<DrawerType>(''))

/**
 * IDENTITY only, not poll data: the drawer reads the shared ["poll", id] SWR
 * cache (same key as the inline card), so it opens instantly from the warm
 * cache and stays LIVE when poll_update revalidates it. Snapshotting poll
 * data here froze the drawer at open time.
 */
export type PollDrawerData = {
    /** The poll MESSAGE id. */
    messageID: string
} | null

export const pollDrawerAtom = atomFamily((_channelID: string) => atom<PollDrawerData>(null))

/**
 * "Scroll to this message" request for the chat stream (set by a reply click, a
 * ?message_id deep link, or a notification click). The stream scrolls to the message —
 * fetching the page around it first if needed — highlights it, then resets this to null.
 *
 * It's an object (id + timestamp) rather than a plain id string on purpose: setting the
 * same id twice must still count as a new request. With a plain string, clicking the
 * same notification again was a same-value write that React/jotai ignored, so nothing
 * happened. A fresh object always re-triggers the effects.
 */
export type MessageTarget = { id: string; ts: number }

export const messageTargetAtom = atomFamily((_channelID: string) => atom<MessageTarget | null>(null))

/** Always use this to set messageTargetAtom — it mints a fresh object (see above). */
export const makeMessageTarget = (id: string): MessageTarget => ({ id, ts: Date.now() })

/**
 * The message the action menu (desktop context menu / mobile bottom sheet) is
 * acting on. Non-null while the menu is open — the stream highlights it so the
 * user knows which message the actions apply to. Global: one menu app-wide.
 */
export const messageActionTargetAtom = atom<Message | null>(null)

/**
 * The message id currently being PRESSED on mobile — set a beat after touch-down
 * (so scrolls and quick taps never flash) and cleared on lift/drift. The stream
 * highlights it the same way as the action target, so a long-press visibly grabs
 * its message while you're still holding, before the sheet opens.
 */
export const messagePressTargetAtom = atom<string | null>(null)

/**
 * The message the composer is replying to, per channel. Set by the Reply action;
 * the composer shows a preview banner and sends it as `linked_message`, then clears
 * this on send or cancel. Per-channel so a reply drafted in one channel doesn't leak
 * into another.
 */
export const replyToMessageAtom = atomFamily((_channelID: string) => atom<Message | null>(null))

/**
 * The message currently being edited inline, per channel (its id, or null). The
 * message body renderer swaps `RichTextRenderer` for an inline editor when its id
 * matches. Per-channel so an edit in one channel doesn't bleed into another. For a
 * batch this targets the caption-bearing member (the only editable text).
 */
export const editingMessageAtom = atomFamily((_channelID: string) => atom<string | null>(null))

export type MessageDialogType = "delete" | "forward" | "reactions"

/**
 * The currently open message dialog. Separate from the menu target because
 * dialogs outlive the menu (menu closes, dialog stays) and can also be opened
 * from the future hover toolbar or keyboard shortcuts.
 */
export const messageDialogAtom = atom<{ type: MessageDialogType; message: Message } | null>(null)