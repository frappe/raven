import { useEffect, useId, useState } from "react"
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
import { cn } from "@lib/utils"
import type { PickedContact } from "../../../../native/contacts"
import { canSendContact, contactTicks } from "./shareSelection"

type FieldSectionProps = {
    contactIndex: number
    heading: string
    kind: "phone" | "email"
    fields: ContactField[]
    ticked: Set<string>
    onToggle: (key: string) => void
}

const FieldSection = ({ contactIndex, heading, kind, fields, ticked, onToggle }: FieldSectionProps) =>
    fields.length > 0 && (
        <div className="flex flex-col">
            <span className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
                {heading}
            </span>
            {fields.map((field, index) => {
                const key = `${contactIndex}:${kind}:${index}`
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

/** One contact gets a large header; several get a compact heading each. */
const ContactHeading = ({ contact, id, large }: { contact: PickedContact; id: string; large: boolean }) => {
    const photoUrl = usePhotoUrl(contact.photo)
    return (
        <div className={cn("flex items-center px-3", large ? "gap-3.5 pb-3 pt-2" : "gap-3 pb-1 pt-5")}>
            <ContactAvatar name={contact.name} photoUrl={photoUrl} size={large ? 56 : 40} />
            <span
                id={id}
                className={cn("min-w-0 break-words text-ink-gray-9", large ? "text-xl-medium" : "text-base-medium")}
            >
                {contact.name}
            </span>
        </div>
    )
}

type ShareContactSheetProps = {
    contacts: PickedContact[]
    sending: boolean
    onClose: () => void
    onSend: (contacts: PickedContact[], ticked: Set<string>) => void
}

/** The picked contacts, with every phone and email ticked until the user removes one. */
export const ShareContactSheet = ({ contacts, sending, onClose, onSend }: ShareContactSheetProps) => {
    const groupId = useId()
    const isMobile = useIsMobile()
    const [ticked, setTicked] = useState(() => contactTicks(contacts))

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
                    onClick={() => onSend(contacts, ticked)}
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
            <Title className="px-3 pt-2 text-lg-medium">{contacts.length > 1 ? _("Share contacts") : _("Share contact")}</Title>
            <Description className="sr-only">{_("Choose the details to share")}</Description>
            {contacts.map((contact, contactIndex) => (
                // A group named by its contact, so each "Mobile" row says whose number it is.
                <div key={contactIndex} role="group" aria-labelledby={`${groupId}-${contactIndex}`} className="flex flex-col">
                    <ContactHeading contact={contact} id={`${groupId}-${contactIndex}`} large={contacts.length === 1} />
                    <FieldSection
                        contactIndex={contactIndex}
                        heading={_("Phone")}
                        kind="phone"
                        fields={contact.phones}
                        ticked={ticked}
                        onToggle={toggle}
                    />
                    <FieldSection
                        contactIndex={contactIndex}
                        heading={_("Email")}
                        kind="email"
                        fields={contact.emails}
                        ticked={ticked}
                        onToggle={toggle}
                    />
                </div>
            ))}
        </ResponsiveDialog>
    )
}
