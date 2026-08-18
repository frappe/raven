/**
 * Layout classes for the settings-drawer tab panels.
 *
 * Why this exists: the drawer's panel wrapper used to be one big scroller, so
 * a tab's filter row (search, provider picker, view toggle) scrolled away with
 * its list. Now the wrapper is a plain flex column and each tab pins its
 * filters and scrolls ONLY its list.
 *
 * TAB_PANEL goes on each TabsContent: a min-h-0 flex column so the tab's
 * scroller can size to the leftover height. The py-0 override (same variant
 * selector as the ui TabsContent default, so tailwind-merge replaces it)
 * removes the default bottom padding — it would end the scrollport above the
 * drawer's bottom edge and hard-clip rows. The top gap lives on the drawer's
 * wrapper instead.
 *
 * TAB_SCROLLER goes on the scrolling part of each tab: it fades the scroll
 * edge and carries the home-indicator safe-area padding INSIDE the scroll
 * (the mobile sheet's DrawerContent is pb-0), so rows scroll to the drawer's
 * true edge. On desktop env() is 0 and it is 1.5rem of breathing room.
 */
export const TAB_PANEL = "flex min-h-0 flex-col group-data-[orientation=horizontal]/tabs:py-0"

export const TAB_SCROLLER =
	"flex-1 min-h-0 overflow-y-auto scroll-fade pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
