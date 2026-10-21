import { useEffect } from "react"
import { AlertCircle, WifiOffIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { Button } from "@components/ui/button"
import _ from "@lib/translate"
import { isLoggedIn } from "@lib/sessionUser"

/** Check if the user has the Raven User role */
export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {

    // A GUEST lacking the role isn't a permissions problem — they're just not
    // logged in, and App.tsx is redirecting them to login. Render nothing so
    // the "no access" alert can't flash at them on the way out (it's meant for
    // LOGGED-IN users who genuinely lack the Raven User role).
    if (!isLoggedIn()) {
        return null
    }

    // Roles can be UNKNOWN, not just missing: an offline launch without a
    // cached boot (browser tabs never cache boot; a first offline launch has
    // no cache yet) leaves window.frappe.boot empty. That is a connectivity
    // problem, not a permissions one — this used to fall into the "no role"
    // alert below and told offline users to contact their administrator.
    // Only a PRESENT roles list can prove the role is actually absent.
    const roles = window.frappe?.boot?.user?.roles
    if (!roles) {
        return <BootUnavailableScreen />
    }

    if (!roles.includes('Raven User')) {
        return <div className="h-screen w-screen flex justify-center items-center">
            <div>
                <Alert
                    theme="red"
                >
                    <AlertCircle />
                    <AlertTitle>{_('You cannot access Raven.')}</AlertTitle>
                    <AlertDescription>{_('You do not have the "Raven User" role. Please contact your system administrator.')}</AlertDescription>
                </Alert>
            </div >

        </div >
    }

    return children

}

/**
 * The app shell loaded but boot never arrived — an offline launch with no
 * cached boot, or the boot request failed. Say that, instead of guessing at
 * permissions. Reloads by itself the moment the connection comes back.
 */
const BootUnavailableScreen = () => {
    useEffect(() => {
        const reload = () => window.location.reload()
        window.addEventListener('online', reload)
        return () => window.removeEventListener('online', reload)
    }, [])

    return (
        <div className="h-screen w-screen flex justify-center items-center">
            <div className="flex max-w-md flex-col gap-3 px-4">
                <Alert>
                    <WifiOffIcon />
                    <AlertTitle>{_("Couldn't load Raven")}</AlertTitle>
                    <AlertDescription>
                        {navigator.onLine
                            ? _("Your account details couldn't be loaded. Please try again in a moment.")
                            : _("You appear to be offline. Raven will load as soon as you're back online.")}
                    </AlertDescription>
                </Alert>
                <Button variant="outline" onClick={() => window.location.reload()}>
                    {_("Retry")}
                </Button>
            </div>
        </div>
    )
}
