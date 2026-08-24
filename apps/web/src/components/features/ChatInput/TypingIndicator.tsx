import { useEffect, useMemo, useState } from "react"
import { useFrappeEventListener } from "frappe-react-sdk"
import { useUser } from "@hooks/useUser"
import { useUserCookieData } from "@hooks/useUserCookieData"
import type { UserData } from "@db"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { GroupedAvatars } from "@components/ui/grouped-avatars"
import { useChannelTypers } from "@stores/typing/useChannelTypers"

type AIEventData = { channel_id: string; text?: string; bot?: string }

/**
 * Live "AI is thinking" status for a channel (ported from v2's AIEvent). The
 * backend publishes ai_event / ai_event_clear to the channel's DOC room, which
 * the message store's warm-channel doc_subscribe already joins — no extra room
 * work here, just listeners. Local state (not a store): only the open channel's
 * strip cares, and it resets on channel switch.
 */
const useAIEvent = (channelID: string): { text: string; bot?: string } => {
    const [event, setEvent] = useState<{ text: string; bot?: string }>({ text: "" })

    useFrappeEventListener("ai_event", (data: AIEventData) => {
        if (data?.channel_id === channelID) setEvent({ text: data.text ?? "", bot: data.bot })
    })
    useFrappeEventListener("ai_event_clear", (data: AIEventData) => {
        if (data?.channel_id === channelID) setEvent({ text: "" })
    })

    // The indicator isn't remounted per channel — drop a stale event on switch.
    useEffect(() => {
        setEvent({ text: "" })
    }, [channelID])

    return event
}

/**
 * "X is typing" strip for a channel: stacked avatars of the typers (max 3),
 * their names, and an animated dot wave in place of the literal "…". While an
 * AI bot is working (ai_event), the strip shows the bot's avatar + its status
 * text in a shimmer instead — that takes precedence over human typers.
 *
 * Positioned ABSOLUTE above the composer form — no reserved row (an always-empty
 * strip read as weird dead space), and being out of flow it can never shift
 * layout. The stream's bottom padding (pb-4 on its content) gives the strip a
 * mostly-empty zone to sit in; the pane-colored background while occupied keeps
 * it readable on the rare frame it overlaps a tall last message. Empty, it's
 * invisible and pointer-events-none (never blocks hovering the last message).
 *
 * Stays mounted with the composer even while empty — mounting is what joins
 * the channel's typing room and seeds the list (useChannelTypers). Re-renders
 * only on THIS channel's typer changes (per-channel store subscription); at
 * most three typers are ever resolved, so the hook count stays fixed.
 */
export const TypingIndicator = ({ channelID }: { channelID: string }) => {
    const typers = useChannelTypers(channelID)
    const { name: currentUser } = useUserCookieData()
    const others = useMemo(() => typers.filter((user) => user !== currentUser), [typers, currentUser])
    const aiEvent = useAIEvent(channelID)
    const botUser = useUser(aiEvent.bot)
    // An active AI event owns the strip — the bot is about to reply, which is
    // more useful than knowing a human is also drafting.
    const active = others.length > 0 && !aiEvent.text

    // Exit animation: the RENDERED list lags the live one. While active they're
    // synced; when the live list empties, the last typers stay rendered with the
    // exit classes and are only dropped on animationend — so the strip fades out
    // instead of vanishing. Resuming mid-exit flips straight back to the enter
    // animation (the class swap restarts it).
    const [display, setDisplay] = useState<readonly string[]>([])
    useEffect(() => {
        if (active) setDisplay(others)
    }, [active, others])
    const shown = active ? others : display

    const first = useUser(shown[0])
    const second = useUser(shown[1])
    const third = useUser(shown[2])

    const nameOf = (user: UserData | undefined, id: string) => user?.first_name || user?.full_name || id
    const a = nameOf(first, shown[0])
    const b = nameOf(second, shown[1])
    const text =
        shown.length === 0
            ? ""
            : shown.length === 1
                ? _("{0} is typing", [a])
                : shown.length === 2
                    ? _("{0} and {1} are typing", [a, b])
                    : shown.length === 3
                        ? _("{0}, {1} and 1 other are typing", [a, b])
                        : _("{0}, {1} and {2} others are typing", [a, b, String(shown.length - 2)])

    const occupied = Boolean(aiEvent.text) || shown.length > 0
    return (
        <div
            className={cn(
                // pt-1 is INSIDE the bg-painted box: breathing room above the text,
                // not a transparent slit showing the message underneath.
                "pointer-events-none absolute bottom-full left-0 right-0 z-40 flex py-1 items-center px-3 pt-1 md:px-4",
                occupied && "bg-surface-base",
            )}
            aria-live="polite"
        >
            {aiEvent.text ? (
                <div className="flex min-w-0 items-center gap-2 duration-200 animate-in fade-in slide-in-from-bottom-1">
                    {botUser && <GroupedAvatars users={[botUser]} size="xs" />}
                    <span className="truncate text-xs text-shimmer">{aiEvent.text}</span>
                </div>
            ) : shown.length > 0 && (
                <div
                    className={cn(
                        "flex min-w-0 items-center gap-2 duration-200",
                        active
                            ? "animate-in fade-in slide-in-from-bottom-1"
                            : "animate-out fade-out slide-out-to-bottom-1 fill-mode-forwards",
                    )}
                    onAnimationEnd={(e) => {
                        // Only the strip's own exit animation unmounts it — child
                        // animations (the infinite dots never end, but avatars might
                        // animate) bubble their events up here too.
                        if (e.target === e.currentTarget && !active) setDisplay([])
                    }}
                >
                    <TypingAvatars users={[first, second, third]} />
                    <span className="truncate text-xs leading-snug text-ink-gray-6">{text}</span>
                    <TypingDots />
                </div>
            )}
        </div>
    )
}

/** Overlapping avatar cluster of the (loaded) typers — profiles still being fetched are skipped. */
const TypingAvatars = ({ users }: { users: (UserData | undefined)[] }) => {
    const shown = users.filter((user): user is UserData => !!user)
    if (shown.length === 0) return null
    return <GroupedAvatars users={shown} size="xs" />
}

/** Dot wave (animate-typing-dot in index.css) — subtle lift + fade, staggered per dot. */
const TypingDots = () => (
    <span className="flex shrink-0 items-center gap-0.5 pt-0.5" aria-hidden>
        <span className="size-1 animate-typing-dot rounded-full bg-ink-gray-6" />
        <span className="size-1 animate-typing-dot rounded-full bg-ink-gray-6 [animation-delay:200ms]" />
        <span className="size-1 animate-typing-dot rounded-full bg-ink-gray-6 [animation-delay:400ms]" />
    </span>
)
