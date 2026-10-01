import { useEffect } from "react"
import { AlertCircle, CloudOff, WifiOff } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { Button } from "@components/ui/button"
import { Spinner } from "@components/ui/spinner"
import _ from "@lib/translate"
import type { BootStatus } from "./appBoot"
import { switchSite } from "./session"

type Shown = Exclude<BootStatus, "ok" | "unauthorized"> | "connecting"

/** Boot is slow or failed with a session in hand: say why, retry, or pick another site. */
export const BootErrorScreen = ({ status, host }: { status: Shown; host: string }) => {
    useEffect(() => {
        if (status !== "offline") return
        const reload = () => { window.location.replace("/") }
        window.addEventListener("online", reload)
        return () => window.removeEventListener("online", reload)
    }, [status])
    return (
        <main className="flex min-h-dvh items-center justify-center bg-surface-white px-4 pt-[var(--inset-top)]">
            <div className="flex w-full max-w-md flex-col gap-3">
                <Alert>
                    {status === "connecting" ? <Spinner /> : status === "offline" ? <WifiOff /> : status === "unreachable" ? <CloudOff /> : <AlertCircle />}
                    <AlertTitle>
                        {status === "connecting" && _("Connecting to {0}", [host])}
                        {status === "offline" && _("You're offline")}
                        {status === "unreachable" && _("{0} isn't responding", [host])}
                        {status === "maintenance" && _("{0} is under maintenance", [host])}
                        {status === "unavailable" && _("Couldn't load Raven")}
                    </AlertTitle>
                    <AlertDescription>
                        {status === "connecting" && _("This is taking longer than usual.")}
                        {status === "offline" && _("Check your connection. Raven will retry when the network is back.")}
                        {status === "unreachable" && _("The site may be down or its address may have changed.")}
                        {status === "maintenance" && _("The site is in maintenance mode. Try again in a few minutes.")}
                        {status === "unavailable" && _("The site answered with an error. Try again in a moment.")}
                    </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                    {status !== "connecting" && <Button variant="solid" className="flex-1" onClick={() => { window.location.replace("/") }}>{_("Retry")}</Button>}
                    <Button variant="outline" className="flex-1" onClick={() => { switchSite() }}>{_("Switch site")}</Button>
                </div>
            </div>
        </main>
    )
}
