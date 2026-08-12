import { useEffect, useRef } from "react"

/**
 * Makes the back button/gesture close an overlay (lightbox, bottom sheet)
 * instead of navigating the page under it.
 *
 * How: when the overlay opens, we push one extra history entry. The back
 * gesture pops that entry. We catch the pop and close the overlay. The page
 * does not move. This is the only way to handle Android's back swipe — the
 * web cannot block it, and all it ever does is a history back.
 *
 * If the user closes the overlay through the UI instead (X, Esc, swipe-down),
 * we remove the extra entry ourselves. Otherwise the next back press would
 * need two tries.
 *
 * The extra entry uses the same URL, so the router never shows a navigation.
 */
export const useHistoryBackClose = (open: boolean, onClose: () => void) => {
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    useEffect(() => {
        if (!open) return
        let popped = false
        // Keep the router's own state (its `idx` position counter) in our extra
        // entry. Dropping it poisoned every navigation made FROM this entry
        // (picking a workspace from the switcher drawer, a command menu jump):
        // the router computed the next idx from a missing one, wrote idx: null,
        // and from then on "is there in-app history?" checks failed — mobile
        // back buttons fell back to their default routes instead of popping.
        window.history.pushState({ ...window.history.state, ravenOverlay: true }, "")
        const onPop = () => {
            popped = true
            onCloseRef.current()
        }
        window.addEventListener("popstate", onPop)
        return () => {
            window.removeEventListener("popstate", onPop)
            if (popped) return
            // Only remove our extra entry if it is still the current one.
            // Some handlers close the overlay and navigate in the same click
            // (the command menu does). Then the new page is already on top of
            // our entry, and calling back() here would pop that new page.
            // Skipping leaves one extra entry behind — a single back press
            // later does nothing. That is much better than losing the page
            // the user just navigated to.
            if (window.history.state?.ravenOverlay === true) window.history.back()
        }
    }, [open])
}
