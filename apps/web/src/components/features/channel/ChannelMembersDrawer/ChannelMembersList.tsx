import { useMemo } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { UserAvatar } from '@components/features/message/UserAvatar';
import { UserMinus, SearchIcon, PlusIcon, Crown, MessagesSquareIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@components/ui/dropdown-menu';
import _ from '@lib/translate';
import { ChannelMemberData, loadChannelMembers } from '@hooks/useChannelMembers';
import { Virtuoso } from 'react-virtuoso';
import { useContext } from 'react';
import { FrappeConfig, FrappeContext, useFrappeDeleteDoc, useFrappeUpdateDoc } from 'frappe-react-sdk';
import { toast } from 'sonner';
import { useDebounceValue } from 'usehooks-ts';
import { Badge } from '@components/ui/badge';
import { InputGroup, InputGroupAddon } from '@components/ui/input-group';
import { cn } from '@lib/utils';

const ChannelMembersList = ({ members, channelID, allowSettingChange }: { members: ChannelMemberData[], channelID: string, allowSettingChange: boolean }) => {

    const [searchQuery, setSearchQuery] = useDebounceValue('', 200)

    const filteredMembers = useMemo(() => {
        if (!searchQuery) return members
        return members.filter(member =>
            member.full_name?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
            member.name?.toLowerCase().includes(searchQuery.toLowerCase().trim())
        )
    }, [members, searchQuery])

    // TODO: Wire up add member, review design

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
                {allowSettingChange && (
                    <Button variant="subtle" size="md">
                        <PlusIcon />
                        {_("Add")}
                    </Button>
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
                <div className="flex-1 min-h-0 px-2">
                    <MembersList filteredMembers={filteredMembers} channelID={channelID} allowSettingChange={allowSettingChange} />
                </div>
            )}
        </div>
    )
}

const MembersList = ({ filteredMembers, channelID, allowSettingChange }: { filteredMembers: ChannelMemberData[], channelID: string, allowSettingChange: boolean }) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const { deleteDoc } = useFrappeDeleteDoc()
    const { updateDoc } = useFrappeUpdateDoc()

    const handleRemoveMember = (member: ChannelMemberData) => {
        if (!member.channel_member_name) return
        deleteDoc('Raven Channel Member', member.channel_member_name)
            .then(() => {
                toast.success(_("Member removed"))
                loadChannelMembers(call, channelID, true)
            })
            .catch(() => toast.error(_("Failed to remove member")))
    }

    const handleToggleAdmin = (member: ChannelMemberData) => {
        if (!member.channel_member_name) return
        const newAdminStatus = member.is_admin === 1 ? 0 : 1
        updateDoc('Raven Channel Member', member.channel_member_name, { is_admin: newAdminStatus })
            .then(() => {
                toast.success(newAdminStatus === 1 ? _("Member is now an admin") : _("Admin rights removed"))
                loadChannelMembers(call, channelID, true)
            })
            .catch(() => toast.error(_("Failed to update member")))
    }

    return (
        <Virtuoso
            style={{ height: '100%', width: '100%' }}
            data={filteredMembers}
            overscan={200}
            itemContent={(_index, member) => (
                <div
                    key={member.name}
                    data-member-id={member.channel_member_name}
                    className="flex items-center justify-between"
                >
                    <DropdownMenu>
                        <DropdownMenuTrigger className='w-full data-[state=open]:bg-surface-gray-2 hover:bg-surface-gray-2 py-2 px-2 rounded group cursor-pointer'>
                            <div className={cn("flex items-center gap-2 flex-1 min-w-0 w-full", "")}>
                                <div className='flex items-center justify-center'>
                                    <UserAvatar
                                        user={member}
                                        size="sm"
                                        className="shrink-0"
                                    />
                                </div>
                                <div className="flex w-full items-center gap-2 justify-between">
                                    <span className="text-base text-ink-gray-6 truncate">
                                        {member.full_name}
                                    </span>
                                    <div className='flex items-center gap-2'>
                                        {member.is_admin === 1 && (
                                            <Badge size='md' theme='blue'>
                                                {_('Admin')}
                                            </Badge>
                                        )}

                                    </div>
                                </div>
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>
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
