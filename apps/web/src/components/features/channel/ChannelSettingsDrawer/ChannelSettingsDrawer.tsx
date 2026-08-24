import { useEscHotkey } from '@hooks/useEscHotkey';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Button } from '@components/ui/button';
import { X } from 'lucide-react';
import ChannelThreads from './ChannelThreads';
import ChannelFiles from './ChannelFiles';
import ChannelPins from './ChannelPins';
import ChannelLinks from './ChannelLinks';
import ChannelInfo from './ChannelInfo';
import { UserProfileDrawer } from '@components/features/dm-channel/UserProfileDrawer';
import { useAtom } from 'jotai';
import { channelDrawerAtom } from '@utils/channelAtoms';
import { useCurrentChannelID } from '@hooks/useCurrentChannelID';
import { useNoDragWhileScrolled } from '@hooks/useNoDragWhileScrolled';
import type { UserData } from '@db';
import _ from '@lib/translate'
import ChannelSettingsTab from './ChannelSettingsTab';
import { TAB_PANEL } from './tabPanel';

interface ChannelSettingsDrawerProps {
    peerUser?: UserData
}

const ChannelSettingsDrawer = ({ peerUser }: ChannelSettingsDrawerProps) => {

    const channelID = useCurrentChannelID()
    const noDragProps = useNoDragWhileScrolled()
    const [drawerType, setDrawerType] = useAtom(channelDrawerAtom(channelID))

    const isDM = !!peerUser

    // useHotkeys keeps the callback fresh, so this always closes the drawer for the *current* channelID
    useEscHotkey(() => handleClose(), { enableOnFormTags: true })

    const onTabChange = (value: string) => {
        setDrawerType(value as '' | 'files' | 'pins' | 'links' | 'threads' | 'settings')
    }

    const handleClose = () => {
        setDrawerType('')
    }

    return (
        <div className="flex flex-col h-full w-full">
            <div className='flex justify-between items-center px-3.5 h-11 md:border-b border-outline-gray-2'>
                <span className='text-lg-medium'>{isDM ? _('Profile') : _('About')}</span>
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

            <div className="shrink-0">
                {peerUser ? (
                    <UserProfileDrawer user={peerUser} />
                ) : (
                    <ChannelInfo channelID={channelID} />
                )}
            </div>

            {/* min-h-0 chain: Tabs fills the leftover height, and the div below the
                trigger row is the ONE scroll container — without min-h-0 at each flex
                level the panels size to their content and the whole drawer overflows
                instead of the panel scrolling. */}
            <Tabs value={drawerType} onValueChange={onTabChange} className="flex-1 min-h-0 px-3">

                <TabsList variant="subtle" className="w-full shrink-0">
                    <TabsTrigger value="files" className="w-full">{_('Files')}</TabsTrigger>
                    <TabsTrigger value="links" className="w-full">{_('Links')}</TabsTrigger>
                    <TabsTrigger value="threads" className="w-full">{_('Threads')}</TabsTrigger>
                    <TabsTrigger value="pins" className="w-full">{_('Pins')}</TabsTrigger>
                    {!isDM && <TabsTrigger value="settings" className="w-full">{_('Settings')}</TabsTrigger>}
                </TabsList>

                {/* NOT a scroller: each tab pins its filter row and scrolls only its
                    list (see tabPanel.ts), so search boxes and pickers stay put while
                    results scroll under them.

                    noDragProps stays here even so (see useNoDragWhileScrolled): its
                    capture listener stamps whichever inner element actually scrolled,
                    handing touch drags back to that scroller while it's scrolled — a
                    pull-down from the top still dismisses the sheet. */}
                <div {...noDragProps} className="flex flex-1 min-h-0 flex-col pt-1">
                    {!isDM && (
                        <TabsContent value="settings" className={TAB_PANEL}>
                            <ChannelSettingsTab channelID={channelID} />
                        </TabsContent>
                    )}

                    <TabsContent value="threads" className={TAB_PANEL}>
                        <ChannelThreads channelID={channelID} />
                    </TabsContent>

                    <TabsContent value="files" className={TAB_PANEL}>
                        <ChannelFiles channelID={channelID} />
                    </TabsContent>

                    <TabsContent value="links" className={TAB_PANEL}>
                        <ChannelLinks channelID={channelID} />
                    </TabsContent>

                    <TabsContent value="pins" className={TAB_PANEL}>
                        <ChannelPins channelID={channelID} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}

export default ChannelSettingsDrawer