import { useEffect, useRef, useState } from "react"
import { useFrappeEventListener } from "frappe-react-sdk"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@components/ui/alert-dialog"
import { Button } from "@components/ui/button"
import _ from "@lib/translate"

/** Ask the browser to re-check /raven/sw.js at most this often on resume. */
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000

/**
 * Prompts for a refresh when the running build has gone stale. Ported from
 * v2's AppUpdateProvider, plus a service-worker signal v2 didn't have.
 *
 * Why this matters MORE in v3: the offline-shell service worker precaches the
 * build. When a deploy lands, the new SW activates mid-session (skipWaiting)
 * and purges the OLD build's precache — the running page still references the
 * old chunk names, now gone from both cache and server, so every code-split
 * surface not yet loaded (settings panels, poll form, …) is a chunk-load
 * failure waiting to happen.
 *
 * Signals:
 * 1. `vite:preloadError` — a lazy chunk already failed. preventDefault stops
 *    Vite from throwing; a refresh is genuinely required at this point.
 * 2. `version-update` realtime event — the server announced a new build.
 * 3. `controllerchange` — the SW updated and took control of this page: the
 *    old precache is gone, the page is on borrowed time. Proactive: prompts
 *    BEFORE anything breaks.
 *
 * Dismissable deliberately (v2 semantics): mid-composition users can finish
 * and send first — a truly broken chunk will re-raise signal 1.
 */
export const AppUpdateAlert = () => {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const promptUpdate = () => setOpen(true)

        const onPreloadError = (event: Event) => {
            event.preventDefault()
            promptUpdate()
        }
        window.addEventListener("vite:preloadError", onPreloadError)
        navigator.serviceWorker?.addEventListener("controllerchange", promptUpdate)
        return () => {
            window.removeEventListener("vite:preloadError", onPreloadError)
            navigator.serviceWorker?.removeEventListener("controllerchange", promptUpdate)
        }
    }, [])

    useFrappeEventListener("version-update", () => setOpen(true))

    // Long-lived PWA sessions rarely navigate, so the browser's own SW update
    // checks may not run for days — nudge one on resume, throttled. A found
    // update installs + activates and fires controllerchange (signal 3).
    const lastCheckRef = useRef(0)
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== "visible") return
            const now = Date.now()
            if (now - lastCheckRef.current < UPDATE_CHECK_INTERVAL_MS) return
            lastCheckRef.current = now
            navigator.serviceWorker?.getRegistration().then((registration) => registration?.update()).catch(() => { })
        }
        document.addEventListener("visibilitychange", onVisible)
        return () => document.removeEventListener("visibilitychange", onVisible)
    }, [])

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{_("Raven was updated")}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {_("A new version of the app is available. Refresh to load it - some things may not work until you do.")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{_("Later")}</AlertDialogCancel>
                    <Button type="button" size="md" variant="solid" onClick={() => window.location.reload()}>
                        {_("Refresh")}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
