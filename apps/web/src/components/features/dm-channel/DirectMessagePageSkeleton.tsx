import type { ReactNode } from "react"
import { useAtomValue } from "jotai"
import { Skeleton } from "@components/ui/skeleton"
import { Island } from "@components/layout/Island"
import { ComposerSkeleton } from "@components/features/ChatInput/composerGate"
import { chatStyleAtom } from "@utils/preferences"

/**
 * One placeholder message row. With `leftRight`, every third row becomes an
 * own-message bubble on the right, matching the Left-Right chat layout the
 * real rows will render in (boot carries the preference, so it's known
 * before any data loads).
 */
const MessageRowSkeleton = ({ index, leftRight }: { index: number; leftRight: boolean }) => {
    if (leftRight && index % 3 === 1) {
        return (
            <div className="flex justify-end">
                <Skeleton className="h-10 rounded-lg" style={{ width: `${30 + (index % 4) * 8}%` }} />
            </div>
        )
    }
    return (
        <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3 w-14" />
                </div>
                <Skeleton className="h-4" style={{ width: `${45 + (index % 4) * 15}%` }} />
                {index % 2 === 0 && <Skeleton className="h-4" style={{ width: "70%" }} />}
            </div>
        </div>
    )
}

/**
 * Skeleton for a whole conversation page, mirroring ChatContentView's anatomy —
 * canvas gutter, then the chat Island with header / stream / composer — so the
 * real page swaps in without anything shifting. The pages pass the identity
 * placeholder their real header shows: a round avatar for a DM, a channel icon.
 */
const ChatPageSkeleton = ({ identity }: { identity: ReactNode }) => {
    const leftRight = useAtomValue(chatStyleAtom) === "Left-Right"

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-row gap-1 p-0 md:p-1">
            <Island className="flex-1">
                {/* Header — the chat headers' frame (h-11, bottom border). The
                    back button exists on mobile only, like the real one. */}
                <div className="flex h-11 w-full shrink-0 items-center justify-between border-b border-outline-gray-2 px-4">
                    <div className="flex min-w-0 items-center gap-2">
                        <Skeleton className="size-8 shrink-0 md:hidden" />
                        {identity}
                        <Skeleton className="h-4 w-32" />
                    </div>
                    {/* The members cluster on the right. */}
                    <Skeleton className="h-6 w-16 rounded-full" />
                </div>

                {/* Stream — anchored to the BOTTOM, because that's where a chat
                    opens (latest messages against the composer). Extra rows clip
                    at the top, so tall screens still look full. */}
                <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
                    <div className="flex w-full flex-col space-y-4 p-4 md:px-3">
                        {Array.from({ length: 9 }).map((_, i) => (
                            <MessageRowSkeleton key={i} index={i} leftRight={leftRight} />
                        ))}
                    </div>
                </div>

                {/* The composer gate's own skeleton, so both render identically. */}
                <div className="shrink-0">
                    <ComposerSkeleton />
                </div>
            </Island>
        </div>
    )
}

/** Skeleton for the Direct Message page: a round peer avatar in the header. */
export function DirectMessagePageSkeleton() {
    return <ChatPageSkeleton identity={<Skeleton className="h-7 w-7 rounded-full shrink-0" />} />
}

/** Skeleton for the channel page: a small channel icon in the header, no avatar. */
export function ChannelPageSkeleton() {
    return <ChatPageSkeleton identity={<Skeleton className="h-4 w-4 shrink-0" />} />
}

/**
 * Skeleton rows for the message list only (use when the header is already
 * visible and messages are loading). `followsChatStyle` mixes in right-aligned
 * own-message bubbles when the user prefers the Left-Right layout — pass it
 * where the CONVERSATION renders (ChatStream), never in the always-left lists
 * (search results, saved, threads).
 */
export function MessageListSkeleton({ followsChatStyle = false }: { followsChatStyle?: boolean }) {
    const leftRight = useAtomValue(chatStyleAtom) === "Left-Right"
    return (
        <div className="flex w-full flex-1 flex-col lg:mx-auto p-4 px-3 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
                <MessageRowSkeleton key={i} index={i} leftRight={followsChatStyle && leftRight} />
            ))}
        </div>
    )
}
