/**
 * vaul's exit-animation duration (TRANSITIONS.DURATION = 0.5s).
 *
 * Navigation out of a bottom drawer must WAIT this long after closing it: the
 * OS back-swipe gesture animates with a screenshot taken around the moment we
 * navigate, and if the drawer is still on screen it gets baked into that
 * screenshot — swiping back later shows the drawer "still open". Painting one
 * clean frame is not enough (iOS snapshots from another process on its own
 * schedule); waiting out the exit animation is the only reliable margin.
 *
 * A plain timer, NOT vaul's onAnimationEnd: that callback only fires for
 * closes vaul initiates itself (drag, scrim tap) — controlled closes never
 * trigger it. Internally it's the same thing anyway: vaul "detects" animation
 * end with a 500ms setTimeout, not a real event.
 *
 * Don't consume this directly for navigation — use useNavigateFromDrawer,
 * which owns the close-wait-navigate sequence for every drawer that navigates.
 */
export const DRAWER_EXIT_MS = 500
