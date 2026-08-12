import { useEffect, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { useFrappeUpdateDoc } from 'frappe-react-sdk'
import { toast } from 'sonner'
import { Link2OffIcon, PlusIcon, XIcon } from 'lucide-react'
import { useRavenSettings } from '@hooks/fetchers/useRavenSettings'
import { hasRole } from '@lib/permissions'
import { Button } from '@components/ui/button'
import { Checkbox } from '@components/ui/checkbox'
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
import { SettingsFormDescription, SettingsFormLabel, SettingsFormRow } from '@components/ui/settings-dialog'
import { BRAND, BrandIcon } from '@components/features/message/renderers/BrandIcons'
import type { RavenSettings } from '@raven/types/Raven/RavenSettings'
import _ from '@lib/translate'

/**
 * Admin-only tail of the Preferences panel: the two link-related Raven
 * Settings (Frappe Meet sites, blocked link previews). These apply to
 * EVERYONE on the site — they only sit in Preferences for reachability.
 * Each row shows a summary ("4 links blocked"); the editing happens in a
 * dialog. Renders nothing without the Raven Admin role.
 */
export const LinkSettingsAdminSection = () => {
    const isAdmin = hasRole('Raven Admin') || hasRole('System Manager')
    // Gate before the rows component so its hooks never run for
    // non-admins (the settings fetch would 403 anyway).
    if (!isAdmin) return null
    return <AdminLinkSettingsRows />
}

const AdminLinkSettingsRows = () => {
    const { ravenSettings } = useRavenSettings()

    const meetHostCount = (ravenSettings?.frappe_meet_hosted_urls ?? '')
        .split('\n')
        .filter((line) => line.trim()).length
    const blockedCount = ravenSettings?.blocked_links?.length ?? 0

    return (
        <>
            <Separator />

            <SettingsFormRow>
                <div className="flex flex-col">
                    <SettingsFormLabel>
                        <span className="flex items-center gap-1.5">
                            <BrandIcon brand={BRAND.frappeMeet} className="size-4 shrink-0" />
                            {_('Frappe Meet sites')}
                        </span>
                    </SettingsFormLabel>
                    <SettingsFormDescription>
                        {_('Meeting links from these sites show a join card in chat. Applies to everyone.')}
                    </SettingsFormDescription>
                </div>
                <div className="flex justify-end">
                    <MeetSitesDialog
                        trigger={
                            <Button variant="subtle" size="sm">
                                {meetHostCount === 0
                                    ? _('Configure')
                                    : meetHostCount === 1
                                        ? _('1 site')
                                        : _('{0} sites', [String(meetHostCount)])}
                            </Button>
                        }
                    />
                </div>
            </SettingsFormRow>

            <Separator />

            <SettingsFormRow>
                <div className="flex flex-col">
                    <SettingsFormLabel>
                        <span className="flex items-center gap-1.5">
                            <Link2OffIcon className="size-4 shrink-0 text-ink-gray-6" />
                            {_('Blocked link previews')}
                        </span>
                    </SettingsFormLabel>
                    <SettingsFormDescription>
                        {_('Links matching these never show previews. Applies to everyone.')}
                    </SettingsFormDescription>
                </div>
                <div className="flex justify-end">
                    <BlockedLinksDialog
                        trigger={
                            <Button variant="subtle" size="sm">
                                {blockedCount === 0
                                    ? _('Configure')
                                    : blockedCount === 1
                                        ? _('1 link blocked')
                                        : _('{0} links blocked', [String(blockedCount)])}
                            </Button>
                        }
                    />
                </div>
            </SettingsFormRow>
        </>
    )
}

/**
 * Shared save for both dialogs: merge the changed fields over the current
 * doc (so untouched settings survive), mutate the cache, close on success.
 */
const useSaveLinkSettings = (onSaved: () => void) => {
    const { ravenSettings, mutate } = useRavenSettings()
    const { updateDoc, loading: saving } = useFrappeUpdateDoc<RavenSettings>()

    const save = (fields: Partial<RavenSettings>) => {
        if (!ravenSettings) return
        toast.promise(
            updateDoc('Raven Settings', ravenSettings.name, { ...ravenSettings, ...fields })
                .then((res) => mutate(res, { revalidate: false }))
                .then(onSaved),
            { loading: _('Saving…'), success: _('Settings updated'), error: _('Could not update settings') },
        )
    }

    return { ravenSettings, save, saving }
}

const MeetSitesDialog = ({ trigger }: { trigger: React.ReactNode }) => {
    const [open, setOpen] = useState(false)
    const { ravenSettings, save, saving } = useSaveLinkSettings(() => setOpen(false))

    // Object rows (not string[]) — the shape useFieldArray requires.
    const form = useForm<{ hosts: { host: string }[] }>({ defaultValues: { hosts: [] } })
    const hosts = useFieldArray({ control: form.control, name: 'hosts' })

    // Seed on every open, from the STORED newline-separated string —
    // admins manage a list; the string is an implementation detail.
    useEffect(() => {
        if (!open) return
        form.reset({
            hosts: (ravenSettings?.frappe_meet_hosted_urls ?? '')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((host) => ({ host })),
        })
    }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

    const onSubmit = (data: { hosts: { host: string }[] }) => {
        save({
            frappe_meet_hosted_urls: data.hosts
                .map((row) => row.host.trim())
                .filter(Boolean)
                .join('\n'),
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BrandIcon brand={BRAND.frappeMeet} className="size-5 shrink-0" />
                        {_('Frappe Meet sites')}
                    </DialogTitle>
                    <DialogDescription>
                        {_('Meeting links from these sites show a join card in chat.')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-2">
                    {hosts.fields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2">
                            <Input placeholder="meet.frappe.io" {...form.register(`hosts.${index}.host`)} />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                isIconButton
                                aria-label={_('Remove site')}
                                onClick={() => hosts.remove(index)}
                            >
                                <XIcon />
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="subtle"
                        size="sm"
                        className="w-fit"
                        onClick={() => hosts.append({ host: '' })}
                    >
                        <PlusIcon /> {_('Add site')}
                    </Button>
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

const BlockedLinksDialog = ({ trigger }: { trigger: React.ReactNode }) => {
    const [open, setOpen] = useState(false)
    const { ravenSettings, save, saving } = useSaveLinkSettings(() => setOpen(false))

    const form = useForm<{ links: { link: string; matchExact: boolean }[] }>({
        defaultValues: { links: [] },
    })
    const links = useFieldArray({ control: form.control, name: 'links' })

    useEffect(() => {
        if (!open) return
        form.reset({
            links: (ravenSettings?.blocked_links ?? []).map((row) => ({
                link: row.link,
                matchExact: !!row.match_exact,
            })),
        })
    }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

    const onSubmit = (data: { links: { link: string; matchExact: boolean }[] }) => {
        // Empty rows drop silently — clearing a row's text removes it.
        const blocked_links = data.links
            .map((row) => ({ link: row.link.trim(), match_exact: row.matchExact ? 1 : 0 }))
            .filter((row) => row.link)
        save({ blocked_links: blocked_links as unknown as RavenSettings['blocked_links'] })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{_('Blocked link previews')}</DialogTitle>
                    <DialogDescription>
                        {_('A row blocks its whole domain. Tick Exact to block just that one URL - like "frappe.io" can be blocked without losing previews on "frappe.io/blog".')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-2">
                    {links.fields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2">
                            <Input placeholder="frappe.io" {...form.register(`links.${index}.link`)} />
                            <Controller
                                control={form.control}
                                name={`links.${index}.matchExact`}
                                render={({ field: checkboxField }) => (
                                    <label
                                        className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm text-ink-gray-6"
                                        title={_('Block only this exact URL instead of the whole domain')}
                                    >
                                        <Checkbox
                                            checked={checkboxField.value}
                                            onCheckedChange={(checked) => checkboxField.onChange(checked === true)}
                                        />
                                        {_('Exact')}
                                    </label>
                                )}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                isIconButton
                                aria-label={_('Remove blocked link')}
                                onClick={() => links.remove(index)}
                            >
                                <XIcon />
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="subtle"
                        size="sm"
                        className="w-fit"
                        onClick={() => links.append({ link: '', matchExact: false })}
                    >
                        <PlusIcon /> {_('Add link')}
                    </Button>
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
