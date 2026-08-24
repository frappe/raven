import { useContext, useRef, useState } from 'react'
import { FrappeConfig, FrappeContext, useFrappePostCall } from 'frappe-react-sdk'
import { toast } from 'sonner'
import { PlusIcon } from 'lucide-react'
import { Button } from '@components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@components/ui/dialog'
import {
    DrawerActionBar,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerNested,
    DrawerTrigger,
} from '@components/ui/drawer'
import ErrorBanner from '@components/ui/error-banner'
import { AddMembersStep } from '@components/features/channel/CreateChannel/AddMembersStep'
import { loadChannelMembers } from '@hooks/useChannelMembers'
import { useChannel } from '@hooks/useChannel'
import { useIsMobile } from '@hooks/use-mobile'
import { UserData } from '@db'
import _ from '@lib/translate'

interface AddChannelMembersProps {
    channelID: string
    /** Current channel members — hidden from the picker (they're already in). */
    existingMemberIds: string[]
}

/**
 * "Add members to this channel" — the same toggle-list picker as the create-channel
 * flow (AddMembersStep), hosted in a dialog on desktop and a bottom sheet on mobile.
 * Adds via raven.api.raven_channel_member.add_channel_members and refreshes the
 * members store on success.
 *
 * Renders its own trigger (the "Add" button) — that's not just convenience. On
 * mobile this is a NESTED drawer, and vaul only scales the parent sheet back when
 * the open/close flows through its own internals (DrawerTrigger, DrawerClose,
 * Escape, overlay, drag). Flipping a controlled `open` prop from outside skips
 * vaul's setIsOpen, so the parent never scales — which is why open lives here and
 * every path in/out goes through a vaul component.
 */
const AddChannelMembers = ({ channelID, existingMemberIds }: AddChannelMembersProps) => {

    const isMobile = useIsMobile()
    const { channel } = useChannel(channelID)
    const [open, setOpen] = useState(false)
    const [selectedUsers, setSelectedUsers] = useState<UserData[]>([])

    const { call: addMembers, loading, error, reset } = useFrappePostCall('raven.api.raven_channel_member.add_channel_members')
    const { call: frappeCall } = useContext(FrappeContext) as FrappeConfig

    // Every open starts with a clean slate — selection and any stale error.
    const handleOpenChange = (next: boolean) => {
        if (!next) {
            setSelectedUsers([])
            reset()
        }
        setOpen(next)
    }

    // Programmatic close (after a successful add) has to flow through vaul too —
    // clicking a hidden DrawerClose does that; a plain setOpen(false) would close
    // the sheet but leave the parent sheet scaled back.
    const hiddenCloseRef = useRef<HTMLButtonElement>(null)
    const close = () => {
        if (isMobile) hiddenCloseRef.current?.click()
        else handleOpenChange(false)
    }

    const handleAdd = () => {
        if (selectedUsers.length === 0) return
        addMembers({
            channel_id: channelID,
            members: selectedUsers.map((user) => user.name),
        }).then(() => {
            toast.success(
                selectedUsers.length === 1
                    ? _('1 member added')
                    : _('{0} members added', [String(selectedUsers.length)]),
            )
            // Close BEFORE the members reload: the reload re-renders this sheet's
            // hosts, and the close must flow through vaul while it's still mounted
            // (see the hidden DrawerClose above).
            close()
            loadChannelMembers(frappeCall, channelID, true)
        }).catch(() => {
            // The banner above the list shows the error; the selection stays so the
            // user can retry.
        })
    }

    if (!channel) return null

    const addLabel =
        selectedUsers.length === 1
            ? _('Add 1 member')
            : _('Add {0} members', [String(selectedUsers.length)])

    const body = (
        <>
            {error ? <ErrorBanner error={error} /> : null}
            {/* The picker's list (Virtuoso) needs a definite height to scroll inside */}
            <div className="min-h-0 flex-1">
                <AddMembersStep
                    selectedUsers={selectedUsers}
                    onSelectUsers={setSelectedUsers}
                    workspace={channel.workspace ?? ''}
                    excludeUserIds={existingMemberIds}
                    emptyText={_('Everyone in this workspace is already a member of this channel.')}
                />
            </div>
        </>
    )

    // The "Add" button that opens this flow — the host just renders <AddChannelMembers>
    const trigger = (
        <Button variant="subtle" size="md">
            <PlusIcon />
            {_('Add')}
        </Button>
    )

    if (isMobile) {
        return (
            // Nested, not a sibling: this sheet opens from INSIDE the members
            // sheet, so vaul stacks them (parent scales back behind this one).
            <DrawerNested open={open} onOpenChange={handleOpenChange}>
                <DrawerTrigger asChild>{trigger}</DrawerTrigger>
                <DrawerContent className="h-[85dvh]">
                    {/* iOS form-sheet convention: actions in a TOP bar, no footer —
                        the search keyboard covers the bottom of the sheet, so a
                        footer's Add button would vanish exactly while selecting. */}
                    <DrawerActionBar
                        title={_('Add members')}
                        leading={
                            <DrawerClose asChild>
                                <Button variant="ghost" size="md" disabled={loading}>
                                    {_('Cancel')}
                                </Button>
                            </DrawerClose>
                        }
                        trailing={
                            <Button
                                variant="ghost"
                                size="md"
                                onClick={handleAdd}
                                disabled={selectedUsers.length === 0}
                                loading={loading}
                            >
                                {_('Add')}
                            </Button>
                        }
                    />
                    <DrawerDescription className="sr-only">
                        {_('Search for people in this workspace and add them to the channel.')}
                    </DrawerDescription>
                    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-2">
                        {body}
                    </div>
                    {/* Invisible close target for the programmatic close — see close() */}
                    <DrawerClose ref={hiddenCloseRef} className="hidden" tabIndex={-1} aria-hidden="true" />
                </DrawerContent>
            </DrawerNested>
        )
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="flex max-h-[85vh] flex-col">
                <DialogHeader>
                    <DialogTitle>{_('Add members')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {_('Search for people in this workspace and add them to the channel.')}
                    </DialogDescription>
                </DialogHeader>
                {/* Fixed list height: filtering while typing must not resize the dialog */}
                <div className="flex h-[24rem] min-h-0 flex-col gap-3">
                    {body}
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={() => handleOpenChange(false)}
                        disabled={loading}
                    >
                        {_('Cancel')}
                    </Button>
                    <Button
                        type="button"
                        size="md"
                        onClick={handleAdd}
                        disabled={selectedUsers.length === 0}
                        loading={loading}
                        loadingText={_('Adding...')}
                    >
                        {selectedUsers.length === 0 ? _('Add members') : addLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default AddChannelMembers
