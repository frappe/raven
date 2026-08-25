import { useFormContext } from "react-hook-form"
import { DataField, SwitchFormField } from "@components/ui/form-elements"
import { Label } from "@components/ui/label"
import { Textarea } from "@components/ui/textarea"
import { useIsMobile } from "@hooks/use-mobile"
import { useRavenSettings } from "@hooks/fetchers/useRavenSettings"
import type { RavenBot } from "@raven/types/RavenBot/RavenBot"
import AINotEnabledCallout from "../ai/AINotEnabledCallout"
import _ from "@lib/translate"

/** General fields for a Raven Bot — name, description, and the AI agent toggle. */
const AgentGeneralTab = () => {
    const { register } = useFormContext<RavenBot>()
    const { ravenSettings } = useRavenSettings()
    const isMobile = useIsMobile()

    return (
        <div className="flex flex-col gap-4">
            <div className="md:w-1/2">
                <DataField
                    name="bot_name"
                    label={_("Name")}
                    isRequired
                    rules={{ required: _("Name is required") }}
                    inputProps={{ placeholder: "accounts-bot", autoFocus: !isMobile }}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">{_("Description")}</Label>
                <Textarea
                    id="description"
                    {...register("description")}
                    rows={5}
                    placeholder={_("A bot to handle accounts")}
                />
            </div>
            <AINotEnabledCallout />
            <SwitchFormField
                name="is_ai_bot"
                label={_("Is AI Agent")}
                formDescription={_("Check to enable AI features for this bot")}
                disabled={!ravenSettings?.enable_ai_integration}
            />
        </div>
    )
}

export default AgentGeneralTab
