import { useEffect, useRef } from "react"

let nextOverlayID = 0
const openOverlays = (): number[] => window.history.state?.ravenOverlays ?? []

/** True while an overlay's history entry is the current one: a back press would close it. */
export const hasOpenOverlay = () => openOverlays().length > 0

/**
 * The back() a closing overlay started, until the browser finishes it.
 * history.back() is async. A sheet that opens in the same click as another
 * one closes (the composer's actions sheet opening the poll form) must wait
 * for it. Otherwise it pushes its entry first, the back pops that entry, and
 * the new sheet closes as soon as it opens. Some browsers finish the back
 * within a tick and hide this, others do not.
 */
let pendingBack = Promise.resolve()

/** Longest we wait for a back's popstate. Past this, we push anyway. */
const BACK_TIMEOUT_MS = 500

const goBack = () => {
    pendingBack = new Promise<void>((resolve) => {
        window.addEventListener("popstate", () => resolve(), { once: true })
        window.setTimeout(resolve, BACK_TIMEOUT_MS)
    })
    window.history.back()
}

/**
 * Pushes one history entry for an overlay, so a back press calls onBack
 * instead of leaving the page. Returns a cleanup that removes the entry
 * again when the overlay closes some other way.
 *
 * Overlays stack (a sheet opened from a sheet): each entry lists every overlay
 * open beneath it, and one back press closes only the overlay whose entry it
 * popped.
 */
export const trackOverlay = (onBack: () => void) => {
    let popped = false
    let pushed = false
    let cancelled = false
    const id = ++nextOverlayID
    const onPop = () => {
        // Another overlay's entry was popped: ours is still in the history.
        if (openOverlays().includes(id)) return
        popped = true
        onBack()
    }
    const push = () => {
        if (cancelled) return
        pushed = true
        // Keep the router's own state (its `idx` position counter) in our
        // extra entry. Dropping it poisoned every navigation made FROM
        // this entry (picking a workspace from the switcher drawer, a
        // command menu jump): the router computed the next idx from a
        // missing one, wrote idx: null, and from then on "is there in-app
        // history?" checks failed — mobile back buttons fell back to
        // their default routes instead of popping.
        window.history.pushState({ ...window.history.state, ravenOverlays: [...openOverlays(), id] }, "")
        window.addEventListener("popstate", onPop)
    }
    // Deferred one tick on purpose. StrictMode (dev) replays the effect
    // synchronously on mount: setup → cleanup → setup. Pushing right away
    // made the replay push an entry, compensate with history.back(), and
    // push again — and the back()'s ASYNC popstate then landed on the
    // second setup's listener, which read it as a user back gesture and
    // closed the overlay it had just opened. Deferring means the replayed
    // setup is cancelled before history was touched.
    const timer = window.setTimeout(() => pendingBack.then(push), 0)
    return () => {
        cancelled = true
        window.clearTimeout(timer)
        // Never pushed (cancelled before the push) — nothing to undo.
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
        const overlays = openOverlays()
        if (overlays[overlays.length - 1] === id) goBack()
    }
}

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
        return trackOverlay(() => onCloseRef.current())
    }, [open])
}
