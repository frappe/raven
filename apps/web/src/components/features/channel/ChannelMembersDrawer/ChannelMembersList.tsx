import { useMemo } from 'react';
import { Button } from '@components/ui/button';
import AddChannelMembers from './AddChannelMembers';
import { Input } from '@components/ui/input';
import { UserAvatar } from '@components/features/message/UserAvatar';
import { UserMinus, SearchIcon, Crown, MessagesSquareIcon, Ellipsis } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@components/ui/dropdown-menu';
import _ from '@lib/translate';
import { ChannelMemberData, loadChannelMembers } from '@hooks/useChannelMembers';
import { useCreateDM } from '@hooks/useCreateDM';
import { Virtuoso } from 'react-virtuoso';
import { useContext } from 'react';
import { FrappeConfig, FrappeContext, useFrappeDeleteDoc, useFrappeUpdateDoc } from 'frappe-react-sdk';
import { toast } from 'sonner';
import { useDebounceValue } from 'usehooks-ts';
import { Badge } from '@components/ui/badge';
import { InputGroup, InputGroupAddon } from '@components/ui/input-group';
import { errorResponseToast } from '@components/ui/error-banner';
import { ChannelListItem } from '@raven/types/common/ChannelListItem';

const ChannelMembersList = ({ members, channel, allowSettingChange }: { members: ChannelMemberData[], channel: ChannelListItem, allowSettingChange: boolean }) => {

    const [searchQuery, setSearchQuery] = useDebounceValue('', 200)

    const filteredMembers = useMemo(() => {
        if (!searchQuery) return members
        return members.filter(member =>
            member.full_name?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
            member.name?.toLowerCase().includes(searchQuery.toLowerCase().trim())
        )
    }, [members, searchQuery])

    const memberIds = useMemo(() => members.map((member) => member.name), [members])

    return (
        <div className="flex flex-col h-full min-h-0 gap-2">
            <div className="flex gap-2 px-2 shrink-0">
                <InputGroup size="md" variant="outline">
                    <InputGroupAddon><SearchIcon /></InputGroupAddon>
                    <Input
                        placeholder={_("Search")}
                        inputSize="md"
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </InputGroup>
                {/* Renders its own "Add" trigger — the open state must live inside
                    (vaul nested-drawer scaling only works via its own trigger). */}
                {allowSettingChange && channel.type !== "Open" && (
                    <AddChannelMembers channelID={channel.name} existingMemberIds={memberIds} />
                )}
            </div>

            {/* Members List TODO: Convert this to Empty */}
            {filteredMembers.length === 0 ? (
                <div className="text-center py-8 px-2 shrink-0">
                    <p className="text-sm text-ink-gray-4">
                        {searchQuery ? _("No members found matching your search.") : _("No members in this channel.")}
                    </p>
                </div>
            ) : (
                // data-vaul-no-drag: on mobile this list lives inside a vaul bottom
                // sheet, which claims vertical touch drags as sheet gestures — the
                // list never scrolled. This hands the touches back to the scroller.
                <div className="flex-1 min-h-0 px-2" data-vaul-no-drag>
                    <MembersList filteredMembers={filteredMembers} channelID={channel.name} allowSettingChange={allowSettingChange} />
                </div>
            )}
        </div>
    )
}

/** Breathing room under the last member row. Inside the footer because Virtuoso is
 *  its own scroller — wrapper padding would sit outside the scroll. (DrawerContent
 *  pads past the home-indicator safe area on mobile.) Module-level so Virtuoso's
 *  component type stays stable. */
const MembersListFooter = () => <div className="h-2" aria-hidden="true" />
const membersListComponents = { Footer: MembersListFooter }

const MembersList = ({ filteredMembers, channelID, allowSettingChange }: { filteredMembers: ChannelMemberData[], channelID: string, allowSettingChange: boolean }) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const { deleteDoc } = useFrappeDeleteDoc()
    const { updateDoc } = useFrappeUpdateDoc()
    // Same "message this person" behaviour as the mention card / command menu:
    // routes to the existing DM (no request) or creates it first.
    const { createDM } = useCreateDM()

    const handleRemoveMember = (member: ChannelMemberData) => {
        if (!member.channel_member_name) return
        deleteDoc('Raven Channel Member', member.channel_member_name)
            .then(() => {
                toast.success(_("Member removed"))
                loadChannelMembers(call, channelID, true)
            })
            .catch((error) => errorResponseToast(_("Failed to remove member"), error))
    }

    const handleToggleAdmin = (member: ChannelMemberData) => {
        if (!member.channel_member_name) return
        const newAdminStatus = member.is_admin === 1 ? 0 : 1
        updateDoc('Raven Channel Member', member.channel_member_name, { is_admin: newAdminStatus })
            .then(() => {
                toast.success(newAdminStatus === 1 ? _("Member is now an admin") : _("Admin rights removed"))
                loadChannelMembers(call, channelID, true)
            })
            .catch((error) => errorResponseToast(_("Failed to update member"), error))
    }

    return (
        <Virtuoso
            style={{ height: '100%', width: '100%' }}
            data={filteredMembers}
            overscan={200}
            components={membersListComponents}
            itemContent={(_index, member) => (
                // group: reveals the row's ellipsis button on hover. has-[[data-state=open]]:
                // Radix stamps data-state=open on the trigger, so the WHOLE row highlights
                // while its menu is open (not just the button).
                <div
                    key={member.name}
                    data-member-id={member.channel_member_name}
                    className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-gray-2 has-[[data-state=open]]:bg-surface-gray-2"
                >
                    <UserAvatar user={member} size="sm" className="shrink-0" />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-base text-ink-gray-6">
                            {member.full_name}
                        </span>
                        {member.is_admin === 1 && (
                            <Badge size='md' theme='blue' className="shrink-0">
                                {_('Admin')}
                            </Badge>
                        )}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            {/* Hover-revealed on desktop (opacity, not display — keeps it
                                focusable and the row width stable); always visible on
                                mobile, where there's no hover. */}
                            <Button
                                variant="ghost"
                                size="sm"
                                isIconButton
                                aria-label={_("Member actions")}
                                className="shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
                            >
                                <Ellipsis />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => createDM(member.name)}>
                                <MessagesSquareIcon />
                                {_("Message")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleAdmin(member)} disabled={!allowSettingChange} title={!allowSettingChange ? _("You are not allowed to change the admin.") : undefined}>
                                <Crown />
                                {member.is_admin === 1 ? _('Remove admin') : _('Make admin')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                variant="destructive"
                                title={!allowSettingChange ? _("You are not allowed to remove members.") : undefined}
                                disabled={!allowSettingChange}
                                onClick={() => handleRemoveMember(member)}
                            >
                                <UserMinus />
                                {_('Remove from channel')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        />
    )
}

export default ChannelMembersList
