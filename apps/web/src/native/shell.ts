import type { RavenShellPlugin } from "@raven/lib/utils/ravenShell"

// Dynamic import keeps @capacitor/core out of browser bundles; memoized because a second
// registerPlugin only logs "already registered". The proxy is wrapped in an object: a
// promise resolved with the proxy itself never settles (its `then` goes to native).
let shellPromise: Promise<{ shell: RavenShellPlugin }> | undefined
export const ravenShell = (): Promise<{ shell: RavenShellPlugin }> =>
    (shellPromise ??= import("@capacitor/core").then(({ registerPlugin }) => ({ shell: registerPlugin<RavenShellPlugin>("RavenShell") })))
