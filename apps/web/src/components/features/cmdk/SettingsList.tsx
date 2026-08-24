import { CommandGroup, CommandItem } from '@components/ui/command'
import { useSetAtom } from 'jotai'
import { commandMenuOpenAtom } from './atoms'
import { useMemo } from 'react'
import _ from '@lib/translate'
import {
    User,
    Palette,
    SlidersHorizontal,
    Building2,
    Hash,
    Smile,
} from 'lucide-react'
import { settingsDialogOpenTab } from '../settings/settingsDialogAtom'

const ITEMS = [
    { value: 'profile', label: 'Profile', icon: User },
    { value: 'appearance', label: 'Appearance', icon: Palette },
    { value: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
    { value: 'workspaces', label: 'Workspaces', icon: Building2 },
    { value: 'channels', label: 'Channels', icon: Hash },
    { value: 'emojis', label: 'Custom Emojis', icon: Smile },
] as const

const SettingsList = ({ text }: { text: string }) => {
    const setOpen = useSetAtom(commandMenuOpenAtom)
    const setSettingsDrawerOpenTab = useSetAtom(settingsDialogOpenTab)

    const filteredItems = useMemo(() => {
        if (!text) return ITEMS
        const query = text.toLowerCase()
        return ITEMS.filter(item =>
            item.label.toLowerCase().includes(query) ||
            'settings'.includes(query)
        )
    }, [text])

    if (!filteredItems.length) return null

    const rows = filteredItems.map(item => {
        const Icon = item.icon
        return (
            <CommandItem
                key={item.value}
                value={`settings-${item.value}`}
                keywords={[item.label, 'settings']}
                onSelect={() => {
                    setSettingsDrawerOpenTab(item.value)
                    setOpen(false)
                }}
                className='cursor-pointer'
            >
                <Icon className="h-4 w-4" />
                {_(item.label)}
            </CommandItem>
        )
    })

    // While searching, rows go bare into the palette's single ranking group
    // (see CommandPalette). Browsing keeps the labeled section.
    if (text) return <>{rows}</>

    return <CommandGroup heading={_("Settings")}>{rows}</CommandGroup>
}

export default SettingsList
