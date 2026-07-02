import { useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Button } from '@components/ui/button';
import { Loader2, X } from 'lucide-react';
import { useAtom } from 'jotai';
import { channelDrawerAtom } from '@utils/channelAtoms';
import { useCurrentChannelID } from '@hooks/useCurrentChannelID';
import ChannelMembersList from './ChannelMembersList.tsx';
import AddChannelMembers from './AddChannelMembers.tsx';
import _ from '@lib/translate';
import { useChannelMembers } from '@hooks/useChannelMembers';
import { useChannel } from '@hooks/useChannel.ts';
import { hasRole } from '@lib/permissions.ts';
import { Badge } from '@components/ui/badge.tsx';

const ChannelMembersDrawer = () => {
    const channelID = useCurrentChannelID()
    const [, setDrawerType] = useAtom(channelDrawerAtom(channelID))
    const { channel } = useChannel(channelID)
    const { members, isLoading } = useChannelMembers(channelID)

    const allowSettingChange = useMemo(() => {
        if (channel?.is_admin == 1) {
            return true;
        }
        if (channel?.member_id && hasRole("Raven Admin")) {
            return true;
        }
        return false;
    }, [channel]);

    useHotkeys('esc', () => handleClose(), { enableOnFormTags: true })

    const handleClose = () => {
        setDrawerType('')
    }

    if (!channel) {
        return null
    }

    return (
        <div className="flex flex-col h-full w-full">
            <div className='flex justify-between items-center px-2.5 pl-5 h-11 md:border-b border-outline-gray-2'>
                <div className='flex items-center gap-2'>
                    <span className='text-lg-medium'>{_('Members')}</span>
                    <Badge size='sm'>{members.length}</Badge>
                </div>

                <div>
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        isIconButton
                        aria-label="Close drawer"
                        className='md:inline-flex hidden'
                    >
                        <X />
                    </Button>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col overflow-x-hidden py-2">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        {/* TODO: Add skeleton loading state */}
                        <Loader2 className="h-4 w-4 animate-spin text-ink-gray-8/80" />
                    </div>
                ) : (
                    <ChannelMembersList members={members} channelID={channelID} allowSettingChange={allowSettingChange} />
                )}

                {/* <AddChannelMembers memberIds={memberIds} channelID={channelID} onClose={handleClose} /> */}
            </div>
        </div >
    )
}

export default ChannelMembersDrawer
