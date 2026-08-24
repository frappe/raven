import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useIsMobile } from "@hooks/use-mobile"
import { DRAWER_EXIT_MS } from "@utils/drawer"

/**
 * Navigate out of a bottom drawer without the drawer haunting the iOS
 * back-swipe. Every drawer (or mobile sheet) that navigates somewhere must
 * route through this hook.
 *
 * Why it exists: the OS back-gesture animates with a screenshot taken around
 * the moment of navigation. Navigating while a drawer is still on screen
 * bakes the drawer into that screenshot, so a later back-swipe shows the
 * drawer "still open" (the full story lives on DRAWER_EXIT_MS and in
 * docs/pwa-enhancements.md #32). The fix is always the same: close the
 * drawer, wait out its exit animation, then navigate.
 *
 * `close` is called immediately. On mobile, navigation then waits for the
 * exit animation to finish. On desktop navigation is immediate — there is no
 * back-swipe screenshot, and dialogs float over the page instead of covering
 * it.
 *
 * The destination can be a Promise (create a DM, create a thread). The server
 * round-trip then runs DURING the close animation instead of after it —
 * navigation fires when both are done. Resolve to null or undefined to cancel
 * the navigation (the caller shows its own error toast).
 *
 * NOTE: this closes BEFORE it navigates, which on the mobile path only works
 * because of the exit-animation wait — it lets useHistoryBackClose's back()
 * settle before the navigate. A caller that needs to navigate WITHOUT the wait
 * (a switch landing on the page already under the drawer) must navigate first
 * and close after, not use this hook (see HomeWorkspacesDrawer.openWorkspace).
 */
export const useNavigateFromDrawer = (close?: () => void) => {
    const navigate = useNavigate()
    const isMobile = useIsMobile()

    return useCallback(
        (to: string | Promise<string | null | undefined>) => {
            close?.()
            // The timer starts NOW, alongside any server round-trip in `to` —
            // a slow request does not stack the wait on top of itself.
            const wait = isMobile
                ? new Promise((resolve) => window.setTimeout(resolve, DRAWER_EXIT_MS))
                : Promise.resolve()
            Promise.all([Promise.resolve(to), wait]).then(([path]) => {
                if (path) navigate(path)
            })
        },
        [close, isMobile, navigate],
    )
}
