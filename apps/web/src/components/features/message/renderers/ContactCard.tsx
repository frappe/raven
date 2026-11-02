import { contactDetailLine, type ContactPayload } from "@lib/contact"
import { Button } from "@components/ui/button"
import _ from "@lib/translate"
import { ContactAvatar } from "./ContactAvatar"

type ContactCardProps = {
    contact: ContactPayload
    photoUrl?: string
    onOpen: () => void
}

/** The shared contact in the stream: one row that opens the details. */
export const ContactCard = ({ contact, photoUrl, onOpen }: ContactCardProps) => {
    const detail = contactDetailLine(contact)
    return (
        <div data-media-root="" className="w-full max-w-xs sm:max-w-sm">
            <button
                type="button"
                aria-label={_("View contact {0}, {1}", [contact.name, detail])}
                onClick={onOpen}
                className="flex w-full items-center gap-3 rounded-md border border-outline-gray-2 bg-surface-gray-1 p-3 text-start outline-none transition-colors hover:border-outline-gray-3 focus-visible:focus-ring dark:bg-surface-elevation-2"
            >
                <ContactAvatar name={contact.name} photoUrl={photoUrl} size={40} />
                <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="block truncate text-base-medium text-ink-gray-9">{contact.name}</span>
                    <span className="block truncate text-sm text-ink-gray-6">{detail}</span>
                </span>
                {/* The card is the control; render View as its visual affordance, not a nested button. */}
                <Button asChild variant="subtle" size="md" className="shrink-0">
                    <span aria-hidden>{_("View")}</span>
                </Button>
            </button>
        </div>
    )
}
