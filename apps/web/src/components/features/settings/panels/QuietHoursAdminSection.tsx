import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useFrappeUpdateDoc } from 'frappe-react-sdk'
import { toast } from 'sonner'
import { MoonIcon } from 'lucide-react'
import { useRavenSettings } from '@hooks/fetchers/useRavenSettings'
import { hasRole } from '@lib/permissions'
import { SYSTEM_TIMEZONE } from '@lib/date'
import { Button } from '@components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@components/ui/dialog'
import { Input } from '@components/ui/input'
import { Separator } from '@components/ui/separator'
import { Switch } from '@components/ui/switch'
import { SettingsFormDescription, SettingsFormLabel, SettingsFormRow } from '@components/ui/settings-dialog'
import type { RavenSettings } from '@raven/types/Raven/RavenSettings'
import _ from '@lib/translate'
import { useAtomValue, useSetAtom } from 'jotai'
import { quietHoursConfigAtom, timeFormatAtom } from '@utils/preferences'
import { formatStoredTime } from '@utils/quietHours'
import { Label } from '@components/ui/label'

/**
 * Admin-only tail row of the Preferences panel: the ORG's quiet-hours window
 * (Raven Settings), same shape as LinkSettingsAdminSection. Applies to
 * everyone — members choose how their composer reacts to it (the per-user
 * "Quiet hours" preference above). Renders nothing without the admin role.
 */
export const QuietHoursAdminSection = ({ withSeparator = true }: { withSeparator?: boolean }) => {
    const isAdmin = hasRole('Raven Admin') || hasRole('System Manager')
    // Gate before the row component so its hooks never run for non-admins
    // (the settings fetch would 403 anyway).
    if (!isAdmin) return null
    return <QuietHoursAdminRow withSeparator={withSeparator} />
}

/** Stored Time ("H:MM:SS" / "HH:MM:SS") → <input type="time"> value ("HH:MM"). */
const toInputTime = (stored?: string): string => {
    if (!stored) return ''
    const [hours = '', minutes = ''] = stored.split(':')
    if (!hours || !minutes) return ''
    return `${hours.padStart(2, '0')}:${minutes}`
}

/** "HH:MM" from the input → the stored Time format. */
const toStoredTime = (value: string): string => (value ? `${value}:00` : '')

/** Snap "HH:MM" to the nearest half hour — the picker offers half-hour steps,
 *  but typed input (and values saved from desk) can be anything. 23:50 rounds
 *  UP to 00:00, which the range logic reads as wrapping midnight — correct. */
