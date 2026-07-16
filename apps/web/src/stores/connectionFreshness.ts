/**
 * Answers one question: "has the realtime connection broken since this window was
 * fetched?" A "window" is any fetched slice kept live by socket events: a channel's
 * messages, a notifications view, a threads-list view.
 *
 * Why it matters: those windows are kept up to date by socket events. When the
 * socket drops — which happens every time a phone locks or the PWA goes to the
 * background — the events from that gap are lost forever. Missing NEW rows could
 * be detected by asking the server "anything after X?", but a missed reaction,
 * edit or delete changes an EXISTING row and leaves no trace. The only way to
 * know is to remember that a gap happened, and refetch.
 *
 * How it works:
 *  - `epoch` is a counter that goes up by one every time the connection breaks
 *    (useConnectionFreshness decides when that is).
 *  - Whenever a window is fetched, it is stamped with the counter's value at
 *    that moment (markWindowFresh).
 *  - If a window's stamp is older than the counter, a break happened after its
 *    fetch — it might be missing something (isWindowStale), and its owner
 *    refetches to be sure: reconcileStaleWindow (messages/loaders.ts),
 *    reconcileViewIfStale (notifications/loaders.ts, threads/listLoaders.ts).
 *
 * While the connection never breaks, the counter never moves, every stamp matches,
 * and none of this costs a single extra request.
 */

let epoch = 1
const listeners = new Set<() => void>()

/** Current value of the break counter. */
export const getConnectionEpoch = () => epoch

/** Record a connection break: every window fetched before this moment becomes
 *  suspect. Also notifies subscribers, so windows on screen refetch right away. */
export const bumpConnectionEpoch = () => {
    epoch += 1
    for (const listener of listeners) listener()
}

/** Runs `listener` on every recorded break. The windows currently on screen (the
 *  open channel, a mounted notifications/threads view) use this to refetch
 *  immediately — they can't wait for a "next open" that won't come. */
export const subscribeConnectionEpoch = (listener: () => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/** The counter value each window was stamped with at its last fetch. Keys are
 *  opaque: a channel id (message windows) or a namespaced list-view key
 *  ("notifications:<view>", "threads:<view>") — anything kept live by socket
 *  events and therefore suspect after a break. */
const windowEpochs = new Map<string, number>()

/** Stamp a window as up to date. Pass the counter value read BEFORE the fetch
 *  started: if the connection broke while the request was running, the response
 *  is from before the break, and the window should stay suspect. */
export const markWindowFresh = (windowKey: string, epochAtFetchStart: number) => {
    windowEpochs.set(windowKey, epochAtFetchStart)
}

/** True if the connection has broken since this window was last fetched
 *  (or it was never stamped at all). */
export const isWindowStale = (windowKey: string) => (windowEpochs.get(windowKey) ?? 0) < epoch
