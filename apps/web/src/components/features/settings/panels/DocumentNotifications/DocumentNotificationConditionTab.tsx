import { useFormContext, useWatch } from "react-hook-form"
import { Textarea } from "@components/ui/textarea"
import { Label } from "@components/ui/label"
import type { RavenDocumentNotification } from "@raven/types/RavenIntegrations/RavenDocumentNotification"
import _ from "@lib/translate"
import { DoctypeVariables } from "./DoctypeVariables"

/** Conditions tab — optional Jinja expression gating whether the alert is sent. */
export const DocumentNotificationConditionTab = () => {
    const { register, control } = useFormContext<RavenDocumentNotification>()
    const documentType = useWatch({ control, name: "document_type" })

    return (
        <div className="flex flex-col gap-5 w-full">
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="condition">{_("Condition")}</Label>
                <Textarea
                    id="condition"
                    className="min-h-[100px]"
                    placeholder='e.g. doc.docstatus == 1'
                    {...register("condition")}
                />
                <p className="text-p-sm text-ink-gray-5">{_("Optional: the notification is sent only if this expression is true.")}</p>
                <pre className="rounded-md bg-surface-gray-2 p-3 text-p-sm text-ink-gray-7">
                    <span className="font-medium">{_("Some examples:")}</span>{"\n"}
                    doc.status == "Open"{"\n"}
                    doc.status == "Received" or doc.status == "Partially Received"{"\n"}
                    doc.total {">"} 10000
                </pre>
            </div>

            {documentType && <DoctypeVariables doctype={documentType} withoutJinja />}
        </div>
    )
}

export default DocumentNotificationConditionTab
