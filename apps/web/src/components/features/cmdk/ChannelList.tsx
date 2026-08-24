import { CommandGroup, CommandItem } from '@components/ui/command'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { useSetAtom } from 'jotai'
import { commandMenuOpenAtom } from './atoms'
import { useContext, useMemo } from 'react'
import { FrappeContext, type FrappeConfig } from 'frappe-react-sdk'
import { defaultFilter } from 'cmdk'
import _ from '@lib/translate'
import { Badge } from '@components/ui/badge'
import { useChannels } from "@stores/channels/useChannelList"
import { useIsMobile } from '@hooks/use-mobile'
import { useNavigateFromDrawer } from '@hooks/useNavigateFromDrawer'
import { prefetchChannel, type FrappeCallClient } from '@stores/messages/loaders'

/** Cap on candidates handed to cmdk: it scores + React reconciles every item per keystroke,
 *  so an unbounded list janks at thousands of channels. Nobody scrolls past ~50 results. */
const MAX_RESULTS = 50

const ChannelList = ({ text }: { text: string }) => {
    const { channels } = useChannels()
    const setOpen = useSetAtom(commandMenuOpenAtom)
    const isMobile = useIsMobile()
    const { call } = useContext(FrappeContext) as FrappeConfig
    // Closes the palette, and on mobile waits out the drawer's exit animation
    // before navigating (or the drawer gets baked into the OS back-swipe
    // screenshot — see the hook).
    const navigateFromDrawer = useNavigateFromDrawer(() => setOpen(false))

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
                // Fetch the channel's messages during the mobile wait, so the
                // channel usually opens already loaded. No-op if already warm.
                prefetchChannel(call as FrappeCallClient, channel.name)
                navigateFromDrawer(`/${channel.workspace}/${channel.name}`)
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
                <div className="flex items-center gap-1 font-normal text-xs text-ink-gray-4">
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
