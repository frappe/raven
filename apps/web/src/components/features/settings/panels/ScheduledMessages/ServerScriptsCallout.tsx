import { TriangleAlertIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import _ from "@lib/translate"

/**
 * Scheduled messages run as Server Scripts, which a site enables in its config.
 * Shown only when boot says they are off; without the flag in boot nothing is shown.
 */
export const ServerScriptsCallout = () => {
    const enabled = (window?.frappe?.boot as { server_script_enabled?: boolean } | undefined)?.server_script_enabled
    if (enabled !== false) return null
    return (
        <Alert theme="amber">
            <TriangleAlertIcon />
            <AlertTitle className="text-start">{_("Server scripts are not enabled on this site.")}</AlertTitle>
            <AlertDescription>
                {_("Scheduled messages run as server scripts. Ask your site administrator to set server_script_enabled in the site config and restart the site.")}
            </AlertDescription>
        </Alert>
    )
}

export default ServerScriptsCallout
