import { CommandGroup, CommandItem } from '@components/ui/command'
import { useSetAtom } from 'jotai'
import { commandMenuOpenAtom } from './atoms'
import { useTheme } from '@components/theme-provider'
import { useMemo } from 'react'
import _ from '@lib/translate'
import { Moon, Sun } from 'lucide-react'
import { AVAILABILITY_OPTIONS, useSetAvailability } from '@hooks/useSetAvailability'
import { getStatusIndicatorColor } from '@components/features/message/UserAvatar'
import { cn } from '@lib/utils'

const QuickActions = ({ text }: { text: string }) => {
    const setOpen = useSetAtom(commandMenuOpenAtom)
    const { theme, setTheme } = useTheme()
    const { setAvailability } = useSetAvailability()

    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    const items = useMemo(() => [
        {
            value: 'toggle-theme',
            label: isDark ? _('Switch to Light Mode') : _('Switch to Dark Mode'),
            icon: isDark
                ? <Sun className="h-4 w-4" />
                : <Moon className="h-4 w-4" />,
            keywords: ['theme', 'dark', 'light'],
            action: () => setTheme(isDark ? 'light' : 'dark'),
        },
        // The same quick availability switch as the avatar menu and the
        // footer's long-press drawer — one entry per status, so "away" or
        // "dnd" lands directly on the right one.
        ...AVAILABILITY_OPTIONS.map((option) => ({
            value: `set-status-${option.value}`,
            label: _('Set status to {0}', [option.label]),
            icon: <div className='size-4 flex items-center justify-center'><span className={cn('size-2 rounded-full', getStatusIndicatorColor(option.value))} /></div>,
            keywords: ['status', 'availability', option.value, ...(option.value === 'Do not disturb' ? ['dnd'] : [])],
            action: () => setAvailability(option.value),
        })),
    ], [isDark, setTheme, setAvailability])

    const filteredItems = useMemo(() => {
        if (!text) return items
        const query = text.toLowerCase()
        return items.filter(item =>
            item.label.toLowerCase().includes(query) ||
            item.keywords.some((keyword) => keyword.toLowerCase().includes(query))
        )
    }, [items, text])

    if (!filteredItems.length) return null

    const rows = filteredItems.map(item => (
        <CommandItem
            key={item.value}
            value={item.value}
            keywords={[item.label, ...item.keywords]}
            onSelect={() => {
                item.action()
                setOpen(false)
            }}
            className='cursor-pointer'
        >
            {item.icon}
            {item.label}
        </CommandItem>
    ))

    // While searching, rows go bare into the palette's single ranking group
    // (see CommandPalette). Browsing keeps the labeled section.
    if (text) return <>{rows}</>

    return <CommandGroup heading={_("Commands")}>{rows}</CommandGroup>
}

export default QuickActions
