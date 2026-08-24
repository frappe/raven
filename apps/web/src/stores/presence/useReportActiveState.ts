import { useContext, useEffect, useRef } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"

const IDLE_TIMEOUT_MS = 1000 * 60 * 10 // 10 min without interaction → inactive
const IDLE_CHECK_INTERVAL_MS = 1000 * 60 // re-evaluate idleness every minute
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const

/**
 * The state we last reported to the server, at module level so it survives the
 * effect remounting. React StrictMode mounts the effect twice in dev, which
 * otherwise fired active → inactive → active (three calls) on load.
 */
let reportedActive = false
/** A cleanup's deactivate, deferred a tick so an immediate remount can cancel it. */
let pendingDeactivate: ReturnType<typeof setTimeout> | null = null

/**
 * Reports the CURRENT user's online state to the server via
 * refresh_user_active_state, which broadcasts raven:user_active_state_updated to
 * everyone (consumed by usePresenceSync, so other clients see us come and go).
 * Mounted once at the app shell.
 *
 * Dependency-free idle detection: any interaction stamps lastActivity (cheap), a
 * once-a-minute interval flips us inactive after 10 idle minutes, and tab
 * visibility flips us immediately. We track the active flag locally and only hit
 * the server on an actual transition.
 */
export const useReportActiveState = () => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const callRef = useRef(call)
    useEffect(() => {
        callRef.current = call
    }, [call])

    useEffect(() => {
        // A pending deactivate from a just-unmounted instance (StrictMode remount, or
        // a quick remount) — cancel it; we're active again.
        if (pendingDeactivate) {
            clearTimeout(pendingDeactivate)
            pendingDeactivate = null
        }

        let lastActivity = Date.now()

        const report = (next: boolean) => {
            if (next === reportedActive) return
            reportedActive = next
            callRef.current
                .get("raven.api.user_availability.refresh_user_active_state", { deactivate: !next })
                .catch(() => {
                    // Best effort — revert the flag so the next transition retries
                    reportedActive = !next
                })
        }

        const onActivity = () => {
            lastActivity = Date.now()
            if (document.visibilityState === "visible") report(true)
        }

        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                lastActivity = Date.now()
                report(true)
            } else {
                report(false)
            }
        }

        const idleCheck = setInterval(() => {
            if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) report(false)
        }, IDLE_CHECK_INTERVAL_MS)

        ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }))
        document.addEventListener("visibilitychange", onVisibility)

        // Mark active on mount (false → true fires the initial report)
        report(true)

        return () => {
            clearInterval(idleCheck)
            ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity))
            document.removeEventListener("visibilitychange", onVisibility)
            // Defer the deactivate by a tick: on a real unmount it fires, but a
            // StrictMode remount (which runs synchronously) clears it first, so we
            // don't churn active → inactive → active on load.
            pendingDeactivate = setTimeout(() => {
                pendingDeactivate = null
                report(false)
            }, 0)
        }
    }, [])
}
