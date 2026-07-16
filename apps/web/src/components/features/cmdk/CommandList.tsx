import { CommandGroup, CommandItem } from '@components/ui/command'
import { useSetAtom } from 'jotai'
import { commandMenuOpenAtom } from './atoms'
import { useTheme } from '@components/theme-provider'
import { useMemo } from 'react'
import _ from '@lib/translate'
import { Moon, Sun } from 'lucide-react'

const QuickActions = ({ text }: { text: string }) => {
    const setOpen = useSetAtom(commandMenuOpenAtom)
    const { theme, setTheme } = useTheme()

    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    const items = useMemo(() => [
        {
            value: 'toggle-theme',
            label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
            icon: isDark ? Sun : Moon,
            action: () => setTheme(isDark ? 'light' : 'dark'),
        },
    ], [isDark, setTheme])

    const filteredItems = useMemo(() => {
        if (!text) return items
        const query = text.toLowerCase()
        return items.filter(item =>
            item.label.toLowerCase().includes(query) ||
            'theme'.includes(query) ||
            'dark'.includes(query) ||
            'light'.includes(query)
        )
    }, [items, text])

    if (!filteredItems.length) return null

    return (
        <CommandGroup heading={_("Commands")}>
            {filteredItems.map(item => {
                const Icon = item.icon
                return (
                    <CommandItem
                        key={item.value}
                        value={item.value}
                        keywords={[item.label, 'theme', 'dark', 'light']}
                        onSelect={() => {
                            item.action()
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

export default QuickActions
