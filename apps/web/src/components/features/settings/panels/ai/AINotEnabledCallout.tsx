import { useSetAtom } from "jotai"
import { useRavenSettings } from "@hooks/fetchers/useRavenSettings"
import { Alert, AlertTitle } from "@components/ui/alert"
import { settingsDialogOpenTab } from "@components/features/settings/settingsDialogAtom"
import _ from "@lib/translate"
import { InfoIcon } from "lucide-react"

/**
 * Info callout shown when AI integration is off or no provider is configured.
 * Renders nothing once AI is enabled and at least one provider is set.
 */
export const AINotEnabledCallout = () => {
    const { ravenSettings } = useRavenSettings()
    const setOpenTab = useSetAtom(settingsDialogOpenTab)

    const isAIEnabled = ravenSettings?.enable_ai_integration === 1
    const hasOpenAI = ravenSettings?.enable_openai_services === 1
    const hasLocalLLM = ravenSettings?.enable_local_llm === 1

    if (isAIEnabled && (hasOpenAI || hasLocalLLM)) {
        return null
    }

    const message = !isAIEnabled
        ? _("Raven AI is not enabled. Please enable it in")
        : _("No AI providers are configured. Please configure at least one provider in")

    return (
        <Alert theme="blue">
            <InfoIcon />
            <AlertTitle className="text-start">
                {/* Single child: AlertDescription is a grid, separate children stack as rows. */}
                {message}{" "}
                <span
                    role="button"
                    className="underline underline-offset-2 font-medium"
                    onClick={() => setOpenTab("ai-settings")}
                >
                    {_("AI Settings")}
                </span>
            </AlertTitle>
        </Alert>
    )
}

export default AINotEnabledCallout
