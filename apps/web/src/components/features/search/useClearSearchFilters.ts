import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Reset all search filters while preserving the `q` query param. */
export function useClearSearchFilters() {
    const [, setSearchParams] = useSearchParams()
    return useCallback(() => {
        setSearchParams((prev) => {
            const query = prev.get('q')
            const next = new URLSearchParams()
            if (query) next.set('q', query)
            return next
        }, { replace: true })
    }, [setSearchParams])
}
