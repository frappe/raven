import { atom, getDefaultStore } from "jotai"
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
export const timeFormatAtom = atom<TimeFormat>((window.frappe?.boot?.raven_time_format as TimeFormat | undefined) ?? "12-hour")

/**
 * Whether the user hides read receipts (two-way: theirs are invisible AND
 * they can't view others' — enforced server-side in get_message_readers).
 * Seeded from boot and written by the Preferences panel on toggle, so hot
 * paths (the message action menu) read a plain atom instead of subscribing
 * to the profile SWR cache. Stored on Raven User as `hide_read_receipts`.
 */
export const hideReadReceiptsAtom = atom<boolean>(Boolean(window.frappe?.boot?.raven_hide_read_receipts))

export type QuietHoursNudge = "Nudge" | "No Nudge" | "Auto Silent"

/**
 * What the composer does when sending OUTSIDE the org's working hours:
 * "Nudge" suggests a silent send, "Auto Silent" makes silent the default,
 * "No Nudge" leaves sends alone. Only meaningful when the org configured
 * quiet hours (see getQuietHoursConfig — no config, no behavior). Stored on
 * Raven User as `quiet_hours_nudge`; seeded from boot and written by the
 * Preferences panel, so the send path reads a plain atom.
 */
export const quietHoursNudgeAtom = atom<QuietHoursNudge>(
    (window.frappe?.boot?.raven_quiet_hours_nudge as QuietHoursNudge | undefined) ?? "Nudge",
)

export type QuietHoursConfig = {
    /** "HH:MM:SS" in the org's timezone (= SYSTEM_TIMEZONE from boot). */
    working_hours_start: string
    working_hours_end: string
}

/**
 * The org's quiet-hours config, or null when the feature is off. Seeded from
 * boot; the admin working-hours dialog writes it on save, so an admin's own
 * session applies the change live (banner, send default, preferences row)
 * without a reload. Other members pick it up on their next boot.
 */
export const quietHoursConfigAtom = atom<QuietHoursConfig | null>(
    (window.frappe?.boot?.quiet_hours as QuietHoursConfig | undefined) ?? null,
)

/** Non-hook reader for the plain evaluator functions (utils/quietHours.ts).
 *  Components that must REACT to changes subscribe to the atom instead. */
export const getQuietHoursConfig = (): QuietHoursConfig | null => getDefaultStore().get(quietHoursConfigAtom)


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

export interface QuickEmoji {
    id: string
    src?: string,
    native?: string
}

/** Favourite emojis offered as one-tap message reactions. */
export const QuickEmojisAtom = atomWithStorage<QuickEmoji[]>("raven-quick-emojis-list", [
    { id: "👍", native: "👍" },
    { id: "✅", native: "✅" },
    { id: "👀", native: "👀" },
    { id: "🎉", native: "🎉" },
    { id: "🔥", native: "🔥" },
    { id: "🤔", native: "🤔" },
])

/**
 * The reaction toggled by double-tapping a message on mobile. getOnInit so the
 * first double-tap after load already uses the stored choice.
 */
export const DoubleTapReactionAtom = atomWithStorage<QuickEmoji>(
    "raven-double-tap-reaction",
    { id: "👍", native: "👍" },
    undefined,
    { getOnInit: true },
)
