import { useMemo, useState, type ReactNode } from "react"
import { Popover, PopoverAnchor, PopoverContent } from "@components/ui/popover"
import { fileSrc } from "@hooks/useFileSrc"
import { useIsMobile } from "@hooks/use-mobile"
import { parseContactJson } from "@lib/contact"
import type { Message } from "@raven/types/common/Message"
import { ContactCard } from "./ContactCard"
import { ContactDetails, ContactSheet } from "./ContactDetails"

/** A Contact message: the card, with its details in a popover on desktop and a sheet on mobile. */
export const MessageContact = ({ message, fallback }: { message: Message; fallback: ReactNode }) => {
    // Parsed once per payload; MessageContent renders this for every visible card.
    const contact = useMemo(() => parseContactJson(message.json), [message.json])
    const isMobile = useIsMobile()
    const [open, setOpen] = useState(false)
    const file = message.message_type === "Contact" ? message.file : undefined
    const photoUrl = file ? fileSrc(file) : undefined

    if (!contact) return fallback

    const card = <ContactCard contact={contact} photoUrl={photoUrl} onOpen={() => setOpen(true)} />
    const close = () => setOpen(false)

    if (isMobile) {
        return (
            <div data-message-id={message.name}>
                {card}
                {open && <ContactSheet contact={contact} photoUrl={photoUrl} onClose={close} />}
            </div>
        )
    }

    // Small details, so a popover at the card, as the profile card does; polls use the rail for long voter lists.
    return (
        <div data-message-id={message.name}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverAnchor>{card}</PopoverAnchor>
                <PopoverContent
                    align="start"
                    className="flex max-h-(--radix-popover-content-available-height) w-80 flex-col gap-1 overflow-y-auto p-2"
                >
                    <ContactDetails contact={contact} photoUrl={photoUrl} onClose={close} />
                </PopoverContent>
            </Popover>
        </div>
    )
}
