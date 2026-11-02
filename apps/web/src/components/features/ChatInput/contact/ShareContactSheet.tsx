import { useEffect, useState } from "react"
import { AlertDialogFooter } from "@components/ui/alert-dialog"
import { Button } from "@components/ui/button"
import { Checkbox } from "@components/ui/checkbox"
import { DialogDescription, DialogTitle } from "@components/ui/dialog"
import { DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { ResponsiveDialog } from "@components/features/message/actions/dialogs/ResponsiveDialog"
import { ContactAvatar } from "@components/features/message/renderers/ContactAvatar"
import { useIsMobile } from "@hooks/use-mobile"
import type { ContactField } from "@lib/contact"
import _ from "@lib/translate"
import type { PickedContact } from "../../../../native/contacts"
import { canSendContact, contactTicks } from "./shareSelection"

type FieldSectionProps = {
    heading: string
    kind: "phone" | "email"
    fields: ContactField[]
    ticked: Set<string>
    onToggle: (key: string) => void
}

const FieldSection = ({ heading, kind, fields, ticked, onToggle }: FieldSectionProps) =>
    fields.length > 0 && (
        <div className="flex flex-col">
            <span className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
                {heading}
            </span>
            {fields.map((field, index) => {
                const key = `${kind}:${index}`
                return (
                    <label
                        key={key}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 hover:bg-surface-gray-2 active:bg-surface-gray-2 md:min-h-8"
                    >
                        <span className="min-w-0 flex-1 py-1">
                            <span dir="ltr" className="block wrap-anywhere text-base text-ink-gray-8 md:text-sm">
                                {field.value}
                            </span>
                            {field.label && <span className="block text-sm text-ink-gray-6">{field.label}</span>}
                        </span>
                        <Checkbox checked={ticked.has(key)} onCheckedChange={() => onToggle(key)} />
                    </label>
                )
            })}
        </div>
    )

/** A web picker photo is a Blob, a native one base64 JPEG. */
const usePhotoUrl = (photo: PickedContact["photo"]) => {
    const [url, setUrl] = useState<string>()
    useEffect(() => {
        if (!photo) return setUrl(undefined)
        if (typeof photo === "string") return setUrl(`data:image/jpeg;base64,${photo}`)
        // Created in the effect so its cleanup always revokes the URL it made.
        const objectUrl = URL.createObjectURL(photo)
        setUrl(objectUrl)
        return () => URL.revokeObjectURL(objectUrl)
    }, [photo])
    return url
}

type ShareContactSheetProps = {
    contact: PickedContact
    sending: boolean
    onClose: () => void
    onSend: (contact: PickedContact, ticked: Set<string>) => void
}

/** The picked contact, with every phone and email ticked until the user removes one. */
export const ShareContactSheet = ({ contact, sending, onClose, onSend }: ShareContactSheetProps) => {
    const isMobile = useIsMobile()
    const [ticked, setTicked] = useState(() => contactTicks(contact))
    const photoUrl = usePhotoUrl(contact.photo)

    const toggle = (key: string) =>
        setTicked((current) => {
            const next = new Set(current)
            if (!next.delete(key)) next.add(key)
            return next
        })

    const Title = isMobile ? DrawerTitle : DialogTitle
    const Description = isMobile ? DrawerDescription : DialogDescription

    const canSend = canSendContact(ticked)
    const footer = (
        <>
            {/* In the pinned footer, so a long contact can't scroll it out of sight. */}
            {!canSend && (
                <p className="shrink-0 px-6 pt-2 text-sm text-ink-gray-6 md:px-3">
                    {_("Select at least one phone number or email")}
                </p>
            )}
            <AlertDialogFooter className="shrink-0 px-3 pb-6 pt-3 md:px-3 md:pb-0">
                <Button type="button" variant="outline" size="md" className="h-11 md:h-8" onClick={onClose}>
                    {_("Cancel")}
                </Button>
                <Button
                    type="button"
                    size="md"
                    className="h-11 md:h-8"
                    loading={sending}
                    disabled={sending || !canSend}
                    onClick={() => onSend(contact, ticked)}
                >
                    {_("Send")}
                </Button>
            </AlertDialogFooter>
        </>
    )

    return (
        <ResponsiveDialog
            open
            onClose={onClose}
            footer={footer}
            bodyClassName="gap-1 px-3 pt-0"
            dialogClassName="gap-1 sm:max-w-sm"
        >
            <Title className="px-3 pt-2 text-lg-medium">{_("Share contact")}</Title>
            <Description className="sr-only">{_("Choose the details to share")}</Description>
            <div className="flex items-center gap-3.5 px-3 pb-3 pt-2">
                <ContactAvatar name={contact.name} photoUrl={photoUrl} size={56} />
                <span className="min-w-0 break-words text-xl-medium text-ink-gray-9">{contact.name}</span>
            </div>
            <FieldSection heading={_("Phone")} kind="phone" fields={contact.phones} ticked={ticked} onToggle={toggle} />
            <FieldSection heading={_("Email")} kind="email" fields={contact.emails} ticked={ticked} onToggle={toggle} />
        </ResponsiveDialog>
    )
}
