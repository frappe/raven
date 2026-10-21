import { useFormContext, useWatch } from "react-hook-form"
import { DataField, SwitchFormField } from "@components/ui/form-elements"
import { Label } from "@components/ui/label"
import { Textarea } from "@components/ui/textarea"
import { useIsMobile } from "@hooks/use-mobile"
import type { RavenBot } from "@raven/types/RavenBot/RavenBot"
import AINotEnabledCallout from "../ai/AINotEnabledCallout"
import _ from "@lib/translate"

/** General fields for a Raven Bot — name, description, and the AI agent toggle. */
const AgentGeneralTab = ({ isEdit }: { isEdit?: boolean }) => {
    const { register } = useFormContext<RavenBot>()
    const isAiBot = useWatch<RavenBot>({ name: "is_ai_bot" })
    const isMobile = useIsMobile()

    return (
        <div className="flex flex-col gap-4">
            <div className="md:w-1/2">
                <DataField
                    name="bot_name"
                    label={_("Name")}
                    isRequired
                    readOnly={isEdit}
                    rules={{ required: _("Name is required") }}
                    inputProps={{ placeholder: "accounts-bot", autoFocus: !isMobile && !isEdit }}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">{_("Description")}</Label>
                <Textarea
                    id="description"
                    {...register("description")}
                    autoFocus={isEdit}
                    rows={5}
                    placeholder={_("A bot to handle accounts")}
                />
            </div>
            <SwitchFormField
                name="is_ai_bot"
                label={_("Is AI Agent")}
                formDescription={_("Check to enable AI features for this bot")}
            />
            {/* The switch stays usable when AI is off. Turning it on is what
                surfaces the setup callout, which renders nothing once AI is
                enabled with a provider. */}
            {isAiBot ? <AINotEnabledCallout /> : null}
        </div>
    )
}

export default AgentGeneralTab
