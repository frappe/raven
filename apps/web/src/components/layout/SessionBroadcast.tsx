import { useEffect, useState } from "react"
import Cookies from "js-cookie"
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogFooter,
} from "@components/ui/alert-dialog"
import { Button } from "@components/ui/button"
import _ from "@lib/translate"

/**
 * Cross-tab session sync over a BroadcastChannel. The session expired and the user logged in
 * again in ANOTHER tab. This tab's session cookie is then valid again (cookies
 * are shared), so GETs work — but its `window.csrf_token` still belongs to the
 * DEAD session, so every POST fails with CSRFTokenError (HTTP 400, not the
 * 401/403/Guest signals authRecovery watches for). Stuck until a manual
 * refresh.
 *
 * The moment of re-login IS a fresh tab boot — so each booting tab announces
 * its token + user, and listening tabs:
 *  - same user  → adopt the fresh token (the SDK reads `window.csrf_token`
 *    per request, so patching it heals all future POSTs in place);
 *  - DIFFERENT user → show a refresh-only dialog. Patching the token would
 *    keep requests "working" — as the wrong person, under the old user's UI —
 *    so the only safe exit is a reload.
 *
 * The channel is named "frappe" ON PURPOSE: Frappe apps share an origin, and
 * other apps on the site use the same channel + message shape for this — a
 * login through any of them heals Raven tabs too. Payloads are validated
 * defensively since the channel is shared.
 */

/** The unrendered Jinja placeholder from the precached built index — not a token. */
const isRealToken = (token: unknown): token is string =>
    typeof token === "string" && token.length > 0 && token !== "{{ csrf_token }}"

const currentUserID = () => Cookies.get("user_id") ?? ""

type BootMessage = { event: "boot"; data: { csrf_token?: string; user?: string } }

export const SessionBroadcast = () => {
    const [userChanged, setUserChanged] = useState(false)

    useEffect(() => {
        if (typeof BroadcastChannel === "undefined") return
        const channel = new BroadcastChannel("frappe")
        const bootUserID = currentUserID()

        const onMessage = (message: MessageEvent) => {
            const payload = message.data as BootMessage | undefined
            if (payload?.event !== "boot" || !payload.data) return

            const { user, csrf_token } = payload.data
            if (user && user !== "Guest" && user !== bootUserID) {
                setUserChanged(true)
                return
            }
            if (isRealToken(csrf_token)) {
                window.csrf_token = csrf_token
            }
        }
        channel.addEventListener("message", onMessage)

        // Announce our own boot — a tab that just came through login carries
        // the fresh token every stale tab needs.
        if (isRealToken(window.csrf_token)) {
            channel.postMessage({
                event: "boot",
                data: { csrf_token: window.csrf_token, user: bootUserID },
            } satisfies BootMessage)
        }

        return () => {
            channel.removeEventListener("message", onMessage)
            channel.close()
        }
    }, [])

    return (
        // No dismiss action on purpose: this tab's cookies now belong to a
        // different user — anything done here acts as the wrong person.
        <AlertDialog open={userChanged}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{_("User changed")}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {_("Looks like you've logged in as another user from another tab. Refresh this page to continue.")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <Button type="button" size="md" variant="solid" onClick={() => window.location.reload()}>
                        {_("Refresh")}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