const snapToHalfHour = (value: string): string => {
    const [hours, minutes] = value.split(':').map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return value
    const snapped = Math.round((hours * 60 + minutes) / 30) * 30
    const total = snapped % (24 * 60)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const QuietHoursAdminRow = ({ withSeparator }: { withSeparator: boolean }) => {
    const { ravenSettings } = useRavenSettings()
    const timeFormat = useAtomValue(timeFormatAtom)

    const enabled = !!ravenSettings?.enable_quiet_hours
    // Formats the LIVE saved values (not boot — a just-saved change shows
    // immediately), in the viewing admin's own time format.
    const summary = enabled
        ? `${formatStoredTime(ravenSettings?.working_hours_start, timeFormat)} to ${formatStoredTime(ravenSettings?.working_hours_end, timeFormat)}`
        : _('Configure')

    return (
        <>
            {/* No leading separator when this is the section's first row
                (the section header already separates it). */}
            {withSeparator && <Separator />}

            <SettingsFormRow>
                <div className="flex flex-col">
                    <SettingsFormLabel>
                        <span className="flex items-center gap-1.5">
                            <MoonIcon className="size-4 shrink-0 text-ink-gray-6" />
                            {_('Working hours')}
                        </span>
                    </SettingsFormLabel>
                    <SettingsFormDescription>
                        {_("Set working hours for your organization, so Raven can nudge users to send messages silently during off-work hours.")}
                    </SettingsFormDescription>
                </div>
                <div className="flex justify-end">
                    <QuietHoursDialog
                        trigger={
                            <Button variant="subtle" size="sm">
                                {summary}
                            </Button>
                        }
                    />
                </div>
            </SettingsFormRow>
        </>
    )
}

type QuietHoursForm = {
    enabled: boolean
    start: string
    end: string
}

/**
 * The org working-hours editor. Used two ways: with a `trigger` (the settings
 * row's summary button), or CONTROLLED via open/onOpenChange with no trigger —
 * the quiet-hours banner opens it from a menu item, where a DialogTrigger
 * can't live (the menu unmounts its items on select).
 */
export const QuietHoursDialog = ({ trigger, open: controlledOpen, onOpenChange }: {
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}) => {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = controlledOpen ?? internalOpen
    const setOpen = onOpenChange ?? setInternalOpen
    const { ravenSettings, mutate } = useRavenSettings()
    const { updateDoc, loading: saving } = useFrappeUpdateDoc<RavenSettings>()
    // Boot carries this config for everyone else; the saving admin's own
    // session applies it live through the atom (banner, send default,
    // preferences row) instead of waiting for a reload.
    const setQuietHoursConfig = useSetAtom(quietHoursConfigAtom)

    const form = useForm<QuietHoursForm>({ defaultValues: { enabled: false, start: '09:00', end: '18:00' } })
    const enabled = form.watch('enabled')

    // Seed from the stored settings on every open.
    useEffect(() => {
        if (!open) return
        form.reset({
            enabled: !!ravenSettings?.enable_quiet_hours,
            start: toInputTime(ravenSettings?.working_hours_start) || '09:00',
            end: toInputTime(ravenSettings?.working_hours_end) || '18:00',
        })
    }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

    const onSubmit = (data: QuietHoursForm) => {
        if (!ravenSettings) return
        if (data.enabled && (!data.start || !data.end)) {
            toast.error(_('Set both start and end times'))
            return
        }
        // Half-hour grid: the picker steps by 30 min, but typed values can be
        // anything — snap them rather than reject.
        const start = snapToHalfHour(data.start)
        const end = snapToHalfHour(data.end)
        // Equal times are a degenerate window the client treats as "off" —
        // block them here so the setting can't LOOK enabled while doing nothing.
        // An end before the start is fine: that's an overnight shift.
        // Checked AFTER snapping: 09:10 and 09:20 both snap to 09:00.
        if (data.enabled && start === end) {
            toast.error(_('Start and end times cannot be the same'))
            return
        }
        // Merge over the current doc so untouched settings survive.
        toast.promise(
            updateDoc('Raven Settings', ravenSettings.name, {
                ...ravenSettings,
                enable_quiet_hours: data.enabled ? 1 : 0,
                working_hours_start: data.enabled ? toStoredTime(start) : ravenSettings.working_hours_start,
                working_hours_end: data.enabled ? toStoredTime(end) : ravenSettings.working_hours_end,
            })
                .then((res) => mutate(res, { revalidate: false }))
                .then(() => {
                    setQuietHoursConfig(
                        data.enabled
                            ? { working_hours_start: toStoredTime(start), working_hours_end: toStoredTime(end) }
                            : null,
                    )
                    setOpen(false)
                }),
            { loading: _('Saving…'), success: _('Settings updated'), error: _('Could not update settings') },
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MoonIcon className="size-5 shrink-0 text-ink-gray-6" />
                        {_('Quiet hours')}
                    </DialogTitle>
                    <DialogDescription>
                        {_("Raven can nudge users to send messages silently outside work hours.")}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="enable_quiet_hours">
                            {_('Enable quiet hours')}
                        </Label>
                        <Switch
                            size="md"
                            id="enable_quiet_hours"
                            checked={enabled}
                            onCheckedChange={(checked) => form.setValue('enabled', checked)}
                        />
                    </div>
                    <div className='flex flex-col gap-2'>
                        <div className="flex items-end gap-3">
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <Label htmlFor="working_hours_start">
                                    {_('Working hours start')}
                                </Label>
                                {/* step = 30 min: the native picker offers the half-hour
                                    grid; typed values get snapped on save. */}
                                <Input id="working_hours_start" type="time" step={1800} {...form.register('start', {
                                    disabled: !enabled,
                                })} />
                            </div>
                            <span className="pb-2 text-sm text-ink-gray-4">{_('to')}</span>
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <Label htmlFor="working_hours_end">
                                    {_('Working hours end')}
                                </Label>
                                <Input id="working_hours_end" type="time" step={1800} {...form.register('end', {
                                    disabled: !enabled,
                                })} />
                            </div>
                        </div>
                        {/* Times are measured on the SITE's clock, not each member's. */}
                        <p className="text-p-sm text-ink-gray-5">
                            {_("Times are in {0}. An end before the start means an overnight shift.", [SYSTEM_TIMEZONE])}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            {_('Cancel')}
                        </Button>
                        <Button type="submit" loading={saving}>
                            {_('Save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
