import { useMemo, useRef } from "react"
import { useSetAtom } from "jotai"
import { useLiveQuery } from "dexie-react-hooks"
import { SmilePlus } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import { db } from "@db"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { messageDialogAtom } from "@utils/channelAtoms"
import { hapticTick } from "@utils/haptics"
import { ReactionObject } from "@raven/types/common/ChatStream"
import type { Message } from "@raven/types/common/Message"
import { useToggleReaction } from "../actions/useToggleReaction"
import { ReactionPicker } from "../actions/ReactionPicker"
import _ from "@lib/translate"

/** Hold a pill this long (touch) to open the who-reacted view instead of toggling. */
const LONG_PRESS_MS = 450
/** Finger drift beyond this cancels the long-press — it's a scroll, not a hold. */
const LONG_PRESS_SLOP_PX = 10
/** Suppress the synthetic click for this long after the long-press fires. */
const LONG_PRESS_CLICK_GUARD_MS = 500

/**
 * `message_reactions` is stored as a JSON string keyed per reaction:
 * `{ "❤️": { reaction, users, count, is_custom }, ... }`.
 * For standard emojis the key IS the emoji; for custom emojis the key is the
 * emoji's name and `reaction` holds its image URL (verified on live data).
 */
export const parseReactions = (raw?: string | null): ReactionObject[] => {
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw) as Record<string, ReactionObject>
        return Object.entries(parsed).map(([emojiName, reaction]) => ({
            ...reaction,
            emoji_name: emojiName,
        }))
    } catch {
        return []
    }
}

/**
 * The reaction pills under a message. Render-only for now — clicking will
 * toggle the reaction in layer 5 (optimistic store patch → API → resync).
 *
 * Returns null when the message has no reactions, so it can sit unconditionally
 * at the bottom of every message's content. Reaction data arrives inside the
 * message payload, so the row's height is known the moment the block renders —
 * no post-paint growth (stream height invariant).
 */
export const MessageReactionsRow = ({ message }: { message: Message }) => {
    const reactions = useMemo(() => parseReactions(message.message_reactions), [message.message_reactions])
    const { name: currentUser } = useUserCookieData()
    const toggleReaction = useToggleReaction()
    const setDialog = useSetAtom(messageDialogAtom)

    if (reactions.length === 0) return null

    return (
        <div className="flex select-none flex-wrap gap-1.5 pt-0.5" role="group" aria-label={_("Message reactions")}>
            {reactions.map((reaction) => (
                <ReactionButton
                    key={reaction.emoji_name}
                    reaction={reaction}
                    isUserReacted={reaction.users.includes(currentUser)}
                    onToggle={() => toggleReaction(message, reaction.reaction, reaction.is_custom, reaction.emoji_name)}
                    // Mobile: long-pressing a pill opens who-reacted (tooltips need hover)
                    onLongPress={() => setDialog({ type: "reactions", message })}
                />
            ))}
            <AddReactionButton message={message} />
        </div>
    )
}

