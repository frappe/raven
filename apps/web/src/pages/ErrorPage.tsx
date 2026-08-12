import { useNavigate, useRouteError } from "react-router-dom"
import { Button } from "@components/ui/button"
import _ from "@lib/translate"

/**
 * Router-level error boundary (the root route's errorElement) — the last-resort
 * screen for uncaught render/route errors, ported from v2's ErrorPage.
 *
 * Chunk-load failures right after a deploy get "update available" copy and a
 * reload CTA instead of scary error UI. AppUpdateAlert catches most of those
 * proactively (vite:preloadError); this is the backstop for the ones that
 * surface as render errors (e.g. a React.lazy import failing).
 *
 * Kept dependency-light on purpose: no stores, no Frappe context — it must
 * still render when the app is in a broken state.
 */
const ErrorPage = () => {
    const error = useRouteError() as Error | undefined
    const navigate = useNavigate()

    // The fingerprints browsers leave when a deployed build replaced the chunks
    // this session was built against.
    const message = error?.message ?? ""
    const isStaleBuild =
        message.includes("Failed to fetch dynamically imported module") ||
        message.includes("Importing a module script failed") ||
        message.includes("error loading dynamically imported module")

    return (
        <div className="flex h-dvh w-full items-center bg-surface-gray-2 p-16">
            <div className="flex w-full max-w-2xl flex-col items-start gap-4 text-left">
                <h1 className="text-3xl font-semibold text-ink-gray-9">
                    {isStaleBuild ? _("A new update is available.") : _("Chaos is a ladder.")}
                </h1>
                <p className="text-p-lg text-ink-gray-6">
                    {_("An unexpected error occurred. If you face this error again, please report it on")}{" "}
                    <a
                        href="https://github.com/The-Commit-Company/raven/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                    >
                        GitHub
                    </a>.
                </p>
                {!isStaleBuild && message && (
                    <details className="w-full text-left">
                        <summary className="cursor-pointer text-sm text-ink-gray-5">{_("Show error details")}</summary>
                        <code className="mt-2 block max-h-40 overflow-auto rounded-sm bg-surface-gray-4 p-2 text-left text-p-sm text-ink-gray-7">
                            {message}
                        </code>
                    </details>
                )}
                <div className="flex gap-2">
                    <Button onClick={() => window.location.reload()}>
                        {isStaleBuild ? _("Upgrade to a better experience") : _("Reload the page")}
                    </Button>
                    {!isStaleBuild && (
                        // "/" resolves to the last workspace + channel (IndexRedirect),
                        // and navigating away from an errored route clears the boundary.
                        <Button variant="outline" onClick={() => navigate("/")}>
                            {_("Back to channels")}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ErrorPage
