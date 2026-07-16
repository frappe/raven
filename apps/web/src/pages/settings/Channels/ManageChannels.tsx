import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { DataTable } from "@components/common/DataTable/DataTable"
import { CreateChannelForm } from "@components/features/channel/CreateChannel/CreateChannelForm"
import SettingsContentContainer from "@components/features/settings/SettingsContentContainer"
import { Button } from "@components/ui/button"
import { Dialog, DialogTrigger, DialogContent } from "@components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import { useChannels } from "@stores/channels/useChannelList"
import _ from "@lib/translate"
import { ChannelListItem } from "@raven/types/common/ChannelListItem"
import { Bell, BellOff, BellRing, Loader2, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { ColumnDef, SortingState } from "src/types/DataTable"
import { ChannelFilters } from "./ChannelFilters"
import { useWorkspaces } from "@hooks/useWorkspaces"
import { Badge } from "@components/ui/badge"
import { useJoinChannel } from "@hooks/useJoinChannel"
import { useLeaveChannel } from "@hooks/useLeaveChannel"
import { errorResponseToast } from "@components/ui/error-banner"
import { FrappeError } from "frappe-react-sdk"

export const ManageChannels = () => {

    const { channels } = useChannels()
    const { workspaces } = useWorkspaces()
    const [sorting, setSorting] = useState<SortingState | null>(null)
    const [filters, setFilters] = useState<{ myChannels: string, channelType: string, workspace: string, searchQuery: string }>({ myChannels: 'All Channels', channelType: 'All Types', workspace: workspaces?.[0]?.name ?? '', searchQuery: '' })

    const navigate = useNavigate()

    const filteredChannels = useMemo<ChannelListItem[]>(() => {
        let filteredChannels: ChannelListItem[] = channels.filter((channel) => {
            const myChannelsMatch = filters?.myChannels === 'All Channels' || (filters?.myChannels === 'Joined Channels' && !!channel.member_id) || (filters?.myChannels === 'Other Channels' && !channel.member_id);

            const channelTypeMatch = filters?.channelType === 'All Types' || channel.type === filters?.channelType;

            const workspaceMatch = !filters?.workspace || channel.workspace === filters?.workspace;

            const searchMatch = !filters?.searchQuery || channel.channel_name.toLowerCase().includes(filters.searchQuery.toLowerCase()) || (channel.channel_description ?? "").toLowerCase().includes(filters.searchQuery.toLowerCase());

            return myChannelsMatch && channelTypeMatch && workspaceMatch && searchMatch;
        });

        // Sort archived channels to the bottom
        filteredChannels.sort((a, b) => {
            if (a.is_archived && !b.is_archived) return 1;
            if (!a.is_archived && b.is_archived) return -1;
            return 0;
        });

        if (!sorting) return filteredChannels
        const { field, order } = sorting
        return filteredChannels.sort((a, b) => {
            // Keep archived channels at bottom even when sorting
            if (a.is_archived && !b.is_archived) return 1
            if (!a.is_archived && b.is_archived) return -1
            const aVal = a[field as keyof ChannelListItem] ?? ''
            const bVal = b[field as keyof ChannelListItem] ?? ''
            const cmp = aVal.localeCompare(bVal)
            return order === 'desc' ? -cmp : cmp
        })
    }, [channels, sorting, filters])

    const columns: ColumnDef<ChannelListItem>[] = [
        {
            id: 'channel_name',
            header: _('Name'),
            accessorKey: 'channel_name',
            enableSorting: true,
            headerClassName: 'w-[20%]',
            cell: ({ row }) => (
                <div className='flex items-center gap-2 hover:cursor-pointer w-full' onClick={() => navigate(`/${row.workspace}/${row.name}`)}>
                    <ChannelIcon type={row.type || "Public"} className="w-4 h-4 shrink-0" />
                    <span className='text-sm font-medium line-clamp-1 text-ellipsis'>{row.channel_name}</span>
                </div>
            )
        },
        {
            id: 'channel_description',
            header: _('Description'),
            accessorKey: 'channel_description',
            enableSorting: false,
            headerClassName: 'w-[65%]',
            cell: ({ value }) => (
                <span className='text-sm text-ink-gray-4 line-clamp-1 text-ellipsis'>
                    {value as string || '—'}
                </span>
            )
        },
        {
            id: 'channel_joined',
            enableSorting: false,
            accessorKey: 'member_id',
            cellClassName: 'w-0',
            cell: ({ row }) => { return row.type !== 'Open' ? <ChannelJoinButton channel={row} /> : null }
        },
        {
            id: "allow_notifications",
            accessorKey: "allow_notifications",
            enableSorting: false,
            cell: ({ row }) => (
                <ChannelNotificationsButton channel={row} />
            )
        }
    ]

    return (
        <SettingsContentContainer
            title={_("Channels")}
            description={_("Manage channels you have access to.")}
            actions={<CreateChannelButton selectedWorkspace={filters?.workspace ?? ''} />}
        >
            <ChannelFilters filters={filters} setFilters={setFilters} workspaces={workspaces} />
            {filteredChannels.length > 0 ? <DataTable
                className="h-[calc(100vh-220px)]"
                columns={columns}
                data={filteredChannels}
                getRowId={(row) => row.name}
                sorting={sorting}
                onSortingChange={setSorting}
                tableClassName="table-fixed"
            /> : <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
                <p className="text-ink-gray-4">{_("No channels found")}</p>
                <p className="text-ink-gray-4 text-sm">{_("You may want to try adjusting your filters.")}</p>
            </div>}
        </SettingsContentContainer>
    )
}

const ChannelJoinButton = ({ channel }: { channel: ChannelListItem }) => {

    const { joinChannel, loading: joinChannelLoading } = useJoinChannel(channel.name)
    const { leaveChannel, loading: leaveChannelLoading } = useLeaveChannel(channel.name)

    const isLoading = joinChannelLoading || leaveChannelLoading

    const toggleJoin = (action: "join" | "leave") => {
        if (action === "join") {
            return joinChannel().catch((e) => {
                errorResponseToast(_("Could not join channel"), e as FrappeError)
            })
        } else {
            return leaveChannel().catch((e) => {
                errorResponseToast(_("Could not leave channel"), e as FrappeError)
            })
        }
    }

    if (channel.is_archived) {
        return (
            <Badge
                variant="outline"
                className="text-sm px-1 rounded-md w-20 h-8 bg-surface-red-5/10 text-ink-red-4 cursor-default border-transparent"
            >
                {_("Archived")}
            </Badge>
        )
    }

    return (
        <Button variant="outline" size="sm" className="group/join hover:cursor-pointer w-20" onClick={() => toggleJoin(channel.member_id ? 'leave' : 'join')}>
            {isLoading ? (<span className="grid">
                <Loader2 className="h-4 w-4 animate-spin text-ink-gray-8/80" aria-hidden />
            </span>) : channel.member_id ? (<span className="grid">
                <span className='text-sm font-medium opacity-100 group-hover/join:opacity-0 transition-opacity duration-150 col-start-1 row-start-1'>
                    {_('Joined')}
                </span>
                <span className='text-sm font-medium opacity-0 group-hover/join:opacity-100 transition-opacity duration-150 col-start-1 row-start-1'>
                    {_('Leave')}
                </span>
            </span>) : (<span className='text-sm font-medium'>
                {_('Join')}
            </span>)}
        </Button>
    )
}

const ChannelNotificationsButton = ({ channel }: { channel: ChannelListItem }) => {

    // TODO: Once we have the options in DocType, wire them up here

    const NotificationIcon = ({ notification }: { notification: 'All' | 'Mentions Only' | 'Mute' }) => {
        switch (notification) {
            case 'All':
                return <BellRing className="h-3 w-3 text-ink-gray-8/80" />
            case 'Mentions Only':
                return <Bell className="h-3 w-3 text-ink-gray-8/80" />
            case 'Mute':
                return <BellOff className="h-3 w-3 text-ink-gray-8/80" />
        }
    }

    if (!channel.member_id || channel.is_archived) {
        return null
    }

    return (
        <div className="flex w-full justify-center">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" isIconButton className="hover:cursor-pointer">
                        <span key={channel.allow_notifications ? 'on' : 'off'} className="grid">
                            <NotificationIcon notification={channel.allow_notifications ? 'All' : 'Mute'} />
                        </span>
                        <span className="sr-only">{channel.allow_notifications ? _('Mute Channel') : _('Unmute Channel')}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40">
                    <DropdownMenuItem onClick={() => { }}>
                        <div className="flex items-center gap-2">
                            <BellRing className="h-3 w-3 text-ink-gray-8/80" />
                            <span>{_("All Notifications")}</span>
                        </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { }}>
                        <div className="flex items-center gap-2">
                            <Bell className="h-3 w-3 text-ink-gray-8/80" />
                            <span>{_("Mentions Only")}</span>
                        </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { }}>
                        <div className="flex items-center gap-2">
                            <BellOff className="h-3 w-3 text-ink-gray-8/80" />
                            <span>{_("Mute Channel")}</span>
                        </div>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

const CreateChannelButton = ({ selectedWorkspace }: { selectedWorkspace: string }) => {
    const [isOpen, setIsOpen] = useState(false)
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    className="h-8 text-xs gap-1"
                >
                    <Plus className="h-4 w-4" />
                    {_("Create Channel")}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[680px] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
                <CreateChannelForm onClose={() => setIsOpen(false)} selectedWorkspace={selectedWorkspace} />
            </DialogContent>
        </Dialog>
    )
}