import { siteFetch } from "@lib/site"
import { bumpConnectionEpoch } from "@stores/connectionFreshness"
import { setSiteReachable } from "@stores/connectionState"

// The socket is the cheap signal, not the verdict: realtime can be down while the site answers.
// While the socket is down a ping decides, and keeps deciding until the socket is back.
const PING_EVERY_MS = 15_000
const PING_TIMEOUT_MS = 8_000
let pinging: ReturnType<typeof setInterval> | undefined

// Any answer short of a server error is the site talking: an expired token's 401 is no outage.
// A network that swallows packets never answers, so the ping gives up by itself.
const ping = () => {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), PING_TIMEOUT_MS)
    return siteFetch("/api/method/ping", { cache: "no-store", signal: abort.signal })
        .then((res) => res.status < 500, () => false)
        .finally(() => clearTimeout(timer))
}

// Coming back marks every window suspect, like the browser's online event, so failed views refetch.
const recovered = () => { if (setSiteReachable(true)) bumpConnectionEpoch() }

const check = async () => {
    const ok = await ping()
    // The socket came back while this ping was out: its answer is stale.
    if (!pinging) return
    if (ok) recovered()
    else setSiteReachable(false)
}

export const socketDown = () => {
    pinging ??= setInterval(check, PING_EVERY_MS)
    check()
}

export const socketUp = () => {
    clearInterval(pinging)
    pinging = undefined
    recovered()
}

// The network returning is the likeliest end of an outage: ask at once, not at the next tick.
if (typeof window !== "undefined") window.addEventListener("online", () => { if (pinging) check() })
