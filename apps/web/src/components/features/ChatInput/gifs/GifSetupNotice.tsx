import { useId, useState } from "react"
import { useFrappeUpdateDoc } from "frappe-react-sdk"
import { ImagePlayIcon, KeyRoundIcon } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import { Input } from "@components/ui/input"
import { Button } from "@components/ui/button"
import { useRavenSettings } from "@hooks/fetchers/useRavenSettings"
import { KlipyError, verifyKlipyKey } from "@lib/klipy"
import { isRavenSettingsAdmin } from "@lib/permissions"
import _ from "@lib/translate"
import type { RavenSettings } from "@raven/types/Raven/RavenSettings"
import { GifGridSkeleton } from "./GifPicker"

const keyError = (error: unknown) => {
    const status = error instanceof KlipyError ? error.status : -1
    if (status === 0) return _("Unable to reach KLIPY. Check your connection and try again.")
    if (status === 429) return _("Too many requests to KLIPY. Try again in a few minutes.")
    if (status >= 400 && status < 500) return _("KLIPY didn't accept this key. Make sure it is correct.")
    return _("Unable to save the key. Try again.")
}

/**
 * Sits where the picker's search box does. Checks the key with KLIPY, then saves it;
 * boot carries it for everyone else on their next load.
 */
const KlipyKeyField = ({ onEnabled }: { onEnabled: () => void }) => {
    const { ravenSettings, mutate } = useRavenSettings()
    const { updateDoc } = useFrappeUpdateDoc<RavenSettings>()
    const [apiKey, setApiKey] = useState("")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const errorId = useId()

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        const key = apiKey.trim()
        if (!key) return setError(_("Enter your KLIPY API key"))
        if (!ravenSettings || saving) return
        setSaving(true)
        try {
            await verifyKlipyKey(key)
            // Merge over the current doc so untouched settings survive.
            mutate(await updateDoc("Raven Settings", ravenSettings.name, { ...ravenSettings, klipy_api_key: key }), { revalidate: false })
        } catch (error) {
            setError(keyError(error))
            return
        } finally {
            setSaving(false)
        }
        // This session's boot predates the key; the picker reads it from there.
        window.frappe.boot.klipy_api_key = key
        onEnabled()
    }

    return (
        <form onSubmit={submit} noValidate className="relative flex gap-2">
            <div className="relative flex-1">
                <KeyRoundIcon className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-gray-5" aria-hidden="true" />
                <Input
                    className="ps-8"
                    value={apiKey}
                    onChange={(e) => {
                        setApiKey(e.target.value)
                        setError("")
                    }}
                    placeholder={_("Enter a KLIPY API key")}
                    aria-label={_("KLIPY API key")}
                    aria-invalid={!!error}
                    aria-describedby={error ? errorId : undefined}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                />
            </div>
            <Button type="submit" size="md" loading={saving} disabled={!ravenSettings}>
                {_("Enable")}
            </Button>
            {/* Over the grid's top edge, so the grid doesn't shift while the error comes and goes. */}
            {error && <p id={errorId} role="alert" className="absolute inset-x-0 top-full z-10 mt-1.5 text-p-sm text-ink-red-6">{error}</p>}
        </form>
    )
}

/** The GIF popover on a site without a KLIPY key, laid out like the picker. Admins add the key here; others learn who can. */
export const GifSetupNotice = ({ onEnabled }: { onEnabled: () => void }) => {
    const isAdmin = isRavenSettingsAdmin()

    return (
        <div className="flex h-full min-h-0 flex-col gap-2">
            {isAdmin && <KlipyKeyField onEnabled={onEnabled} />}
            {/* -mx cancels the tiles' side padding, so their edges line up with the field, as in the picker. */}
            <div className="relative -mx-0.75 min-h-0 flex-1 overflow-hidden">
                {/* The picker's grid, still and faded out behind the text. */}
                <div className="h-full [mask-image:linear-gradient(to_bottom,black,transparent_25%,transparent_75%,black)]">
                    <GifGridSkeleton still />
                </div>
                <Empty className="absolute inset-0 min-h-0 gap-2 px-3 py-4">
                    <EmptyMedia className="size-6 [&_svg:not([class*='size-'])]:size-6">
                        <ImagePlayIcon />
                    </EmptyMedia>
                    <EmptyHeader>
                        <EmptyTitle className="text-base-medium">{_("GIFs aren't set up")}</EmptyTitle>
                        <EmptyDescription>
                            {isAdmin ? (
                                <>
                                    {_("Get a key from the")}{" "}
                                    <a href="https://partner.klipy.com" target="_blank" rel="noreferrer" className="text-ink-blue-link">
                                        {_("KLIPY Partner Panel")}
                                    </a>
                                    {" "}{_("to let people search and send GIFs.")}
                                </>
                            ) : _("Ask a Raven admin to add a KLIPY API key.")}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </div>
        </div>
    )
}
