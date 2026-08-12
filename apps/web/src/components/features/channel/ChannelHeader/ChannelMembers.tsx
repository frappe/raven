import { useMemo } from "react"
import { GroupedAvatars } from "@components/ui/grouped-avatars"
import { Skeleton } from "@components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useChannelMembers } from "@hooks/useChannelMembers"
import _ from "@lib/translate"

interface ChannelMembersProps {
    onClick?: () => void
    channelID: string
}

const ChannelMembers = ({ onClick, channelID }: ChannelMembersProps) => {

    const { members, isLoading } = useChannelMembers(channelID)

    // Shuffled, not the first few: the members list is sorted alphabetically, so
    // every channel header would otherwise show the same faces (whoever sorts
    // first). Seeded by the channel id (not Math.random), so a given channel shows
    // the SAME mix on every visit — varied across channels, stable within one.
    const shuffledMembers = useMemo(() => {
        let seed = 0
        for (let i = 0; i < channelID.length; i++) seed = (seed * 31 + channelID.charCodeAt(i)) | 0
        // mulberry32 — tiny deterministic PRNG over the seed above.
        const random = () => {
            seed = (seed + 0x6d2b79f5) | 0
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
        const shuffled = [...members]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1))
                ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
    }, [members, channelID])

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    onClick={onClick}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                    {isLoading ?
                        <div className="flex items-center -space-x-2">
                            <Skeleton className="size-7 rounded-full" />
                            <Skeleton className="size-7 rounded-full" />
                            <Skeleton className="size-7 rounded-full" />
                            <Skeleton className="size-7 rounded-full" />
                        </div>
                        : <GroupedAvatars size="sm" users={shuffledMembers} />}
                </div>
            </TooltipTrigger>
            <TooltipContent>
                {_("Channel Members")}
            </TooltipContent>
        </Tooltip>
    )
}

export default ChannelMembers