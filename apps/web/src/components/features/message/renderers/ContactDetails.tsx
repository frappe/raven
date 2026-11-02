import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { getDefaultStore, useSetAtom } from "jotai"
import { CopyIcon, MailIcon, MessageSquare, PhoneIcon, UserPlus, UserRound } from "lucide-react"
import { toast } from "sonner"
import { useCopyToClipboard } from "usehooks-ts"
import { Button } from "@components/ui/button"
import { DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { ResponsiveDialog } from "@components/features/message/actions/dialogs/ResponsiveDialog"
import { settingsDialogOpenTab } from "@components/features/settings/settingsDialogAtom"
import { useCreateDM } from "@hooks/useCreateDM"
import { useIsMobile } from "@hooks/use-mobile"
import { contactHref, type ContactField, type ContactPayload } from "@lib/contact"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { channelDrawerAtom, pollDrawerAtom } from "@utils/channelAtoms"
import { hasNativePlugin } from "../../../../native/platform"
import { saveContact } from "../../../../native/contacts"
import { ContactAvatar } from "./ContactAvatar"
import { useContactUser } from "./useContactUser"

// Detail and action rows share one look; icons sit in the same lane.
const rowClass =
    "flex min-h-11 w-full items-center md:min-h-8 gap-3 rounded-md px-3 text-start text-base text-ink-gray-8 outline-none hover:bg-surface-gray-2 active:bg-surface-gray-2 focus-visible:focus-ring disabled:cursor-default disabled:text-ink-gray-4 md:text-sm [&>svg]:size-4.5 [&>svg]:shrink-0 [&>svg]:text-ink-gray-6"

type DetailRowProps = {
    field: ContactField
    kind: "phone" | "email"
    onCopy: (value: string) => void
}

const DetailRow = ({ field, kind, onCopy }: DetailRowProps) => {
    return (
        <div className="flex items-center gap-1">
            <a href={contactHref(kind, field.value)} className={cn(rowClass, "flex-1")}>
                {kind === "phone" ? <PhoneIcon /> : <MailIcon />}
                <span dir="ltr" className="min-w-0 flex-1 wrap-anywhere py-2.5 md:py-1.5">
                    {field.value}
                </span>
                {field.label && (
                    <span className="max-w-1/3 text-end text-sm break-words text-ink-gray-6">{field.label}</span>
                )}
            </a>
            <Button
                variant="ghost"
                size="md"
                isIconButton
                className="size-11 md:size-7"
                aria-label={_("Copy {0}", [field.value])}
                onClick={() => onCopy(field.value)}
            >
                <CopyIcon />
            </Button>
        </div>
    )
}

type ContactDetailsProps = {
    contact: ContactPayload
    photoUrl?: string
    onClose: () => void
}

/** The contact's rows and actions: the desktop popover's content, and the mobile sheet's. */
export const ContactDetails = ({ contact, photoUrl, onClose }: ContactDetailsProps) => {
    const isMobile = useIsMobile()
    const navigate = useNavigate()
    const setSettingsTab = useSetAtom(settingsDialogOpenTab)
    const contactUser = useContactUser(contact)
    const { createDM } = useCreateDM()
    const [, copy] = useCopyToClipboard()

    const copyValue = (value: string) =>
        void copy(value).then((copied) =>
            copied ? toast.success(_("Copied to clipboard")) : toast.error(_("Failed to copy to clipboard")),
        )

    const [saving, setSaving] = useState(false)
    const save = () => {
        if (saving) return
        setSaving(true)
        // The system editor shows whether it saved; Cancel there must not read as success here.
        void saveContact(contact, photoUrl)
            .catch(() => toast.error(_("Couldn't save the contact. Try again.")))
            .finally(() => setSaving(false))
    }

    const canSave = hasNativePlugin("RavenContacts")

    const viewProfile = (user: NonNullable<typeof contactUser>) => {
        // Your own profile: the Profile page on mobile, the Profile settings tab on desktop.
        if (user.isSelf) {
            if (isMobile) navigate("/profile")
            else setSettingsTab("profile")
            onClose()
            return
        }
        // Someone else's profile is their DM's details drawer, which the DM header's View profile opens too.
        void createDM(user.user.name).then((channel) => {
            if (!channel) return
            getDefaultStore().set(channelDrawerAtom(channel), "files")
            getDefaultStore().set(pollDrawerAtom(channel), null)
            onClose()
        })
    }

    const actions = contactUser ? (
        <>
            {!contactUser.isSelf && (
                <button
                    type="button"
                    className={rowClass}
                    // Close only once the DM opened; a failed create shows its own toast.
                    onClick={() => void createDM(contactUser.user.name).then((channel) => channel && onClose())}
                >
                    <MessageSquare />
                    {/* Names the Raven user, which can differ from the contact's own name. */}
                    {_("Message {0}", [contactUser.user.full_name || contactUser.user.name])}
                </button>
            )}
            <button type="button" className={rowClass} onClick={() => viewProfile(contactUser)}>
                <UserRound />
                {_("View profile")}
            </button>
        </>
    ) : null

    return (
        <>
            {/* The desktop popover opens at the card, which already shows the avatar and name. */}
            {isMobile && (
                <div className="flex items-center gap-3.5 px-3 pb-4 pt-2">
                    <ContactAvatar name={contact.name} photoUrl={photoUrl} size={56} />
                    <span className="min-w-0 break-words text-2xl-medium text-ink-gray-9">{contact.name}</span>
                </div>
            )}
            {contact.phones.map((phone, index) => (
                <DetailRow key={`phone-${index}`} field={phone} kind="phone" onCopy={copyValue} />
            ))}
            {contact.emails.map((email, index) => (
                <DetailRow key={`email-${index}`} field={email} kind="email" onCopy={copyValue} />
            ))}
            {(actions || canSave) && <div className="my-1 border-t border-outline-gray-2" />}
            {actions}
            {canSave && (
                <button type="button" className={rowClass} disabled={saving} onClick={save}>
                    <UserPlus />
                    {_("Save to contacts")}
                </button>
            )}
        </>
    )
}

/** Mobile: the contact as a bottom sheet. */
export const ContactSheet = (props: ContactDetailsProps) => (
    <ResponsiveDialog open onClose={props.onClose} bodyClassName="gap-1 p-3 pb-6">
        <DrawerTitle className="sr-only">{props.contact.name}</DrawerTitle>
        <DrawerDescription className="sr-only">{_("Contact details")}</DrawerDescription>
        <ContactDetails {...props} />
    </ResponsiveDialog>
)
