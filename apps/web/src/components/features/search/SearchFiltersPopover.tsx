import { ListFilter } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PopoverContent, PopoverHeader, PopoverTitle } from '@components/ui/popover'
import { Checkbox } from '@components/ui/checkbox'
import { Label } from '@components/ui/label'
import { FileTypeFilter } from './FileTypeFilter'
import { ChannelTypeFilter } from './ChannelTypeFilter'
import { SearchFilters } from './types'
import _ from '@lib/translate'

interface SearchFiltersPopoverContentProps {
    filters: SearchFilters
}

/**
 * Body of the "more filters" popover. Renders inside a parent `<Popover>` /
 * `<PopoverTrigger>` chain — the trigger is owned by SearchFiltersBar so the
 * Filters button doubles as the anchor.
 */
export function SearchFiltersPopoverContent({ filters }: SearchFiltersPopoverContentProps) {
    const [, setSearchParams] = useSearchParams()

    const toggleBooleanParam = (key: string) => (checked: boolean) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev)
            if (checked) params.set(key, '1')
            else params.delete(key)
            return params
        }, { replace: true })
    }

    return (
        <PopoverContent align="end" sideOffset={6} className="w-80 p-4">

            <div className="space-y-6">
                <FileTypeFilter filters={filters} />
                <ChannelTypeFilter filters={filters} />

                <div>
                    <Label className="text-xs text-ink-gray-4 mb-3 block">{_('Message is...')}</Label>
                    <div className="grid grid-cols-2 gap-3">
                        <CheckboxRow
                            checked={filters.is_thread_message === 1}
                            onChange={toggleBooleanParam('is_thread_message')}
                            label={_('In a thread')}
                        />
                        <CheckboxRow
                            checked={filters.saved === 1}
                            onChange={toggleBooleanParam('saved')}
                            label={_('Saved')}
                        />
                        <CheckboxRow
                            checked={filters.is_pinned === 1}
                            onChange={toggleBooleanParam('is_pinned')}
                            label={_('Pinned')}
                        />
                    </div>
                </div>
                <div>
                    <Label className="text-xs text-ink-gray-4 mb-3 block">{_('Message has...')}</Label>
                    <div className="grid grid-cols-2 gap-3">
                        <CheckboxRow
                            checked={filters.has_reactions === 1}
                            onChange={toggleBooleanParam('has_reactions')}
                            label={_('Reactions')}
                        />
                        <CheckboxRow
                            checked={filters.mentions_me === 1}
                            onChange={toggleBooleanParam('mentions_me')}
                            label={_('Mention')}
                        />
                    </div>
                </div>
            </div>
        </PopoverContent>
    )
}

const CheckboxRow = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div className="flex items-center gap-2">
        <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
        <Label className="font-normal text-content">{label}</Label>
    </div>
)
