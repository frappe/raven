import type { FieldValues } from "react-hook-form"
import { CircleCheckIcon, CircleOffIcon } from "lucide-react"
import { Badge } from "@components/ui/badge"
import { DropdownMenuItem } from "@components/ui/dropdown-menu"
import type { RecordMenuContext } from "./SettingsRecordEditor"
import _ from "@lib/translate"

type Enabled = { enabled?: 0 | 1; disabled?: 0 | 1 }
/** Some doctypes store the flag the other way round, as `disabled`. */
type FlagField = "enabled" | "disabled"

const isOn = (doc: Enabled, field: FlagField) => (field === "disabled" ? !doc.disabled : Boolean(doc.enabled))

/**
 * Enable/Disable item for SettingsRecordEditor's menu slot.
 * This item owns the flag field. The form must not render its own control for it,
 * or a stale edit would survive the post-toggle reset and the next Save would undo the toggle.
 */
export const EnabledMenuItem = <T extends FieldValues & Enabled>({
    doc, loading, update, field = "enabled",
}: RecordMenuContext<T> & { field?: FlagField }) => {
    const isEnabled = isOn(doc, field)
    const nextValue = field === "disabled" ? (isEnabled ? 1 : 0) : (isEnabled ? 0 : 1)
    const toggle = () => update({ [field]: nextValue } as Partial<T>, isEnabled ? _("Disabled") : _("Enabled"))
    return (
        <DropdownMenuItem onClick={toggle} disabled={loading}>
            {isEnabled ? <CircleOffIcon /> : <CircleCheckIcon />}
            {isEnabled ? _("Disable") : _("Enable")}
        </DropdownMenuItem>
    )
}

/** Enabled/Disabled status badge for SettingsRecordEditor's badge slot. */
export const EnabledBadge = ({ doc, field = "enabled" }: { doc: Enabled; field?: FlagField }) => {
    const on = isOn(doc, field)
    return (
        <Badge variant="subtle" theme={on ? "green" : "gray"}>
            {on ? _("Enabled") : _("Disabled")}
        </Badge>
    )
}
