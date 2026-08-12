import type { Message } from "@raven/types/common/Message"
import { getDateObject } from "@lib/date"
import { isThreadParent } from "@utils/messageUtils"
import { ChannelMessagesState, DateBlock, MessageBatchBlock, StreamBlock, UnreadBlock } from "./types"

/**
 * Derives the render list for the chat stream: messages in ascending order,
 * decorated with continuation/pinned flags, with date dividers between days.
 *
 * Memoized two ways:
 * - per state object: recomputes only when the channel state actually changed
 * - per message: a message whose flags didn't change keeps its object identity,
 *   so memoized message components skip re-rendering
 */

const CONTINUATION_GAP_MS = 2 * 60 * 1000

type Decoration = { isContinuation: 0 | 1; isPinned: 0 | 1; decorated: Message }

/**
 * Remembers the decorated copy produced for each store message, so a message
 * whose flags didn't change returns the SAME object across selector runs.
 * That identity is what lets a memoized message component skip re-rendering
 * when some other message in the channel changed.
 *
 * WeakMap, not Map: entries are garbage-collected together with the store
 * message they key on, so evicted/trimmed messages don't leak memory.
 */
const decorationCache = new WeakMap<Message, Decoration>()

/** Returns `message` with continuation/pinned flags applied, reusing the cached copy when the flags are unchanged. */
const decorate = (message: Message, isContinuation: 0 | 1, isPinned: 0 | 1): Message => {
    const cached = decorationCache.get(message)
    if (cached && cached.isContinuation === isContinuation && cached.isPinned === isPinned) {
        return cached.decorated
    }
    const decorated = { ...message, is_continuation: isContinuation, is_pinned: isPinned }
    decorationCache.set(message, { isContinuation, isPinned, decorated })
    return decorated
}

/** Who a message visually belongs to. System messages have no sender, so they never group. */
const senderOf = (message: Message): string | null => {
    if (message.message_type === "System") return null
    return message.is_bot_message ? (message.bot ?? null) : message.owner
}

/** The day a message belongs to (`YYYY-MM-DD`), straight from the timestamp string. */
const dateKeyOf = (message: Message): string => message.creation.split(" ")[0]

/** Epoch millis for gap comparisons. Microseconds are stripped — Safari can't parse them. */
const timeOf = (message: Message): number => new Date(message.creation.split(".")[0]).getTime()

const dateBlockFor = (dateKey: string): DateBlock => ({
    message_type: "date",
    creation: getDateObject(`${dateKey} 00:00:00`).format("Do MMMM YYYY"),
    name: `date-${dateKey}`,
})

/** Singleton — the divider carries no data, so one shared (stable) reference is enough. */
const UNREAD_BLOCK: UnreadBlock = { message_type: "unread", name: "unread-divider" }

/** A message continues the previous one when same sender, same day, within the gap. */
const isContinuationOf = (message: Message, previous: Message | null): boolean => {
    if (!previous) return false
    // A thread parent is a continuation boundary in BOTH directions: it carries
    // avatar-anchored thread decorations (header, participant button, connector
    // line) that need a full header to attach to, and its trailing thread
    // button visually closes the block — so nothing continues from it either.
    if (isThreadParent(message) || isThreadParent(previous)) return false
    if (dateKeyOf(message) !== dateKeyOf(previous)) return false
    const sender = senderOf(message)
    if (sender === null || sender !== senderOf(previous)) return false
    return timeOf(message) - timeOf(previous) <= CONTINUATION_GAP_MS
}

/** The channel's pinned message ids (newline-separated) as a set. Shared so the pin
 *  action toggles exactly what the stream decorates as pinned. */
export const parsePinnedIds = (pinnedMessagesString: string | null | undefined): Set<string> => {
    return new Set(
        (pinnedMessagesString ?? "")
            .split("\n")
            .map((id) => id.trim())
            .filter(Boolean),
    )
}

/** Messages batch together when sent as one batch by one sender on one day. */
const isBatchMemberOf = (message: Message, head: Message): boolean => {
    return (
        message.message_batch_id === head.message_batch_id &&
        senderOf(message) === senderOf(head) &&
        dateKeyOf(message) === dateKeyOf(head)
    )
}

