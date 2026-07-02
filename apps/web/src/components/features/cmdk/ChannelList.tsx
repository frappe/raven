import { CommandGroup, CommandItem } from '@components/ui/command'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { useNavigate } from 'react-router-dom'
import { useSetAtom } from 'jotai'
import { commandMenuOpenAtom } from './atoms'
import { useMemo } from 'react'
import _ from '@lib/translate'
import { Badge } from '@components/ui/badge'
import { useChannelList } from "@stores/channels/useChannelList"

const ChannelList = ({ text }: { text: string }) => {
    const { channels } = useChannelList()
    const navigate = useNavigate()
    const setOpen = useSetAtom(commandMenuOpenAtom)

    const filteredChannels = useMemo(() => {
        // TODO: If there's no text, then by default show the recently visited channels here
        if (!text) return channels.filter(c => !c.is_archived).slice(0, 3)
        return channels
    }, [channels, text])

    if (!filteredChannels.length) return null

    return (
        <CommandGroup heading={_("Channels")}>
            {filteredChannels.map(channel => channel.name && (
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
                        <div className="flex items-center gap-1 text-xs text-ink-gray-4">
                            <span>{channel.workspace}</span>
                        </div>
                    </div>
                </CommandItem>
            ))}
        </CommandGroup>
    )
}

export default ChannelList
