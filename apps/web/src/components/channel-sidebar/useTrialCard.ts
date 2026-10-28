import { getBilling, type BillingTrial } from "@frappe/cloud-sdk/api"
import { useAtomValue } from "jotai"
import { useCallback, useEffect, useRef, useState } from "react"
import { cloudSettingsOpenAtom, isCloudSettingsAvailable } from "@hooks/useCloudSettings"
import { useIsMobile } from "@hooks/use-mobile"
import { siteKey } from "@lib/site"

/** Days left change once a day, and each fetch goes through Pilot and Central, uncached. */
const CACHE_MS = 6 * 60 * 60 * 1000
/** A dismissed card comes back after a day. */
const DISMISS_MS = 24 * 60 * 60 * 1000

type CachedTrial = { trial: BillingTrial | null; fetchedAt: number }

const cacheKey = () => siteKey("trial-card")
const dismissKey = () => siteKey("trial-card-dismissed-at")

/** The trial from the last fetch, if it is recent enough. */
const readCache = (): CachedTrial | null => {
    try {
        const cached = JSON.parse(localStorage.getItem(cacheKey()) ?? "null") as CachedTrial | null
        return cached && Date.now() - cached.fetchedAt < CACHE_MS ? cached : null
    } catch {
        return null
    }
}

const loadTrial = async (): Promise<BillingTrial | null> => {
    const { trial } = await getBilling()
    const cached: CachedTrial = { trial: trial ?? null, fetchedAt: Date.now() }
    try {
        localStorage.setItem(cacheKey(), JSON.stringify(cached))
    } catch {
        // Storage blocked: the next load fetches again.
    }
    return cached.trial
}

/** One request at a time: callers that overlap share it. */
let pending: Promise<BillingTrial | null> | null = null
const fetchTrial = () => {
    pending ??= loadTrial().finally(() => {
        pending = null
    })
    return pending
}

const isDismissed = () => {
    try {
        return Date.now() - Number(localStorage.getItem(dismissKey()) ?? 0) < DISMISS_MS
    } catch {
        return false
    }
}

/**
 * The site's trial, for the card at the bottom of the sidebar. Only for System Managers on a
 * Frappe Cloud v2 site, and only on desktop web. Checked again when the billing dialog closes,
 * since choosing a plan there ends the trial.
 *
 * @returns The trial to show, null when there is none, and a function that hides the card for a day.
 */
export const useTrialCard = () => {
    const isMobile = useIsMobile()
    const enabled = isCloudSettingsAvailable() && !isMobile
    const [trial, setTrial] = useState<BillingTrial | null>(() => readCache()?.trial ?? null)
    const [dismissed, setDismissed] = useState(isDismissed)
    const dialogOpen = useAtomValue(cloudSettingsOpenAtom)
    const dialogWasOpen = useRef(false)

    const refresh = useCallback(() => {
        fetchTrial()
            .then(setTrial)
            .catch(() => {
                // The card is a reminder. If billing can't be read, show nothing new.
            })
    }, [])

    useEffect(() => {
        if (enabled && !readCache()) refresh()
    }, [enabled, refresh])

    useEffect(() => {
        if (dialogWasOpen.current && !dialogOpen && enabled) refresh()
        dialogWasOpen.current = dialogOpen
    }, [dialogOpen, enabled, refresh])

    const dismiss = () => {
        try {
            localStorage.setItem(dismissKey(), String(Date.now()))
        } catch {
            // Storage blocked: the card stays hidden until the next load.
        }
        setDismissed(true)
    }

    // An ended trial has no dismiss button, and an earlier dismissal does not hide it.
    const hidden = !enabled || !trial || (dismissed && trial.state !== "Ended")
    return { trial: hidden ? null : trial, dismiss }
}