const buildBlocks = (
    state: ChannelMessagesState,
    pinnedMessagesString: string,
    firstUnreadMessage: string | null,
): StreamBlock[] => {
    const pinnedIds = parsePinnedIds(pinnedMessagesString)
    const messages: Message[] = []
    for (const id of state.order) {
        const message = state.byId.get(id)
        if (message) messages.push(message)
    }

    // The "New messages" divider goes before the first unread message, identified by the
    // FROZEN id captured at entry (not a live timestamp) — so a message you send, or one that
    // arrives while you're watching, never moves or spawns the line. -1 when caught up.
    const firstUnreadIndex = firstUnreadMessage ? messages.findIndex((m) => m.name === firstUnreadMessage) : -1

    const blocks: StreamBlock[] = []
    let previous: Message | null = null
    let unreadInserted = false
    for (let index = 0; index < messages.length; index++) {
        const message = messages[index]
        const dateKey = dateKeyOf(message)
        if (!previous || dateKeyOf(previous) !== dateKey) {
            blocks.push(dateBlockFor(dateKey))
        }
        // First block at/after the unread anchor → drop the divider in (after any date block).
        if (!unreadInserted && firstUnreadIndex !== -1 && index >= firstUnreadIndex) {
            blocks.push(UNREAD_BLOCK)
            unreadInserted = true
        }
        const isContinuation = isContinuationOf(message, previous) ? 1 : 0

        // Consume a run of consecutive same-batch messages into one block
        if (message.message_batch_id) {
            const members = [message]
            while (index + 1 < messages.length && isBatchMemberOf(messages[index + 1], message)) {
                members.push(messages[++index])
            }

            // A batch with 2+ thread parents splits into individual messages so
            // every thread's pill is visible — the rare case of a v2 client (no
            // batching) threading multiple members of a v3 batch. With 0–1
            // threads it stays grouped (the block shows a pill when its NEWEST
            // member is the thread — that's the action target — see BatchMessageItem).
            const threadParents = members.reduce((count, member) => count + (isThreadParent(member) ? 1 : 0), 0)

            if (members.length > 1 && threadParents >= 2) {
                // Re-emit members individually with per-member continuation, so
                // thread parents (and the message after one) break the run.
                let runPrevious: Message | null = previous
                for (const member of members) {
                    const memberContinuation = isContinuationOf(member, runPrevious) ? 1 : 0
                    blocks.push(decorate(member, memberContinuation, pinnedIds.has(member.name) ? 1 : 0))
                    runPrevious = member
                }
                previous = runPrevious
                continue
            }

            if (members.length > 1) {
                const batch: MessageBatchBlock = {
                    message_type: "batch",
                    name: `batch-${message.message_batch_id}`,
                    creation: message.creation,
                    messages: members.map((member) =>
                        decorate(member, isContinuation, pinnedIds.has(member.name) ? 1 : 0),
                    ),
                    is_continuation: isContinuation,
                }
                blocks.push(batch)
                // The next message's continuation compares against the batch's last member
                previous = members[members.length - 1]
                continue
            }
        }

        blocks.push(decorate(message, isContinuation, pinnedIds.has(message.name) ? 1 : 0))
        previous = message
    }
    return blocks
}

type CacheEntry = { pinnedMessagesString: string; firstUnreadMessage: string | null; blocks: StreamBlock[] }

/**
 * One cached result per state object. State objects are immutable — a new one
 * is created on every change — so "same state reference" safely means
 * "nothing changed, return the previous array". Keyed weakly so old state
 * snapshots and their block arrays are garbage-collected.
 */
const blocksCache = new WeakMap<ChannelMessagesState, CacheEntry>()

export const selectStreamBlocks = (
    state: ChannelMessagesState,
    // null-safe: channels with no pins store NULL in the DB, and a `= ""`
    // parameter default only kicks in for undefined, not null
    pinnedMessagesString?: string | null,
): StreamBlock[] => {
    const pinned = pinnedMessagesString ?? ""
    const firstUnread = state.firstUnreadMessage
    const cached = blocksCache.get(state)
    if (cached && cached.pinnedMessagesString === pinned && cached.firstUnreadMessage === firstUnread)
        return cached.blocks
    const blocks = buildBlocks(state, pinned, firstUnread)
    blocksCache.set(state, { pinnedMessagesString: pinned, firstUnreadMessage: firstUnread, blocks })
    return blocks
}
