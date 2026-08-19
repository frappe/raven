import { cn } from "@lib/utils"

/**
 * Exit shell for inbox-list rows departing after being acted on (see
 * useStickyThenLeave): a 1fr→0fr grid-row collapse — the modern
 * height-to-zero trick, the inner min-h-0/overflow-hidden cell shrinks with
 * the track — plus fade and a slight rightward drift echoing the swipe
 * gesture. Virtuoso re-measures the shrinking row every frame, so the rows
 * below slide up to take the space; when the list finally drops the row it is
 * already collapsed — nothing jumps.
 *
 * min-h-px: the collapsed row bottoms out at 1px, not 0 — Virtuoso logs
 * "Zero-sized element" when it measures an item at exactly 0px (the frames
 * between the animation ending and the data dropping the row).
 *
 * `inert` keeps a departing row untappable. duration-300 must match
 * LEAVE_EXIT_MS in useStickyThenLeave.
 */
export const LeavingRow = ({ leaving = false, children }: { leaving?: boolean; children: React.ReactNode }) => (
    <div
        className={cn(
            "grid [grid-template-rows:1fr] transition-[grid-template-rows,opacity,translate] duration-300 ease-in-out motion-reduce:transition-none",
            leaving && "[grid-template-rows:0fr] opacity-0 translate-x-6 min-h-px",
        )}
        inert={leaving ? true : undefined}
    >
        <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
)
