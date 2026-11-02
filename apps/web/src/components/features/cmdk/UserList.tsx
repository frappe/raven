import { CommandGroup, CommandItem } from '@components/ui/command'
import { UserAvatar } from '@components/features/message/UserAvatar'
import { useDMChannels } from "@stores/channels/useChannelList"
import { useSetAtom } from 'jotai'
import { commandMenuOpenAtom } from './atoms'
import _ from '@lib/translate'
import { DMChannelListItem } from '@raven/types/common/ChannelListItem'
import { Badge } from '@components/ui/badge'
import { UserData } from "@db"
import { useContext, useMemo } from 'react'
import { FrappeContext, type FrappeConfig } from 'frappe-react-sdk'
import { prefetchChannel, type FrappeCallClient } from '@stores/messages/loaders'
import { defaultFilter } from 'cmdk'
import { useCreateDM } from '@hooks/useCreateDM'
import { getUserDisplayName, isCurrentUser } from '@utils/userDisplay'
import { useUsersById } from '@hooks/useMessageRowLookups'
import { BotIcon, Loader2 } from 'lucide-react'
import { useIsMobile } from '@hooks/use-mobile'
import { useNavigateFromDrawer } from '@hooks/useNavigateFromDrawer'

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

    /** peer_user_id → DM channel, so mapping users isn't O(users × DMs) per keystroke. */
    const dmByPeer = useMemo(() => {
        const m = new Map<string, DMChannelListItem>()
        for (const dm of dmChannels) m.set(dm.peer_user_id, dm)
        return m
    }, [dmChannels])

    const filteredUsers = useMemo(() => {
        if (!text) return []
        // Pre-rank with cmdk's scorer over the same string its customFilter sees
        // (keywords = [full_name, name]) so fuzzy matches survive, then cap.
        const scored: { user: UserData; score: number }[] = []
        for (const user of usersById.values()) {
            // A disabled user with no existing DM has no useful row: you can't
            // start a DM with them, so the item was a dead end. With a DM, the
            // row stays — it opens the conversation history (Disabled badge on
            // the item says why they can't reply). Filtered HERE, before the
            // cap, so dead rows don't eat result slots.
            if (user.enabled === 0 && !dmByPeer.has(user.name)) continue
            const score = defaultFilter(`${user.full_name} ${user.name}`, text)
            if (score > 0) scored.push({ user, score })
        }
        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_RESULTS)
            .map((x) => x.user)
    }, [usersById, dmByPeer, text])

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

    const rows = mappedUsers.flatMap(({ user, channel }) => {
        if (!user) return []
        return channel ? (
            <DMChannelItem key={channel.name} user={user} channel={channel} />
        ) : (
            <UserItem key={user.name} user={user} />
        )
    })
    // No DMs yet (or none whose peer is loaded): cmdk only hides an empty group while
    // searching, so the browse-mode "Users" heading would sit over nothing.
    if (!rows.length) return null

    // While searching, rows go bare into the palette's single ranking group
    // (see CommandPalette) so people compete with channels and commands on
    // score, not on section order. Browsing keeps the labeled section.
    if (text) return <>{rows}</>

    return <CommandGroup heading={_("Users")}>{rows}</CommandGroup>
}

const DMChannelItem = ({ user, channel }: { user: UserData; channel: DMChannelListItem }) => {
    const setOpen = useSetAtom(commandMenuOpenAtom)
    const { call } = useContext(FrappeContext) as FrappeConfig
    // Close first, navigate after the drawer's exit animation (see the hook).
    // The prefetch runs during that wait, so the DM usually opens loaded.
    const navigateFromDrawer = useNavigateFromDrawer(() => setOpen(false))
    const displayName = user?.full_name || channel.peer_user_id
    // Your own DM reads "<name> (You)", as it does in the DM sidebar. The plain name stays
    // in `keywords` below so a search for "you" can't match this row.
    const label = getUserDisplayName(displayName, isCurrentUser(channel.peer_user_id))

    return (
        <CommandItem
            value={channel.name}
            keywords={[displayName, channel.peer_user_id]}
            onSelect={() => {
                prefetchChannel(call as FrappeCallClient, channel.name)
                navigateFromDrawer(`/dm-channel/${channel.name}`)
            }}
            className='cursor-pointer'
        >
            {user ? (
                <UserAvatar user={user} size="xs" showStatusIndicator={false} showBotIndicator={false} />
            ) : null}
            <span className="truncate">{label}</span>
            {user.type === 'Bot' && <Badge variant="subtle">
                <BotIcon />
                {_("Bot")}
            </Badge>}
            {user?.enabled === 0 && (
                <Badge variant="subtle" className="ms-auto text-xs">
                    {_("Disabled")}
                </Badge>
            )}
        </CommandItem>
    )
}

const UserItem = ({ user }: { user: UserData }) => {
    const setOpen = useSetAtom(commandMenuOpenAtom)
    const { createDM, loading } = useCreateDM()
    const navigateFromDrawer = useNavigateFromDrawer(() => setOpen(false))

    const onSelect = () => {
        if (loading) return
        // The palette stays OPEN (with the row's spinner) until the DM
        // resolves — on failure the user is still in the palette to retry
        // (createDM toasts the error). Only a successful resolve closes and
        // navigates, and the hook holds that navigation until the drawer's
        // exit animation is over.
        createDM(user.name, { navigate: false }).then((channelID) => {
            if (channelID) navigateFromDrawer(`/dm-channel/${encodeURIComponent(channelID)}`)
        })
    }

    return (
        // Disabled users never reach this row: without a DM they're filtered
        // out of the results entirely (UserList), and with one they render as
        // DMChannelItem above. So this row is always a live "start a DM" action.
        <CommandItem
            value={user.name}
            keywords={[user.full_name, user.name]}
            onSelect={onSelect}
            className='cursor-pointer'
        >
            <UserAvatar user={user} size="xs" showStatusIndicator={false} showBotIndicator={false} />
            <span className="truncate">
                {getUserDisplayName(user.full_name ?? user.name, isCurrentUser(user.name))}
            </span>
            {user.type === 'Bot' && <Badge variant="subtle">
                <BotIcon />
                {_("Bot")}
            </Badge>}
            {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
        </CommandItem>
    )
}
export default UserList
