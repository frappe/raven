import { SearchX } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@components/ui/empty'
import _ from '@lib/translate'

/** Shared "search returned nothing" state for the result tabs. Rendered as an absolute overlay
 *  so it centers over the whole search pane (matching the empty prompt + notifications/threads),
 *  not just the results area below the header/tabs/filters. The nearest positioned ancestor is the
 *  left pane (`relative` in Search.tsx). pointer-events-none keeps the filters clickable. */
export const SearchNoResults = ({ title }: { title: string }) => (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <Empty>
            <EmptyMedia><SearchX /></EmptyMedia>
            <EmptyHeader>
                <EmptyTitle>{title}</EmptyTitle>
                <EmptyDescription>{_('Try a different search or adjust your filters.')}</EmptyDescription>
            </EmptyHeader>
        </Empty>
    </div>
)