const ReactionButton = ({
    reaction,
    isUserReacted,
    onToggle,
    onLongPress,
}: {
    reaction: ReactionObject
    isUserReacted: boolean
    onToggle: () => void
    onLongPress: () => void
}) => {
    // Touch long-press → who-reacted view (desktop sees names in the tooltip).
    // Same detector pattern as MessageActionMenu: iOS never fires contextmenu.
    const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null)
    const suppressClickUntilRef = useRef(0)

    const cancelPress = () => {
        if (!pressRef.current) return
        window.clearTimeout(pressRef.current.timer)
        pressRef.current = null
    }

    const onPointerDown = (event: React.PointerEvent) => {
        if (event.pointerType !== "touch") return
        // Keep the MESSAGE-level long-press (action sheet) from also arming —
        // holding a pill should open who-reacted, not both surfaces. This also
        // means a reply-swipe can't start on a pill, which is fine: pills are
        // small and the rest of the row still swipes.
        event.stopPropagation()
        cancelPress()
        const timer = window.setTimeout(() => {
            pressRef.current = null
            // The click that follows finger-lift must not TOGGLE the reaction
            // the user was only inspecting.
            suppressClickUntilRef.current = performance.now() + LONG_PRESS_CLICK_GUARD_MS
            hapticTick()
            onLongPress()
        }, LONG_PRESS_MS)
        pressRef.current = { timer, x: event.clientX, y: event.clientY }
    }

    const onPointerMove = (event: React.PointerEvent) => {
        const press = pressRef.current
        if (!press) return
        if (Math.abs(event.clientX - press.x) > LONG_PRESS_SLOP_PX || Math.abs(event.clientY - press.y) > LONG_PRESS_SLOP_PX) {
            cancelPress()
        }
    }

    const onClick = (event: React.MouseEvent) => {
        if (performance.now() < suppressClickUntilRef.current) {
            suppressClickUntilRef.current = 0
            event.preventDefault()
            event.stopPropagation()
            return
        }
        onToggle()
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {/* A reaction pill is an interactive Badge, not a Button — the
                    smallest Button (h-7, px-2, gap-2, text-base) is the wrong
                    anatomy for a dense chip. Chrome borrowed from Gameplan's
                    reaction pills, with its raw amber-700/amber-200 colors
                    mapped to their Espresso token equivalents. */}
                <button
                    type="button"
                    className={cn(
                        "flex cursor-pointer items-center justify-center gap-1 rounded-full px-2 py-1 text-sm outline-none transition focus-visible:focus-ring",
                        isUserReacted
                            ? "bg-surface-violet-2 dark:bg-surface-gray-4 text-ink-violet-9 dark:text-ink-gray-9 hover:bg-surface-violet-3 dark:hover:bg-surface-gray-5"
                            : "bg-surface-gray-2 text-ink-gray-6 hover:bg-surface-gray-3",
                    )}
                    onClick={onClick}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={cancelPress}
                    onPointerCancel={cancelPress}
                    onPointerLeave={cancelPress}
                    aria-label={_("{0}, {1} reactions", [reaction.emoji_name, String(reaction.count)])}
                    aria-pressed={isUserReacted}
                >
                    {reaction.is_custom ? (
                        <img
                            src={reaction.reaction}
                            alt={reaction.emoji_name}
                            loading="lazy"
                            className="h-4.5 w-4.5 object-contain"
                            aria-hidden="true"
                        />
                    ) : (
                        // em-emoji renders from the Apple set (initialized in
                        // App.tsx) so reactions look the same on every platform
                        <span className="flex h-4.5 w-4.5 items-center justify-center" aria-hidden="true">
                            <em-emoji native={reaction.reaction} set="native" size="1.1em" fallback={reaction.reaction} />
                        </span>
                    )}
                    <span>{reaction.count}</span>
                </button>
            </TooltipTrigger>
            <TooltipContent>
                {/* Mounted only while the tooltip is open, so the user-name
                    lookup costs nothing while scrolling the stream */}
                <ReactionTooltipLabel reaction={reaction} />
            </TooltipContent>
        </Tooltip>
    )
}

/**
 * Sits at the end of the pill row (so it only appears on messages that already
 * have reactions — the hover toolbar is the entry point everywhere else, same
 * as v2).
 */
const AddReactionButton = ({ message }: { message: Message }) => {
    return (
        <ReactionPicker message={message} tooltip={_("Add reaction")} side="top" align="start">
            <button
                type="button"
                className="flex cursor-pointer items-center justify-center rounded-full px-2 py-1 text-ink-gray-5 outline-none transition bg-surface-gray-2 hover:bg-surface-gray-3 hover:text-ink-gray-7 focus-visible:focus-ring"
                aria-label={_("Add reaction")}
            >
                <SmilePlus className="h-4 w-4" aria-hidden="true" />
            </button>
        </ReactionPicker>
    )
}

/**
 * People scan reactions to see WHO reacted, so the tooltip names everyone
 * ("You" first), only falling back to "and N others" past 50 names — same
 * policy as v2's getUsers.
 *
 * Resolves reactor ids to display names lazily — this component only exists
 * while its tooltip is open, so the stream renders no per-message user
 * subscriptions (the same reasoning as useMessageRowLookups, inverted:
 * instead of one shared Map, defer the lookup until it's actually needed).
 */
const ReactionTooltipLabel = ({ reaction }: { reaction: ReactionObject }) => {
    const { name: currentUser } = useUserCookieData()
    // "You" leads the list when present, like v2 (and most chat apps)
    const orderedIds = [...reaction.users].sort((a, b) => (a === currentUser ? -1 : b === currentUser ? 1 : 0))
    const users = useLiveQuery(() => db.users.bulkGet(orderedIds), [reaction.users, currentUser])

    const names = orderedIds.map((userId, index) => {
        if (userId === currentUser) return _("You")
        return users?.[index]?.full_name ?? userId
    })

    return <p className="max-w-96">{_("{0} reacted with {1}", [formatNameList(names), reaction.emoji_name])}</p>
}

/** Maximum names spelled out before collapsing the rest into "and N others". */
const MAX_NAMED_REACTORS = 50

/** "A" / "A and B" / "A, B and C" / past the cap: "A, B, …, and 3 others" */
const formatNameList = (names: string[]): string => {
    if (names.length === 0) return ""
    if (names.length === 1) return names[0]
    if (names.length > MAX_NAMED_REACTORS) {
        const named = names.slice(0, MAX_NAMED_REACTORS).join(", ")
        return _("{0} and {1} others", [named, String(names.length - MAX_NAMED_REACTORS)])
    }
    return _("{0} and {1}", [names.slice(0, -1).join(", "), names[names.length - 1]])
}
