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
        let pushed = false
        const onPop = () => {
            popped = true
            onCloseRef.current()
        }
        // Deferred one tick on purpose. StrictMode (dev) replays this effect
        // synchronously on mount: setup → cleanup → setup. Pushing right here
        // made the replay push an entry, compensate with history.back(), and
        // push again — and the back()'s ASYNC popstate then landed on the
        // second setup's listener, which read it as a user back gesture and
        // closed the overlay it had just opened (the "opens then immediately
        // closes" flash on every first open in dev). Deferring means the
        // replayed setup is cancelled before history was touched — exactly
        // one push, one listener, in dev and prod alike.
        const timer = window.setTimeout(() => {
            pushed = true
            // Keep the router's own state (its `idx` position counter) in our
            // extra entry. Dropping it poisoned every navigation made FROM
            // this entry (picking a workspace from the switcher drawer, a
            // command menu jump): the router computed the next idx from a
            // missing one, wrote idx: null, and from then on "is there in-app
            // history?" checks failed — mobile back buttons fell back to
            // their default routes instead of popping.
            window.history.pushState({ ...window.history.state, ravenOverlay: true }, "")
            window.addEventListener("popstate", onPop)
        }, 0)
        return () => {
            window.clearTimeout(timer)
            // Never pushed (cancelled within the tick) — nothing to undo.
            if (!pushed) return
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
