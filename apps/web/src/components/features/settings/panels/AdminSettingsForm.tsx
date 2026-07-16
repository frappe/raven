import { useEffect } from "react"
import { FieldValues, useForm, UseFormReturn } from "react-hook-form"
import { useFrappeUpdateDoc } from "frappe-react-sdk"
import { toast } from "sonner"
import { useRavenSettings } from "@hooks/fetchers/useRavenSettings"
import { hasRole } from "@lib/permissions"
import { Alert, AlertDescription } from "@components/ui/alert"
import { Button } from "@components/ui/button"
import { Form } from "@components/ui/form"
import { Spinner } from "@components/ui/spinner"
import {
    SettingsPanelContent,
    SettingsPanelDescription,
    SettingsPanelHeader,
    SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import type { RavenSettings } from "@raven/types/Raven/RavenSettings"
import _ from "@lib/translate"

/** Only Raven Admins / System Managers may edit Raven Settings. */
export const isRavenSettingsAdmin = () => hasRole("Raven Admin") || hasRole("System Manager")

/**
 * Shared scaffold for the admin-facing Raven Settings panels (AI, HR, Notifications).
 * Handles the whole lifecycle: fetch the single doc, seed the form once it loads,
 * gate editing behind the admin role, save via updateDoc (merging with the current
 * doc so untouched fields aren't wiped), and mutate the cache. Panels just supply
 * their fields as children — they read form state through useFormContext.
 *
 * The Save button lives in the panel header (outside the <form>), wired by `form`
 * id — same pattern as the Profile panel.
 */
export function AdminSettingsForm<T extends FieldValues>({
    title,
    description,
    formId,
    children,
}: {
    title: string
    description: string
    formId: string
    children: (form: UseFormReturn<T>) => React.ReactNode
}) {
    const { ravenSettings, mutate, isLoading } = useRavenSettings()
    const { updateDoc, loading: saving } = useFrappeUpdateDoc<RavenSettings>()
    const isAdmin = isRavenSettingsAdmin()

    const form = useForm<T>({ disabled: !isAdmin })

    // Seed once the doc arrives (and reset when it changes underneath us).
    useEffect(() => {
        if (ravenSettings) form.reset(ravenSettings as unknown as T)
    }, [ravenSettings]) // eslint-disable-line react-hooks/exhaustive-deps

    const onSubmit = (data: T) => {
        if (!ravenSettings) return
        toast.promise(
            // Merge over the current doc so we only change this panel's fields.
            updateDoc("Raven Settings", ravenSettings.name, { ...ravenSettings, ...data }).then((res) =>
                mutate(res, { revalidate: false }),
            ),
            { loading: _("Saving…"), success: _("Settings updated"), error: _("Could not update settings") },
        )
    }

    return (
        <>
            <SettingsPanelHeader
                actions={
                    <Button type="submit" form={formId} size="sm" loading={saving} disabled={!isAdmin || isLoading}>
                        {_("Save")}
                    </Button>
                }
            >
                <SettingsPanelTitle>{title}</SettingsPanelTitle>
                <SettingsPanelDescription>{description}</SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent>
                {isLoading ? (
                    <div className="flex h-full items-center justify-center"><Spinner /></div>
                ) : (
                    <Form {...form}>
                        <form id={formId} onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                            {!isAdmin && (
                                <Alert theme="gray">
                                    <AlertDescription>
                                        {_("You need the Raven Admin role to change these settings.")}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {children(form)}
                        </form>
                    </Form>
                )}
            </SettingsPanelContent>
        </>
    )
}
