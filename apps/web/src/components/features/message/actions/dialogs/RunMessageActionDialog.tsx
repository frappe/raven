import { FormProvider, useForm } from "react-hook-form"
import { useFrappeGetCall, useFrappeGetDoc, useFrappePostCall, type FrappeError } from "frappe-react-sdk"
import { toast } from "sonner"
import { LoaderCircle } from "lucide-react"
import { DialogFooter } from "@components/ui/dialog"
import { ResponsiveDialog, ResponsiveDialogHeader } from "./ResponsiveDialog"
import { Button } from "@components/ui/button"
import { SelectItem } from "@components/ui/select"
import {
    CheckboxFormField,
    DataField,
    DateField,
    LinkFormField,
    SelectFormField,
    SmallTextField,
} from "@components/ui/form-elements"
import ErrorBanner, { errorResponseToast } from "@components/ui/error-banner"
import _ from "@lib/translate"
import { coerceValues, describeField, requiredRule, seedDefaults } from "./messageActionFields"
import type { Message } from "@raven/types/common/Message"
import type { RavenMessageAction } from "@raven/types/RavenIntegrations/RavenMessageAction"
import type { RavenMessageActionFields } from "@raven/types/RavenIntegrations/RavenMessageActionFields"

export type RunMessageActionTarget = { message: Message; actionID: string }

/**
 * Runs a custom message action: fetches the action doc and its server-resolved
 * default values, renders the action's fields, and POSTs execute_action.
 *
 * Mounted once by MessageActionDialogs and driven by messageDialogAtom; stays
 * mounted (open toggles) so it animates closed, with `target` held from the last
 * dialog value so the body doesn't flash empty mid-animation. Desktop dialog,
 * mobile bottom sheet (ResponsiveDialog).
 */
export const RunMessageActionDialog = ({
    open,
    target,
    onClose,
}: {
    open: boolean
    target: RunMessageActionTarget | null
    onClose: () => void
}) => (
    <ResponsiveDialog open={open} onClose={onClose}>
        {target && (
            // Keyed per target: a fresh mount per action+message means the form
            // initializes straight from the resolved defaults — no reset() that
            // could stomp typed input (v2's bug).
            <RunMessageActionContent
                key={`${target.actionID}:${target.message.name}`}
                target={target}
                onClose={onClose}
            />
        )}
    </ResponsiveDialog>
)

const RunMessageActionContent = ({ target, onClose }: { target: RunMessageActionTarget; onClose: () => void }) => {
    const { data: action, error: actionError } = useFrappeGetDoc<RavenMessageAction>(
        "Raven Message Action",
        target.actionID,
        `message-action-${target.actionID}`,
        { revalidateOnFocus: false },
    )
    const { data: defaults, error: defaultsError } = useFrappeGetCall<{ message: Record<string, unknown> }>(
        "raven.api.message_actions.get_action_defaults",
        { action_id: target.actionID, message_id: target.message.name },
        `message-action-defaults-${target.actionID}-${target.message.name}`,
        { revalidateOnFocus: false },
    )

    const error = actionError ?? defaultsError
    if (error) {
        return (
            <>
                <ResponsiveDialogHeader title={_("Run action")} description={_("Could not load this action.")} hideDescription />
                <ErrorBanner error={error} />
            </>
        )
    }

    // Render the form only once BOTH the action and its defaults are in — the form
    // seeds from defaultValues on mount, so mounting early would show empty fields.
    if (!action || !defaults) {
        return (
            <>
                <ResponsiveDialogHeader title={_("Run action")} description={_("Loading action details")} hideDescription />
                <div className="flex justify-center py-8">
                    <LoaderCircle className="animate-spin text-ink-gray-5" />
                </div>
            </>
        )
    }

    return <RunMessageActionForm action={action} defaults={defaults.message} target={target} onClose={onClose} />
}

const RunMessageActionForm = ({
    action,
    defaults,
    target,
    onClose,
}: {
    action: RavenMessageAction
    defaults: Record<string, unknown>
    target: RunMessageActionTarget
    onClose: () => void
}) => {
    const methods = useForm({ defaultValues: seedDefaults(action.fields ?? [], defaults) })
    const { call: executeAction, loading } = useFrappePostCall<{
        message: { message: string; document?: string; doctype?: string; link?: string }
    }>("raven.api.message_actions.execute_action")

    const onSubmit = async (values: Record<string, unknown>) => {
        try {
            const response = await executeAction({
                action_id: action.name,
                message_id: target.message.name,
                values: coerceValues(action.fields ?? [], values),
            })
            onClose()
            const link = response.message?.link
            toast.success(action.success_message || _("Action completed"), {
                action: link
                    ? { label: _("View"), onClick: () => window.open(link, "_blank", "noopener,noreferrer") }
                    : undefined,
            })
        } catch (error) {
            // Dialog stays open with the values intact so the user can correct and retry.
            errorResponseToast(_("Could not run this action"), error as FrappeError)
        }
    }

    return (
        <FormProvider {...methods}>
            {/* min-w-0: DialogContent is a grid; without it a wide field would hold the
                form wider than the dialog on a narrow phone (see AttachToDocumentDialog). */}
            <form onSubmit={methods.handleSubmit(onSubmit)} className="flex min-w-0 flex-col gap-4">
                <ResponsiveDialogHeader title={action.title} description={action.description || action.action} />

                {(action.fields ?? []).map((field) => (
                    <MessageActionField key={field.fieldname} field={field} />
                ))}

                {/* Mobile: 50/50 side by side rather than DialogFooter's stacked default —
                    same treatment as the attach/delete dialogs. */}
                <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" size="md" disabled={loading} onClick={onClose}>
                        {_("Cancel")}
                    </Button>
                    <Button type="submit" size="md" disabled={loading}>
                        {loading ? _("Submitting...") : _("Submit")}
                    </Button>
                </DialogFooter>
            </form>
        </FormProvider>
    )
}

const MessageActionField = ({ field }: { field: RavenMessageActionFields }) => {
    const descriptor = describeField(field)
    const common = {
        name: field.fieldname,
        label: field.label,
        isRequired: field.is_required === 1,
        formDescription: field.helper_text,
        rules: requiredRule(field),
    }

    switch (descriptor.kind) {
        case "small-text":
            return <SmallTextField {...common} />
        case "select":
            return (
                <SelectFormField {...common}>
                    {descriptor.choices.map((choice) => (
                        <SelectItem key={choice} value={choice}>
                            {choice}
                        </SelectItem>
                    ))}
                </SelectFormField>
            )
        case "link":
            return <LinkFormField {...common} doctype={descriptor.doctype} />
        case "date":
            return <DateField {...common} />
        case "checkbox":
            return <CheckboxFormField {...common} />
        case "data":
            return <DataField {...common} inputProps={{ type: descriptor.inputType }} />
    }
}
