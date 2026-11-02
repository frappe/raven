import { useCallback, useState } from "react"
import { ChevronLeft, CopyIcon, MailIcon, MessageSquare, PhoneIcon, UserRound } from "lucide-react"
import { toast } from "sonner"
import { useCopyToClipboard } from "usehooks-ts"
import { Button } from "@components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { UserProfileDrawer } from "@components/features/dm-channel/UserProfileDrawer"
import { useCreateDM } from "@hooks/useCreateDM"
import { useIsMobile } from "@hooks/use-mobile"
import { contactHref, type ContactField, type ContactPayload } from "@lib/contact"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { ContactAvatar } from "./ContactAvatar"
import { useContactUser } from "./useContactUser"

// Detail and action rows share one look; icons sit in the same lane.
const rowClass =
    "flex min-h-11 w-full items-center md:min-h-8 gap-3 rounded-md px-3 text-start text-base text-ink-gray-8 outline-none hover:bg-surface-gray-2 active:bg-surface-gray-2 focus-visible:focus-ring md:text-sm [&>svg]:size-4.5 [&>svg]:shrink-0 [&>svg]:text-ink-gray-6"

type DetailRowProps = {
    field: ContactField
    kind: "phone" | "email"
    onCopy: (value: string) => void
}

const DetailRow = ({ field, kind, onCopy }: DetailRowProps) => {
    return (
        <div className="flex items-center gap-1">
            <a
                href={contactHref(kind, field.value)}
                className={cn(rowClass, "flex-1")}
            >
                {kind === "phone" ? <PhoneIcon /> : <MailIcon />}
                <span dir="ltr" className="min-w-0 flex-1 wrap-anywhere py-2.5 md:py-1.5">
                    {field.value}
                </span>
                {field.label && <span className="max-w-1/3 text-end text-sm break-words text-ink-gray-6">{field.label}</span>}
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

/** The full contact: phone and email rows plus the matched user's actions. */
export const ContactDetails = ({ contact, photoUrl, onClose }: ContactDetailsProps) => {
    const isMobile = useIsMobile()
    // "returned" is the contact view after Back, so focus can land on View profile.
    const [view, setView] = useState<"contact" | "profile" | "returned">("contact")
    // Focus follows a view swap; nothing is focused when the sheet first opens.
    const focusOnMount = useCallback((node: HTMLButtonElement | null) => node?.focus(), [])
    const contactUser = useContactUser(contact)
    const { createDM } = useCreateDM()
    const [, copy] = useCopyToClipboard()

    const copyValue = (value: string) =>
        void copy(value).then((copied) =>
            copied ? toast.success(_("Copied to clipboard")) : toast.error(_("Failed to copy to clipboard")),
        )

    const Title = isMobile ? DrawerTitle : DialogTitle
    const Description = isMobile ? DrawerDescription : DialogDescription

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
            <button
                type="button"
                ref={view === "returned" ? focusOnMount : undefined}
                className={rowClass}
                onClick={() => setView("profile")}
            >
                <UserRound />
                {_("View profile")}
            </button>
        </>
    ) : null

    const content =
        view === "profile" && contactUser ? (
            <>
                <Title className="sr-only">{contact.name}</Title>
                <Button
                    variant="ghost"
                    size="sm"
                    isIconButton
                    className="ms-1 self-start"
                    ref={focusOnMount}
                    aria-label={_("Back")}
                    onClick={() => setView("returned")}
                >
                    <ChevronLeft />
                </Button>
                <UserProfileDrawer user={contactUser.user} />
            </>
        ) : (
            <>
                <div className="flex items-center gap-3.5 px-3 pb-4 pt-2 md:pe-10">
                    <ContactAvatar name={contact.name} photoUrl={photoUrl} size={56} />
                    <Title className="min-w-0 break-words text-2xl-medium">{contact.name}</Title>
                </div>
                {contact.phones.map((phone, index) => (
                    <DetailRow key={`phone-${index}`} field={phone} kind="phone" onCopy={copyValue} />
                ))}
                {contact.emails.map((email, index) => (
                    <DetailRow key={`email-${index}`} field={email} kind="email" onCopy={copyValue} />
                ))}
                {actions && <div className="my-1 border-t border-outline-gray-2" />}
                {actions}
            </>
        )

    const body = (
        <div className={cn("flex min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain", isMobile ? "p-3 pb-6" : "pb-2")}>
            <Description className="sr-only">{_("Contact details")}</Description>
            {content}
        </div>
    )

    if (isMobile) {
        return (
            <Drawer open onOpenChange={(next) => !next && onClose()}>
                <DrawerContent className="max-h-[90dvh]" onOpenAutoFocus={(event) => event.preventDefault()}>
                    {body}
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="sm:max-w-sm">{body}</DialogContent>
        </Dialog>
    )
}
