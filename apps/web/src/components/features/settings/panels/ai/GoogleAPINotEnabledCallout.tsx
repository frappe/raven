import { useRavenSettings } from "@hooks/fetchers/useRavenSettings"
import { Alert, AlertDescription } from "@components/ui/alert"
import _ from "@lib/translate"

/**
 * Info callout shown when Google APIs are off or no Project ID is set.
 * Renders nothing once Google APIs are enabled and a Project ID is present.
 */
export const GoogleAPINotEnabledCallout = () => {
    const { ravenSettings } = useRavenSettings()

    const hasGoogleApis = ravenSettings?.enable_google_apis === 1
    const hasGoogleProjectId = Boolean(ravenSettings?.google_project_id)

    if (hasGoogleApis && hasGoogleProjectId) {
        return null
    }

    const message = !hasGoogleApis
        ? _("Google APIs are not enabled. Please enable them in Raven Settings")
        : _("No Google Project ID is set. Please set a Project ID in Raven Settings")

    return (
        <Alert theme="blue">
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    )
}

export default GoogleAPINotEnabledCallout
