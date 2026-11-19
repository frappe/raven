import { useState } from 'react'
import { useFrappeGetCall, useFrappePostCall } from 'frappe-react-sdk'
import { toast } from 'sonner'
import { Input } from '@components/ui/input'
import { Separator } from '@components/ui/separator'
import { errorResponseToast } from '@components/ui/error-banner'
import { SettingsFormDescription, SettingsFormLabel, SettingsFormRow } from '@components/ui/settings-dialog'
import { isRavenSettingsAdmin } from './AdminSettingsForm'
import { formatBytes } from '@raven/lib/utils/operations'
import _ from '@lib/translate'

type UploadSettings = {
    /** As stored in System Settings; 0 falls back to the default. */
    max_file_size_mb: number
    /** Bytes used when max_file_size_mb is 0 (site_config or 25 MB). */
    default_max_file_size: number
    /** Most this user may set, in bytes; null for System Managers. */
    max_allowed_file_size: number | null
}

const MB = 1024 * 1024

/**
 * Admin-only Preferences row for System Settings' max file size, which applies
 * to everyone's uploads. Renders nothing for anyone but Raven Admins and System Managers.
 */
export const FileUploadsAdminSection = ({ withLeadingSeparator = true }: { withLeadingSeparator?: boolean }) => {
    // Gate before the row so its fetch never runs for non-admins (it would 403).
    if (!isRavenSettingsAdmin()) return null
    return <MaxFileSizeRow withLeadingSeparator={withLeadingSeparator} />
}

const MaxFileSizeRow = ({ withLeadingSeparator }: { withLeadingSeparator: boolean }) => {
    const { data, mutate } = useFrappeGetCall<{ message: UploadSettings }>('raven.api.upload_file.get_upload_settings')
    const settings = data?.message

    return (
        <>
            {withLeadingSeparator && <Separator />}
            <SettingsFormRow>
                <div className="flex flex-col">
                    <SettingsFormLabel htmlFor="max_file_size">{_('Max file size')}</SettingsFormLabel>
                    {settings && (
                        <SettingsFormDescription id="max_file_size_description">
                            {settings.max_allowed_file_size
                                ? _('Largest file anyone can attach, in MB, up to {0}. The site default is {1}.', [formatBytes(settings.max_allowed_file_size), formatBytes(settings.default_max_file_size)])
                                : _('Largest file anyone can attach, in MB. The site default is {0}.', [formatBytes(settings.default_max_file_size)])}
                        </SettingsFormDescription>
                    )}
                </div>
                {/* Keyed on the stored value so a save reseeds the draft. */}
                {settings && (
                    <MaxFileSizeInput
                        key={settings.max_file_size_mb}
                        storedMB={settings.max_file_size_mb}
                        defaultMB={Math.round(settings.default_max_file_size / MB)}
                        onSaved={(mb) => mutate({ message: { ...settings, max_file_size_mb: mb } }, { revalidate: false })}
                    />
                )}
            </SettingsFormRow>
        </>
    )
}

/** 0 means the site default, shown as an empty field with the default as placeholder. */
const toDraft = (mb: number) => (mb ? String(mb) : '')

type MaxFileSizeInputProps = { storedMB: number; defaultMB: number; onSaved: (mb: number) => void }

const MaxFileSizeInput = ({ storedMB, defaultMB, onSaved }: MaxFileSizeInputProps) => {
    const [draft, setDraft] = useState(toDraft(storedMB))
    const { call, loading } = useFrappePostCall<{ message: number }>('raven.api.upload_file.set_max_file_size')

    const commit = () => {
        if (loading) return
        // Blank or 0 falls back to the site default.
        const value = draft.trim() || '0'
        // Whole MB only: the server would round a decimal down without saying so.
        if (!/^\d+$/.test(value)) {
            setDraft(toDraft(storedMB))
            toast.error(_('Enter a whole number of MB, or leave it empty for the site default.'))
            return
        }
        const mb = Number(value)
        if (mb === storedMB) {
            setDraft(toDraft(storedMB))
            return
        }

        // The server enforces the caps and explains a refusal.
        call({ max_file_size_mb: mb })
            .then((res) => {
                // The composer reads this on every attach, so the new limit applies without a reload.
                if (window.frappe?.boot) window.frappe.boot.max_file_size = res.message
                toast.success(_('Settings updated'))
                onSaved(mb)
            })
            .catch((error) => {
                setDraft(toDraft(storedMB))
                errorResponseToast(_('Could not update settings'), error)
            })
    }

    return (
        <div className="flex shrink-0 items-center gap-2">
            <Input
                id="max_file_size"
                aria-describedby="max_file_size_description"
                type="number"
                inputMode="numeric"
                enterKeyHint="done"
                min={0}
                step={1}
                // Native spinners aren't part of Espresso; arrow keys still step the value.
                className="w-20 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                placeholder={String(defaultMB)}
                value={draft}
                disabled={loading}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                }}
            />
            <span className="text-base md:text-sm text-ink-gray-5">{_('MB')}</span>
        </div>
    )
}
