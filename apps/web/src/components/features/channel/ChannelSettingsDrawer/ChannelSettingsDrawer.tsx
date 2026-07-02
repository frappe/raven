import { useHotkeys } from 'react-hotkeys-hook';
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
import type { UserData } from '@db';
import _ from '@lib/translate'
import { Separator } from '@components/ui/separator';

interface ChannelSettingsDrawerProps {
    peerUser?: UserData
}

const ChannelSettingsDrawer = ({ peerUser }: ChannelSettingsDrawerProps) => {

    const channelID = useCurrentChannelID()
    const [drawerType, setDrawerType] = useAtom(channelDrawerAtom(channelID))

    const isDM = !!peerUser

    // useHotkeys keeps the callback fresh, so this always closes the drawer for the *current* channelID
    useHotkeys('esc', () => handleClose(), { enableOnFormTags: true })

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

            <div>
                {peerUser ? (
                    <UserProfileDrawer user={peerUser} />
                ) : (
                    <ChannelInfo channelID={channelID} />
                )}
            </div>


            <div className="flex-1 overflow-hidden px-3">
                <Tabs value={drawerType} onValueChange={onTabChange}>

                    <TabsList variant="subtle">
                        <TabsTrigger value="files">{_('Files')}</TabsTrigger>
                        <TabsTrigger value="links">{_('Links')}</TabsTrigger>
                        <TabsTrigger value="threads">{_('Threads')}</TabsTrigger>
                        <TabsTrigger value="pins">{_('Pins')}</TabsTrigger>
                        {!isDM && <TabsTrigger value="settings">{_('Settings')}</TabsTrigger>}
                    </TabsList>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                        <TabsContent value="settings">

                        </TabsContent>

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
        </div>
    )
}

export default ChannelSettingsDrawer