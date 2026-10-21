import { useRavenSettings } from "@hooks/fetchers/useRavenSettings"
import { Alert, AlertTitle } from "@components/ui/alert"
import _ from "@lib/translate"
import { InfoIcon } from "lucide-react"

/**
 * Info callout shown when Google APIs are off or no Project ID is set.
 * Renders nothing once Google APIs are enabled and a Project ID is present.
 */
export const GoogleAPINotEnabledCallout = () => {
    const { ravenSettings } = useRavenSettings()

    const hasGoogleApis = ravenSettings?.enable_google_apis === 1
    const hasGoogleProjectId = Boolean(ravenSettings?.google_project_id)

    const isAIEnabled = ravenSettings?.enable_ai_integration === 1
    const hasOpenAI = ravenSettings?.enable_openai_services === 1
    const hasLocalLLM = ravenSettings?.enable_local_llm === 1

    if (!isAIEnabled || !hasOpenAI || !hasLocalLLM) {
        return null
    }

    if (hasGoogleApis && hasGoogleProjectId) {
        return null
    }

    const message = !hasGoogleApis
        ? _("Google APIs are not enabled. Please enable them in Raven Settings")
        : _("No Google Project ID is set. Please set a Project ID in Raven Settings")

    return (
        <Alert theme="blue">
            <InfoIcon />
            <AlertTitle className="text-start">{message}</AlertTitle>
        </Alert>
    )
}

export default GoogleAPINotEnabledCallout
