import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { getStatusIndicatorColor } from "@components/features/message/UserAvatar"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { Drawer, DrawerContent, DrawerTitle } from "@components/ui/drawer"
import { FrappeError } from "frappe-react-sdk"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import { errorResponseToast } from "@components/ui/error-banner"

const STATUS_OPTIONS = [
    { value: "Available", label: _("Available") },
    { value: "Away", label: _("Away") },
    { value: "Do not disturb", label: _("Do not disturb") },
    { value: "Invisible", label: _("Invisible") },
] as const

type ProfileFormValues = {
    full_name: string
    availability_status: string
    custom_status: string
}

/**
 * Bottom sheet for editing the current user's profile details (name, availability, status).
 * The profile photo is edited on the profile page's avatar instead (see ProfileImageMenu).
 * A react-hook-form form is re-seeded from the SWR `my_profile` each time the sheet opens;
 * submit sends a single frappe.client.set_value POST (raven.api.raven_users.update_raven_user
 * is deprecated in v3), then revalidates my_profile and closes. Save is disabled until
 * something changes.
 */
export function EditProfileDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { myProfile, mutate } = useCurrentRavenUser()
    const { call } = useFrappePostCall("frappe.client.set_value")

    const form = useForm<ProfileFormValues>({
        defaultValues: { full_name: "", availability_status: "", custom_status: "" },
    })

    // Latest profile in a ref so the seed effect below can read it without depending on
    // it — a background my_profile revalidation while the sheet is open (e.g. SWR refetch
    // on tab refocus) must NOT re-run the reset and wipe in-progress edits.
    const profileRef = useRef(myProfile)
    profileRef.current = myProfile

    // Re-seed the form from the latest profile when the sheet opens (also resets dirty state).
    useEffect(() => {
        const profile = profileRef.current
        if (!open || !profile) return
        form.reset({
            full_name: profile.full_name ?? "",
            availability_status: profile.availability_status ?? "",
            custom_status: profile.custom_status ?? "",
        })
    }, [open, form])

    const onSubmit = async (values: ProfileFormValues) => {
        if (!myProfile?.name) return
        try {
            await call({ doctype: "Raven User", name: myProfile.name, fieldname: values })
            await mutate()
            toast.success(_("Profile updated"))
            onOpenChange(false)
        } catch (e) {
            errorResponseToast(_("Could not update profile"), e as FrappeError)
        }
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerTitle className="sr-only">{_("Edit profile")}</DrawerTitle>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 p-4 pb-2">
                        <h2 className="text-xl font-medium text-ink-gray-8">{_("Edit profile")}</h2>

                        {/* Full name */}
                        <FormField
                            control={form.control}
                            name="full_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{_("Name")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} className="h-9 text-xl md:text-base" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Availability */}
                        <FormField
                            control={form.control}
                            name="availability_status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{_("Availability")}</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger className="h-9 text-xl md:text-base">
                                                <SelectValue placeholder={_("Set availability")} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent align="start">
                                            {STATUS_OPTIONS.map((o) => (
                                                <SelectItem key={o.value} value={o.value}>
                                                    <span className="flex items-center gap-2">
                                                        <span className={cn("size-2 rounded-full", getStatusIndicatorColor(o.value))} />
                                                        {o.label}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Custom status */}
                        <FormField
                            control={form.control}
                            name="custom_status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{_("Status")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder={_("What's your status?")} className="h-9 text-xl md:text-base" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex gap-2 pt-4">
                            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => onOpenChange(false)}>{_("Cancel")}</Button>
                            <Button type="submit" size="lg" className="flex-1" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty}>{_("Save")}</Button>
                        </div>
                    </form>
                </Form>
            </DrawerContent>
        </Drawer>
    )
}
