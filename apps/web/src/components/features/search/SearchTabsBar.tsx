import React from 'react'
import { Tabs, TabsList, TabsTrigger } from '@components/ui/tabs'
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
}

/**
 * The tabs have a row to themselves, but they only stretch across it on a phone, where
 * full-width tabs are the touch target. On desktop they size to their labels — spanning
 * a 45% pane left the four of them floating far apart.
 */
const SearchTabsBar: React.FC<SearchTabsBarProps> = ({ activeTab, setActiveTab }) => (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SearchTab)} className="w-full">
        {/* A grid of equal columns rather than a flex row: flex sizes each tab to its own
            label ("Messages" 87px, "Files" 51px), and equal 1fr columns make every tab as
            wide as the widest one. Under md:w-fit those columns settle on the widest label
            instead of stretching, so the set stays compact on desktop and spans the row on
            a phone. Column count from TABS so it can't drift as tabs are added. */}
        <TabsList
            variant="subtle"
            size="md"
            className="w-full"
        >
            {TABS.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="w-full">
                    {tab.label}
                </TabsTrigger>
            ))}
        </TabsList>
    </Tabs>
)

export default SearchTabsBar