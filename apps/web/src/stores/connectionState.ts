import { useSyncExternalStore } from "react"

// Whether the site can be reached, as a subscribable value for the banner and the pagination guard.
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
if (typeof window !== "undefined") {
    window.addEventListener("online", notify)
    window.addEventListener("offline", notify)
}

// Site down, DNS, captive portal all read as online to navigator; native reports whether the site answers.
// The drop is debounced: a token refresh reconnects the socket in well under this.
const OUTAGE_AFTER_MS = 5000
let reachable = true
let outage: ReturnType<typeof setTimeout> | undefined

/** True when this call ended an outage, so the caller can refetch what it missed. */
export const setSiteReachable = (ok: boolean): boolean => {
    if (ok) {
        clearTimeout(outage)
        outage = undefined
        if (reachable) return false
        reachable = true
        notify()
        return true
    }
    outage ??= setTimeout(() => { outage = undefined; reachable = false; notify() }, OUTAGE_AFTER_MS)
    return false
}

// Only an explicit false is offline: Node and old runtimes expose a navigator without onLine.
export const isOnline = (): boolean => (typeof navigator === "undefined" || navigator.onLine !== false) && reachable

export const subscribeOnline = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

export const useOnlineStatus = (): boolean => useSyncExternalStore(subscribeOnline, isOnline, () => true)
