import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Reset all search filters while preserving the query and the open tab —
 *  clearing filters should not also yank the user back to Messages. */
export function useClearSearchFilters() {
    const [, setSearchParams] = useSearchParams()
    return useCallback(() => {
        setSearchParams((prev) => {
            const query = prev.get('q')
            const tab = prev.get('tab')
            const next = new URLSearchParams()
            if (query) next.set('q', query)
            if (tab) next.set('tab', tab)
            return next
        }, { replace: true })
    }, [setSearchParams])
}
