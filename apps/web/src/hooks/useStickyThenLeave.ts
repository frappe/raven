import { useEffect, useReducer, useRef, useState } from "react"

/** How long a departing row stays in the view before it starts sliding out.
 *  Long enough to register as "done", short enough that a stale row never
 *  reads as a bug. */
const LEAVE_LINGER_MS = 700
/** Row exit animation length — must match LeavingRow's CSS `duration-300`. */
const LEAVE_EXIT_MS = 300

type Options<T> = {
    /** Changing it resets everything synchronously (kept rows, pending exits). */
    viewKey: string
    /** The pipeline only runs on filtered ("unread only") views. */
    enabled: boolean
    getId: (row: T) => string
    /** Row is done (read/cleared) AND eligible to depart. Flipping back to
     *  false — e.g. a thread getting a new reply mid-exit — cancels the
     *  departure and the row stays. */
    shouldLeave: (row: T) => boolean
    /** Row is the one open in the pane — exempt while it stays open; becoming
     *  open again also cancels a scheduled departure. */
    isOpen: (row: T) => boolean
    /** Skip the linger for this row — the exit starts immediately. For rows the
     *  user dismissed with a GESTURE (swipe-to-read): the swipe itself was the
     *  acknowledgment, so holding the row another 700ms reads as lag. */
    leaveImmediately?: (row: T) => boolean
}

/**
 * Sticky-then-leave pipeline for filtered inbox lists (notifications, threads).
 *
 * A row the user is LOOKING at must not vanish the moment it's read — the
 * unread filter applies to rows entering the view, not ones already displayed —
 * so rows seen unread are remembered in `keepIds` and survive the filter
 * (rendered as read). But a row the user has DEALT WITH must not stay forever
 * either: once `shouldLeave` holds and it isn't the open row, it lingers
 * briefly, animates closed (`leavingIds` drives LeavingRow's collapse), and is
 * then dropped from `keepIds` so the filter removes it.
 *
 * Wiring (see useNotificationList / useThreadList):
 *   - hand `keepIds` to the row selector, and ADD ids seen unread during
 *     selection (the hook owns the set, the caller owns what enters it)
 *   - include `version` in the selection memo's deps — departures mutate the
 *     set, and the memo must recompute when they do
 *   - call `onRows(selected)` right after the memo
 *   - render rows in `leavingIds` collapsed (LeavingRow)
 */
export const useStickyThenLeave = <T>(options: Options<T>) => {
    const { viewKey } = options

    const keepIdsRef = useRef<Set<string>>(new Set())
    const [leavingIds, setLeavingIds] = useState<ReadonlySet<string>>(() => new Set())
    // Two timers per departing row: start the animation, then actually remove.
    const timersRef = useRef<Map<string, [number, number]>>(new Map())
    // keepIds is a plain Set, so dropping a row from it needs an explicit bump
    // for the caller's selection memo to recompute.
    const [version, bumpVersion] = useReducer((v: number) => v + 1, 0)

    // The scheduler effect runs after every render and reads the LATEST rows and
    // predicates through refs — rows are computed after this hook runs, so they
    // cannot be hook arguments.
    const rowsRef = useRef<T[]>([])
    const optionsRef = useRef(options)
    optionsRef.current = options

    const clearAllTimers = () => {
        for (const [start, finish] of timersRef.current.values()) {
            window.clearTimeout(start)
            window.clearTimeout(finish)
        }
        timersRef.current.clear()
    }

    // Reset synchronously when the view changes (an effect would leave one stale
    // frame). The render-phase state update makes React restart the render clean.
    const viewKeyRef = useRef(viewKey)
    if (viewKeyRef.current !== viewKey) {
        viewKeyRef.current = viewKey
        keepIdsRef.current = new Set()
        clearAllTimers()
        if (leavingIds.size > 0) setLeavingIds(new Set())
    }

    const onRows = (rows: T[]) => {
        rowsRef.current = rows
    }

    /**
     * Bulk path (Mark all as read): drop every kept row NOW — no linger, no
     * animation. Per-row departure exists to acknowledge an individual action;
     * a bulk action already acknowledged everything, and N staggered timers
     * would just delay the empty state (and burst N renders when they fire).
     * Rows currently OPEN in the pane are retained — they must still not
     * vanish while the user is looking at them; they depart per-row later.
     */
    const clearNow = () => {
        clearAllTimers()
        const { getId, isOpen } = optionsRef.current
        const retained = new Set<string>()
        for (const row of rowsRef.current) {
            const id = getId(row)
            if (isOpen(row) && keepIdsRef.current.has(id)) retained.add(id)
        }
        keepIdsRef.current = retained
        setLeavingIds((prev) => (prev.size > 0 ? new Set() : prev))
        bumpVersion()
    }

    useEffect(() => {
        const { enabled, getId, shouldLeave, isOpen } = optionsRef.current
        if (!enabled) return
        for (const row of rowsRef.current) {
            const id = getId(row)
            const timers = timersRef.current.get(id)
            if (!shouldLeave(row) || isOpen(row)) {
                // Still unread, unread AGAIN, or (re-)opened — no departure.
                if (timers) {
                    window.clearTimeout(timers[0])
                    window.clearTimeout(timers[1])
                    timersRef.current.delete(id)
                    setLeavingIds((prev) => {
                        if (!prev.has(id)) return prev
                        const next = new Set(prev)
                        next.delete(id)
                        return next
                    })
                }
                continue
            }
            if (timers) continue
            // Swipe-dismissed rows exit right away; everything else lingers first.
            const linger = optionsRef.current.leaveImmediately?.(row) ? 0 : LEAVE_LINGER_MS
            const start = window.setTimeout(() => {
                setLeavingIds((prev) => new Set(prev).add(id))
            }, linger)
            const finish = window.setTimeout(() => {
                timersRef.current.delete(id)
                // REPLACE the set, don't mutate it: selectors may cache their
                // result keyed on the set's identity (selectThreadRows does), and
                // an in-place delete leaves that cache stale — the "departed" row
                // comes straight back from the cached array, gets rescheduled,
                // and leaves again, forever. A fresh identity forces a recompute.
                // (Additions during selection can stay in-place: they only matter
                // on runs where the state/unread inputs changed anyway.)
                const nextKept = new Set(keepIdsRef.current)
                nextKept.delete(id)
                keepIdsRef.current = nextKept
                setLeavingIds((prev) => {
                    const next = new Set(prev)
                    next.delete(id)
                    return next
                })
                bumpVersion()
            }, linger + LEAVE_EXIT_MS)
            timersRef.current.set(id, [start, finish])
        }
        // Intentionally no deps: this must see every rows/predicate change, and
        // the timer map keeps re-runs idempotent (a cheap scan per commit).
    })

    // Unmount only: pending exits die with the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => () => clearAllTimers(), [])

    return { keepIds: keepIdsRef.current, version, leavingIds, onRows, clearNow }
}
