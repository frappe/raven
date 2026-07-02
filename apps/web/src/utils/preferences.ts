import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

export type ChatStyle = "Simple" | "Left-Right"
export type TimeFormat = "12-hour" | "24-hour"

/**
 * Message layout: "Simple" keeps every message left (Slack-style); "Left-Right" pushes your
 * own messages to the right (iMessage-style). This is a SERVER preference (Raven User), not a
 * client one — so it's seeded from boot (correct on first paint) rather than localStorage, and
 * the Appearance switcher sets it for a live change without reload. Read it with a single
 * useAtomValue in the message rows.
 */
export const chatStyleAtom = atom<ChatStyle>((window.frappe?.boot?.chat_style as ChatStyle | undefined) ?? "Simple")

/**
 * Time format: "12-hour" displays times like "12:00 PM"; "24-hour" displays times like "12:00" in all messages.
 */
export const timeFormatAtom = atom<TimeFormat>((window.frappe?.boot?.time_format as TimeFormat | undefined) ?? "12-hour")


export const imageGroupingLayoutAtom = atomWithStorage<"stack" | "grid">("raven-image-grouping-layout", "stack")

export type EnterKeyBehaviour = "new-line" | "send-message"

/**
 * What the Enter key does in the composer. "send-message" (default): Enter sends,
 * Shift+Enter / Cmd+Enter inserts a newline. "new-line": Enter inserts a newline,
 * Cmd/Ctrl+Enter sends. Persisted in localStorage; key/format match v2 so the
 * preference carries over. getOnInit reads the stored value on first render so the
 * editor honours it immediately.
 */
export const EnterKeyBehaviourAtom = atomWithStorage<EnterKeyBehaviour>(
    "raven-enter-key-behaviour",
    "send-message",
    undefined,
    { getOnInit: true },
)

interface QuickEmoji {
    id: string
    src?: string,
    native?: string
}

/** Favourite emojis offered as one-tap message reactions. */
export const QuickEmojisAtom = atomWithStorage<QuickEmoji[]>("raven-quick-emojis-list", [{ id: "👍", native: "👍" }, { id: "✅", native: "✅" }, { id: "👀", native: "👀" }, { id: "🎉", native: "🎉" }])
