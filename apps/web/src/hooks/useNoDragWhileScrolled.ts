import type { UIEvent } from "react"

/**
 * `data-vaul-no-drag`, but POSITIONAL — a vaul sheet with scrollable content
 * wants both behaviors from a vertical swipe: scroll the list while it's away
 * from the top, hand the gesture to vaul (drag-to-dismiss) once it's back at
 * the top. A static attribute gives up the second half — the sheet can then
 * only be dismissed from its handle or backdrop. (vaul's own scroll detection
 * is supposed to make this call itself, but it empirically loses to some
 * scrollers in this app — the members list never scrolled without the
 * attribute — so the attribute stays, just scoped to when it's true.)
 *
 * Spread the returned props on any element wrapping the scrollable region:
 *
 *     const noDragProps = useNoDragWhileScrolled()
 *     <div {...noDragProps} className="...">…scrollable content…</div>
 *
 * The attribute is stamped on WHICHEVER descendant actually scrolled (the
 * capture listener's target), not on the wrapper. That makes nested scrollers
 * correct for free: each scroller carries its own state, and vaul's
 * closest('[data-vaul-no-drag]') walk from the touched element finds the
 * nearest scrolled ancestor. Everything starts absent — content opens at its
 * top, where a pull should dismiss — and toggling is a direct DOM write, so
 * there is no re-render per scroll frame (toggleAttribute no-ops when the
 * state is unchanged, and vaul only reads the attribute at drag start).
 *
 * The one place this can NOT replace a static attribute: shadow-DOM content
 * (the action sheet's emoji picker). Scroll events are not composed, so they
 * never cross the shadow boundary and the listener never fires — the picker
 * keeps its hardcoded data-vaul-no-drag.
 */
const onScrollCapture = (event: UIEvent) => {
    const scroller = event.target as HTMLElement
    scroller.toggleAttribute("data-vaul-no-drag", scroller.scrollTop > 0)
}

// One shared, stable object: the handler holds no per-component state, so every
// consumer can spread the same reference (and memoized children never see a
// changed prop).
const NO_DRAG_PROPS = { onScrollCapture }

export const useNoDragWhileScrolled = () => NO_DRAG_PROPS
