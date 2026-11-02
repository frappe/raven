import { useMemo, useState, type ReactNode } from "react"
import { fileSrc } from "@hooks/useFileSrc"
import { parseContactJson } from "@lib/contact"
import type { Message } from "@raven/types/common/Message"
import { ContactCard } from "./ContactCard"
import { ContactDetails } from "./ContactDetails"

/** A Contact message: the card plus its details sheet; `fallback` renders an unreadable payload. */
export const MessageContact = ({ message, fallback }: { message: Message; fallback: ReactNode }) => {
    // Parsed once per payload; MessageContent renders this for every visible card.
    const contact = useMemo(() => parseContactJson(message.json), [message.json])
    const [open, setOpen] = useState(false)
    const file = message.message_type === "Contact" ? message.file : undefined
    const photoUrl = file ? fileSrc(file) : undefined

    if (!contact) return fallback

    return (
        <div data-message-id={message.name}>
            <ContactCard contact={contact} photoUrl={photoUrl} onOpen={() => setOpen(true)} />
            {open && <ContactDetails contact={contact} photoUrl={photoUrl} onClose={() => setOpen(false)} />}
        </div>
    )
}
