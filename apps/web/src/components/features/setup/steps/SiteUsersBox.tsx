import { Check } from "lucide-react"
import { Button } from "@components/ui/button"
import { Checkbox } from "@components/ui/checkbox"
import { GroupedAvatars } from "@components/ui/grouped-avatars"
import _ from "@lib/translate"
import { SiteUsersDialog } from "./SiteUsersDialog"
import { siteUsersSummary } from "./siteUsersSummary"
import type { SiteUser } from "../types"

type SiteUsersBoxProps = {
    users: SiteUser[]
    added: boolean
    /** "Acme and #general", or "Acme" when the channel was skipped */
    where: string
    selected: Set<string>
    onSelectedChange: (selected: Set<string>) => void
}

/** "None selected", "All selected", or "3 of 12 selected". */
const selectedText = (chosen: number, total: number) =>
    chosen === 0 ? _("None selected") : chosen === total ? (total === 2 ? _("Both selected") : _("All selected")) : _("{0} of {1} selected", [String(chosen), String(total)])

/** People on the site: who's chosen to join and a picker to change that, or one person and a tick; once added, who came in. */
export const SiteUsersBox = ({ users, added, where, selected, onSelectedChange }: SiteUsersBoxProps) => {
    const chosen = users.filter((user) => selected.has(user.user))
    const shown = added ? users : chosen
    const one = users.length === 1 ? users[0] : undefined
    const avatars = (shown.length > 0 ? shown : users).map((user) => ({ name: user.user, full_name: user.full_name, user_image: user.user_image }))

    return (
        <section aria-label={_("Already on this site")} className="flex flex-col items-start gap-3 rounded-md border border-outline-gray-2 p-3 pt-4">
            <GroupedAvatars users={avatars} max={4} size="sm" />
            {added ? (
                <div className="flex flex-col gap-1">
                    <p className="flex items-center gap-2 text-base-medium text-ink-gray-8">
                        <Check className="size-4 shrink-0 text-ink-green-6" aria-hidden />
                        {_("Added to {0}", [where])}
                    </p>
                    <p className="text-p-sm text-ink-gray-5">
                        {one ? one.full_name || one.user : _("{0} people", [String(users.length)])}
                    </p>
                </div>
            ) : one ? (
                <>
                    <label className="flex items-center gap-2 text-base-medium text-ink-gray-8">
                        <Checkbox
                            checked={selected.has(one.user)}
                            disabled={one.addable === false}
                            onCheckedChange={(value) => onSelectedChange(value === true ? new Set([one.user]) : new Set())}
                        />
                        {_("Add {0} to {1}", [one.full_name || one.user, where])}
                    </label>
                    {/* Not addable: a Raven Admin can't give access (that saves the User), or, on Frappe 15,
                        the person's one role profile can't take Raven's. */}
                    {one.addable === false && (
                        <p className="text-p-sm text-ink-gray-5">
                            {one.role_profile ? _("Add the Raven User role to the {0} profile first.", [one.role_profile]) : _("A System Manager can add them.")}
                        </p>
                    )}
                </>
            ) : (
                <>
                    <div className="flex flex-col gap-1">
                        <p className="text-base-medium text-ink-gray-8">{siteUsersSummary(users)}</p>
                        <p className="text-p-sm text-ink-gray-5">
                            {selectedText(chosen.length, users.length)} · {_("They'll be added to {0}.", [where])}
                        </p>
                    </div>
                    <SiteUsersDialog
                        users={users}
                        selected={selected}
                        onSelectedChange={onSelectedChange}
                        trigger={<Button type="button" variant="subtle" size="sm">{_("Choose")}</Button>}
                    />
                </>
            )}
        </section>
    )
}
