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
import { Separator } from '@components/ui/separator';
import ChannelSettingsTab from './ChannelSettingsTab';

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
            <div className='flex justify-between items-center px-2.5 pl-5 h-11 md:border-b border-outline-gray-2'>
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

                {/* Positional no-drag (see useNoDragWhileScrolled): on mobile this
                    drawer lives inside a vaul bottom sheet, which claims vertical touch
                    drags as sheet gestures — this hands them back to the scroller while
                    it's scrolled, and a pull-down from the top still dismisses.
                    (DrawerContent itself pads past the home-indicator safe area.) */}
                <div
                    {...noDragProps}
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-2"
                >
                    {!isDM && (
                        <TabsContent value="settings">
                            <ChannelSettingsTab channelID={channelID} />
                        </TabsContent>
                    )}

                    <TabsContent value="threads">
                        <ChannelThreads channelID={channelID} />
                    </TabsContent>

                    <TabsContent value="files">
                        <ChannelFiles channelID={channelID} />
                    </TabsContent>

                    <TabsContent value="links">
                        <ChannelLinks channelID={channelID} />
                    </TabsContent>

                    <TabsContent value="pins">
                        <ChannelPins channelID={channelID} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}

export default ChannelSettingsDrawer