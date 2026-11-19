import { contactInitials } from "@lib/contact"
import { cn } from "@lib/utils"

const sizeClass = {
    40: "size-10 text-sm",
    56: "size-14 text-xl",
} as const

/** A contact's photo, with its initials underneath when there is none or it fails to load. */
export const ContactAvatar = ({ name, photoUrl, size }: { name: string; photoUrl?: string; size: 40 | 56 }) => (
    <div
        className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-gray-3 font-semibold text-ink-gray-7",
            sizeClass[size],
        )}
    >
        <span aria-hidden>{contactInitials(name)}</span>
        {photoUrl && (
            <img
                src={photoUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover"
                onError={(event) => {
                    event.currentTarget.hidden = true
                }}
            />
        )}
    </div>
)
