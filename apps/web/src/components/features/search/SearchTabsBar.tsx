import React from 'react'
import { Tabs, TabsList, TabsTrigger } from '@components/ui/tabs'
import { cn } from '@lib/utils'
import _ from '@lib/translate'

export type SearchTab = 'messages' | 'files' | 'polls' | 'links'

const TABS: { key: SearchTab; label: string }[] = [
    { key: 'messages', label: _('Messages') },
    { key: 'files', label: _('Files') },
    { key: 'links', label: _('Links') },
    { key: 'polls', label: _('Polls') },
]

interface SearchTabsBarProps {
    activeTab: SearchTab
    setActiveTab: (tab: SearchTab) => void
    /** When true, tabs stretch to fill the parent width (mobile). Defaults to content-width. */
    fullWidth?: boolean
}

const SearchTabsBar: React.FC<SearchTabsBarProps> = ({ activeTab, setActiveTab, fullWidth = false }) => (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SearchTab)} className={fullWidth ? 'w-full' : 'w-fit'}>
        <TabsList variant="subtle" size="md" className={cn(fullWidth && 'w-full')}>
            {TABS.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className={cn(fullWidth && 'flex-1')}>
                    {tab.label}
                </TabsTrigger>
            ))}
        </TabsList>
    </Tabs>
)

export default SearchTabsBar