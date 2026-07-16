import { HoverCard, HoverCardContent, HoverCardTrigger } from "@components/ui/hover-card";
import { ScrollArea } from "@components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip";
import { UserAvatar } from "@components/features/message/UserAvatar";
import { getDateObject } from "@lib/date";
import { timeFormatAtom } from "@utils/preferences";
import { useUsersById } from "@hooks/useMessageRowLookups";
import _ from "@lib/translate";
import { useAtomValue } from "jotai";
import React, { useMemo } from "react";

interface SystemMessageProps {
    /** The server's plain-English text — the fallback when there's no payload. */
    message: string
    time: string
    /** Structured payload (the Raven Message `json` field) — string or object. */
    data?: string | Record<string, unknown> | null
}

/**
 * Known structured system-message events, as a discriminated union — `switch` on
 * `event` and TypeScript narrows the fields per case. All ids are Raven User ids,
 * resolved to live names at render. Unknown events fall back to `message`.
 */
type SystemMessageData =
    | { event: "members_added"; added_by: string; members: string[] }
    | { event: "user_joined"; user: string }
    | { event: "user_left"; user: string }
    | { event: "member_removed"; removed_by: string; user: string; new_admin?: string }
    | { event: "admin_status_changed"; user: string; is_admin: boolean }
    | { event: "channel_created"; user: string; channel_name?: string }
    | { event: "thread_created"; user: string }

const parseData = (data: SystemMessageProps["data"]): SystemMessageData | null => {
    if (!data) return null
    try {
        const parsed = typeof data === "object" ? data : JSON.parse(data)
        // The payload comes over the wire — the cast asserts the SHAPE; the switch
        // below only trusts the `event` discriminant and degrades gracefully on
        // missing fields (resolveName handles undefined).
        return typeof parsed?.event === "string" ? (parsed as SystemMessageData) : null
    } catch {
        return null
    }
}

/**
 * System messages ("X joined", "X added Y…"). When the message carries a
 * structured `json` payload, the string is built CLIENT-SIDE — translated, with
 * live user names resolved from the users store. Messages without a payload
 * (older messages, unknown events) render the server's plain text as-is.
 */
const SystemMessage: React.FC<SystemMessageProps> = ({ message, time, data }) => {
    const timeFormat = useAtomValue(timeFormatAtom)
    const usersById = useUsersById()

    const text = useMemo((): React.ReactNode => {
        const structured = parseData(data)
        const resolveName = (id?: string) => (id ? usersById.get(id)?.full_name || id : "")
        if (!structured) return message

        switch (structured.event) {
            case "members_added": {
                if (!structured.members?.length) return message
                const adder = resolveName(structured.added_by)
                const names = structured.members.map(resolveName)
                if (names.length === 1) return _("{0} added {1}.", [adder, names[0]])
                if (names.length <= 3) {
                    return _("{0} added {1} and {2}.", [adder, names.slice(0, -1).join(", "), names[names.length - 1]])
                }
                // Long lists: "…and N others" is a hover card revealing who the others
                // are (ids from the payload, names resolved live). The sentence is split
                // around the trigger, so it's composed from two translated fragments.
                const restIDs = structured.members.slice(3)
                return (
                    <>
                        {_("{0} added {1} and", [adder, names.slice(0, 3).join(", ")])}{" "}
                        <HoverCard openDelay={200}>
                            <HoverCardTrigger asChild>
                                <span className="cursor-default underline decoration-outline-gray-3 decoration-dotted underline-offset-2">
                                    {_("{0} others", [String(restIDs.length)])}
                                </span>
                            </HoverCardTrigger>
                            {/* stopPropagation: wheel inside the card must scroll the card,
                                not the chat stream underneath. */}
                            <HoverCardContent align="start" className="w-56 p-2" onWheel={(e) => e.stopPropagation()}>
                                <ScrollArea viewportClassName="max-h-64">
                                    <div className="flex flex-col gap-2.5 py-0.5 pr-1">
                                        {restIDs.map((id) => {
                                            const user = usersById.get(id)
                                            return (
                                                <div key={id} className="flex items-center gap-2">
                                                    {user && <UserAvatar user={user} size="xs" className="shrink-0" showStatusIndicator={false} />}
                                                    <span className="truncate text-sm text-ink-gray-7">{user?.full_name || id}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </ScrollArea>
                            </HoverCardContent>
                        </HoverCard>
                        .
                    </>
                )
            }
            case "user_joined":
                return _("{0} joined.", [resolveName(structured.user)])
            case "user_left":
                return _("{0} left.", [resolveName(structured.user)])
            case "member_removed":
                if (structured.new_admin) {
                    return _("{0} was removed by {1} and {2} is the new admin of this channel.", [
                        resolveName(structured.user),
                        resolveName(structured.removed_by),
                        resolveName(structured.new_admin),
                    ])
                }
                return _("{0} removed {1}.", [resolveName(structured.removed_by), resolveName(structured.user)])
            case "admin_status_changed":
                return structured.is_admin
                    ? _("{0} is now an admin.", [resolveName(structured.user)])
                    : _("{0} is no longer an admin.", [resolveName(structured.user)])
            case "channel_created":
                return structured.channel_name
                    ? _("{0} created {1}.", [resolveName(structured.user), structured.channel_name])
                    : _("{0} created this channel.", [resolveName(structured.user)])
            case "thread_created":
                return _("{0} created this thread.", [resolveName(structured.user)])
            default:
                // Unknown event (newer server than client?) — the plain text still works.
                return message
        }
    }, [data, message, usersById])

    const { shortTime, longTime } = useMemo(() => {
        try {
            const dateObj = getDateObject(time)
            return {
                shortTime: dateObj.format(timeFormat === "12-hour" ? "hh:mm a" : "HH:mm"),
                longTime: dateObj.format(timeFormat === "12-hour" ? "Do MMMM YYYY, hh:mm a" : "Do MMMM YYYY, HH:mm"),
            }
        }
        catch (error) {
            return {
                shortTime: time,
                longTime: time,
            }
        }
    }, [time])
    return (
        <div className="flex flex-row gap-3 px-3.5 py-2 items-baseline">
            <Tooltip delayDuration={300}>
                {/* shrink-0 + nowrap: as a flex item next to long message text, the
                    trigger (a native button) was squeezed to min-content — wrapping
                    "09:41 am" at the space and centering the two lines (buttons
                    center text by default). No fixed width needed: zero-padded
                    hh:mm + tabular-nums already make every timestamp equal width. */}
                <TooltipTrigger className="shrink-0 whitespace-nowrap">
                    <span className="text-xs text-ink-gray-4 tabular-nums">{shortTime}</span>
                </TooltipTrigger>

                <TooltipContent>
                    {longTime}
                </TooltipContent>
            </Tooltip>
            <span className="text-p-xs text-ink-gray-5">{text}</span>
        </div>
    )
}

export default SystemMessage
