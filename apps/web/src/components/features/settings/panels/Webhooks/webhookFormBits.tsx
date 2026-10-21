/** Small shared field helpers for the webhook form tabs. */
import type { UseFormSetValue } from "react-hook-form"
import type { RavenWebhook } from "@raven/types/RavenIntegrations/RavenWebhook"

export const FieldError = ({ message }: { message?: string }) =>
    message ? <p className="text-p-sm text-ink-red-3">{message}</p> : null

export const FieldHelp = ({ children }: { children: React.ReactNode }) => (
    <p className="text-p-sm text-ink-gray-5">{children}</p>
)

/** Clears every condition value. Used when the condition field or the trigger changes. */
export const clearConditionValues = (setValue: UseFormSetValue<RavenWebhook>) => {
    setValue("condition", "")
    setValue("channel_id", "")
    setValue("user", "")
    setValue("channel_type", "")
}
