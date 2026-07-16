import { CommandGroup, CommandItem } from '@components/ui/command'
import { useNavigate } from 'react-router-dom'
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

const ITEMS = [
    { value: 'profile', label: 'Profile', icon: User },
    { value: 'appearance', label: 'Appearance', icon: Palette },
    { value: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
    { value: 'workspaces', label: 'Workspaces', icon: Building2 },
    { value: 'channels', label: 'Channels', icon: Hash },
    { value: 'emojis', label: 'Custom Emojis', icon: Smile },
] as const

const SettingsList = ({ text }: { text: string }) => {
    const navigate = useNavigate()
    const setOpen = useSetAtom(commandMenuOpenAtom)

    const filteredItems = useMemo(() => {
        if (!text) return ITEMS
        const query = text.toLowerCase()
        return ITEMS.filter(item =>
            item.label.toLowerCase().includes(query) ||
            'settings'.includes(query)
        )
    }, [text])

    if (!filteredItems.length) return null

    return (
        <CommandGroup heading={_("Settings")}>
            {filteredItems.map(item => {
                const Icon = item.icon
                return (
                    <CommandItem
                        key={item.value}
                        value={`settings-${item.value}`}
                        keywords={[item.label, 'settings']}
                        onSelect={() => {
                            navigate(`/settings/${item.value}`)
                            setOpen(false)
                        }}
                        className='cursor-pointer text-base'
                    >
                        <Icon className="h-4 w-4" />
                        {_(item.label)}
                    </CommandItem>
                )
            })}
        </CommandGroup>
    )
}

export default SettingsList
