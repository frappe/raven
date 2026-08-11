import { CommandGroup, CommandItem } from '@components/ui/command'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { useNavigate } from 'react-router-dom'
import { useSetAtom } from 'jotai'
import { commandMenuOpenAtom } from './atoms'
import { useMemo } from 'react'
import { defaultFilter } from 'cmdk'
import _ from '@lib/translate'
import { Badge } from '@components/ui/badge'
import { useChannels } from "@stores/channels/useChannelList"
import { useIsMobile } from '@hooks/use-mobile'

/** Cap on candidates handed to cmdk: it scores + React reconciles every item per keystroke,
 *  so an unbounded list janks at thousands of channels. Nobody scrolls past ~50 results. */
const MAX_RESULTS = 50

const ChannelList = ({ text }: { text: string }) => {
    const { channels } = useChannels()
    const navigate = useNavigate()
    const setOpen = useSetAtom(commandMenuOpenAtom)
    const isMobile = useIsMobile()

    const filteredChannels = useMemo(() => {
        // TODO: If there's no text, then by default show the recently visited channels here
        if (!text) return channels.filter(c => !c.is_archived).slice(0, isMobile ? 6 : 4)
        // Pre-rank with the SAME scorer cmdk applies (the palette's customFilter scores
        // keywords = channel_name), then cap. Anything we keep that cmdk scores 0 is hidden
        // by cmdk anyway, so the visible set is identical to the uncapped version — minus
        // only low-scoring tails past the cap. Using defaultFilter (not `includes`) keeps
        // fuzzy matches ("gnrl" → "general") working.
        return channels
            .map((c) => ({ c, score: defaultFilter(c.channel_name, text) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_RESULTS)
            .map((x) => x.c)
    }, [channels, text, isMobile])

    if (!filteredChannels.length) return null

    const rows = filteredChannels.map(channel => channel.name && (
        <CommandItem
            key={channel.name}
            value={channel.name}
            keywords={[channel.channel_name]}
            onSelect={() => {
                navigate(`/${channel.workspace}/${channel.name}`)
                setOpen(false)
            }}
            className='cursor-pointer'
        >
            <ChannelIcon type={channel.type} className="h-4 w-4 shrink-0" />
            <span className="truncate">{channel.channel_name}</span>
            <div className='flex items-center gap-1 ml-auto'>
                {channel.is_archived ? (
                    <Badge variant="subtle" size='sm'>
                        {_("Archived")}
                    </Badge>
                ) : null}
                <div className="flex items-center gap-1 text-xs font-normal text-ink-gray-4">
                    <span>{channel.workspace}</span>
                </div>
            </div>
        </CommandItem>
    ))

    // While searching, rows go bare into the palette's single ranking group
    // (see CommandPalette) so channels compete with users and commands on
    // score, not on section order. Browsing keeps the labeled section.
    if (text) return <>{rows}</>

    return <CommandGroup heading={_("Channels")}>{rows}</CommandGroup>
}

export default ChannelList
