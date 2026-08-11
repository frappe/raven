import { CommandGroup, CommandItem } from '@components/ui/command'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { useDMChannels } from "@stores/channels/useChannelList"
import { useNavigate } from 'react-router-dom'
import { useSetAtom } from 'jotai'
import { commandMenuOpenAtom } from './atoms'
import _ from '@lib/translate'
import { DMChannelListItem } from '@raven/types/common/ChannelListItem'
import { Badge } from '@components/ui/badge'
import { UserData } from "@db"
import { useMemo } from 'react'
import { defaultFilter } from 'cmdk'
import { useCreateDM } from '@hooks/useCreateDM'
import { useUsersById } from '@hooks/useMessageRowLookups'
import { BotIcon, Loader2 } from 'lucide-react'
import { useIsMobile } from '@hooks/use-mobile'

/** Same cap rationale as ChannelList: bound what cmdk must score + reconcile per keystroke. */
const MAX_RESULTS = 50

const UserList = ({ text }: { text: string }) => {

    // In-memory users (usersStore snapshot — includes disabled users, same as the old Dexie
    // table read). The previous useLiveQuery ran a full IndexedDB table scan per keystroke
    // AND resolved async (items landed a render behind cmdk's search); this is synchronous
    // and only re-filters when a user actually changes.
    const usersById = useUsersById()
    const { dmChannels } = useDMChannels()
    const isMobile = useIsMobile()
    const filteredUsers = useMemo(() => {
        if (!text) return []
        // Pre-rank with cmdk's scorer over the same string its customFilter sees
        // (keywords = [full_name, name]) so fuzzy matches survive, then cap.
        const scored: { user: UserData; score: number }[] = []
        for (const user of usersById.values()) {
            const score = defaultFilter(`${user.full_name} ${user.name}`, text)
            if (score > 0) scored.push({ user, score })
        }
        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_RESULTS)
            .map((x) => x.user)
    }, [usersById, text])

    /** peer_user_id → DM channel, so mapping users isn't O(users × DMs) per keystroke. */
    const dmByPeer = useMemo(() => {
        const m = new Map<string, DMChannelListItem>()
        for (const dm of dmChannels) m.set(dm.peer_user_id, dm)
        return m
    }, [dmChannels])

    const mappedUsers = useMemo(() => {
        if (text) {
            return filteredUsers.map(user => {
                const dmChannel = dmByPeer.get(user.name)
                return dmChannel ? { user, channel: dmChannel } : { user, channel: null }
            })
        } else {
            return dmChannels.slice(0, isMobile ? 6 : 4).map(channel => {
                const user = usersById.get(channel.peer_user_id) ?? null
                return { user, channel }
            })
        }
    }, [filteredUsers, dmByPeer, dmChannels, usersById, text, isMobile])

    if (text && !filteredUsers.length) return null
    // filteredUsers need to be mapped to dmChannels and then render DMChannelItem or UserItem based on whether dm_channel exists or not. In UserItem, we will do api call on click to create dm_channel and then navigate to that dm_channel

    const rows = mappedUsers.map(({ user, channel }) => {
        if (!user) return null
        return channel ? (
            <DMChannelItem key={channel.name} user={user} channel={channel} />
        ) : (
            <UserItem key={user.name} user={user} />
        )
    })

    // While searching, rows go bare into the palette's single ranking group
    // (see CommandPalette) so people compete with channels and commands on
    // score, not on section order. Browsing keeps the labeled section.
    if (text) return <>{rows}</>

    return <CommandGroup heading={_("Users")}>{rows}</CommandGroup>
}

const DMChannelItem = ({ user, channel }: { user: UserData; channel: DMChannelListItem }) => {
    const navigate = useNavigate()
    const setOpen = useSetAtom(commandMenuOpenAtom)
    const displayName = user?.full_name || channel.peer_user_id

    return (
        <CommandItem
            value={channel.name}
            keywords={[displayName, channel.peer_user_id]}
            onSelect={() => {
                navigate(`/dm-channel/${channel.name}`)
                setOpen(false)
            }}
            className='cursor-pointer'
        >
            {user ? (
                <UserAvatar user={user} size="xs" showStatusIndicator={false} showBotIndicator={false} />
            ) : null}
            <span className="truncate">{displayName}</span>
            {user.type === 'Bot' && <Badge variant="subtle">
                <BotIcon />
                {_("Bot")}
            </Badge>}
            {user?.enabled === 0 && (
                <Badge variant="subtle" className="ml-auto text-xs">
                    {_("Disabled")}
                </Badge>
            )}
        </CommandItem>
    )
}

const UserItem = ({ user }: { user: UserData }) => {
    const setOpen = useSetAtom(commandMenuOpenAtom)
    const { createDM, loading } = useCreateDM()

    const onSelect = () => {
        if (user.enabled === 0) return
        createDM(user.name).then((channelID) => channelID && setOpen(false))
    }

    return (
        <CommandItem
            value={user.name}
            keywords={[user.full_name, user.name]}
            onSelect={onSelect}
            className={user.enabled === 0 ? 'cursor-not-allowed' : 'cursor-pointer'}
        >
            <UserAvatar user={user} size="xs" showStatusIndicator={false} showBotIndicator={false} />
            <span className="truncate">{user.full_name}</span>
            {user.type === 'Bot' && <Badge variant="subtle">
                <BotIcon />
                {_("Bot")}
            </Badge>}
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {user?.enabled === 0 && (
                <Badge variant="subtle" className="ml-auto">
                    {_("Disabled")}
                </Badge>
            )}
        </CommandItem>
    )
}
export default UserList
