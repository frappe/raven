import { siteFetch } from "@lib/site"

type SetupEvent = "started_setup" | "completed_setup_step" | "skipped_setup_step" | "went_back_in_setup" | "left_setup"
type SetupEventProperties = Partial<{ mode: string; step: string; from_step: string; to_step: string; step_number: number; total_steps: number; duration_seconds: number | null }>

/**
 * One event of setup's funnel, sent straight with fetch rather than the SDK: a page being left
 * needs `keepalive`, so the request outlives the page. Best effort; a failure is ignored.
 */
export const sendSetupEvent = (event: SetupEvent, properties: SetupEventProperties, keepalive = false) =>
    siteFetch("/api/method/raven.api.setup.record_setup_event", {
        method: "POST",
        keepalive,
        headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": window.csrf_token ?? "" },
        body: JSON.stringify({ event, properties }),
    }).catch(() => { })

/** Seconds since `since`, or null when there's no start yet. */
export const secondsSince = (since: number | null): number | null => (since ? Math.round((Date.now() - since) / 1000) : null)
