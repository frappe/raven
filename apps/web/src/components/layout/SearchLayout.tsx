import { useCallback } from "react"
import { Outlet, useSearchParams } from "react-router-dom"
import AppMobileFooter from "@components/features/header/AppMobileFooter"

/**
 * Layout for the global search page (/search).
 *
 * Desktop: workspace-switcher rail + content (sidebar-less AppLayout). The "Search"
 * title strip lives inside the Search page's left pane, so the split-view chat pane
 * runs full-height beside it (matching saved messages / notifications).
 * Mobile: full-screen page — no rail; the Search component renders its own mobile top-strip.
 *
 * Search state lives in URL params so links like /search?q=foo&channel=general work.
 */
export function SearchLayout() {
    const [searchParams, setSearchParams] = useSearchParams()
    const searchValue = searchParams.get('q') ?? ''

    const setSearchValue = useCallback((value: string) => {
        setSearchParams(prev => {
            if (value) {
                prev.set('q', value)
            } else {
                prev.delete('q')
            }
            return prev
        }, { replace: true })
    }, [setSearchParams])

    return <div className="flex flex-col h-dvh w-full">
        {/* flex-1 min-h-0 so the page (h-full) fills only the space ABOVE the in-flow
            footer. Without it the Outlet's h-full ate the whole viewport and pushed
            the shrink-0 footer off the bottom of the screen. */}
        <div className="flex-1 min-h-0">
            <Outlet context={{ searchValue, setSearchValue }} />
        </div>
        <AppMobileFooter />
    </div>

}
