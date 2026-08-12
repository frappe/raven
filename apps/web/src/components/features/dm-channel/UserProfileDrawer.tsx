import { Badge } from "@components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { OnLeaveBadge } from "@components/common/OnLeaveBadge"
import { MailIcon, PhoneIcon, UserX } from "lucide-react"
import { toast } from "sonner"
import type { UserData } from "@db"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { useCopyToClipboard } from "usehooks-ts"
import { useUserCookieData } from "@hooks/useUserCookieData"

interface UserProfileDrawerProps {
    user: UserData
}

export function UserProfileDrawer({ user }: UserProfileDrawerProps) {

    const { name } = useUserCookieData()
    const displayName = user.full_name || user.first_name || user.name
    const customStatus = user.custom_status?.trim() || ""

    const isDisabled = user.enabled === 0

    return (
        <div className="">
            <div className="flex items-center px-5 pt-4 pb-2 gap-4">
                <div>
                    <UserAvatar
                        user={user}
                        size="lg"
                    />
                </div>
                <div className="flex flex-col self-center gap-1 justify-between">
                    <span className="text-2xl-medium text-ink-gray-9">
                        {displayName} {name === user.name ? <span className="text-base text-ink-gray-6">({_("You")})</span> : ""}
                    </span>
                    {customStatus && (
                        <span className="text-p-xs text-ink-gray-6">{customStatus}</span>
                    )}
                    <div className="flex items-center gap-2 pt-0.5">
                        {isDisabled && (
                            <Badge variant="subtle" theme="gray">
                                <UserX />
                                {_("Disabled")}
                            </Badge>
                        )}
                        <OnLeaveBadge userID={user.name} />
                    </div>

                </div>
            </div>

            <div className="px-5 pb-5 flex flex-col gap-3">
                <ContactRow
                    icon={<MailIcon />}
                    label={_("Email")}
                    value={user.name}
                    emptyText={_("No email added")}
                    copyLabel={_("Email")}
                />
                <ContactRow
                    icon={<PhoneIcon />}
                    label={_("Phone")}
                    value={user.contact_number ?? ""}
                    emptyText={_("No phone number")}
                    copyLabel={_("Phone number")}
                />
            </div>
        </div>
    )
}


interface ContactRowProps {
    icon: React.ReactNode
    label: string
    value: string
    href?: string
    emptyText: string
    copyLabel: string
}

function ContactRow({ icon, value, emptyText }: ContactRowProps) {

    const [, copyToClipboard] = useCopyToClipboard()

    const onClick = (value: string) => {
        if (value) {
            copyToClipboard(value)
        }

        toast(_("Copied to clipboard"), {
            duration: 1000
        })
    }

    return (
        <div className="flex items-center gap-3">
            <div className="[&>svg]:size-3.5 text-ink-gray-6 flex items-center justify-center">
                {icon}
            </div>
            <div className="flex items-center justify-center">
                {value ? <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <span role="button" onClick={() => onClick(value)} className={cn("text-sm text-ink-gray-7 cursor-pointer")}>{value ? value : emptyText}</span>
                    </TooltipTrigger>
                    <TooltipContent>{value ? _("Click to copy") : ""}</TooltipContent>
                </Tooltip>
                    : <span className="text-sm text-ink-gray-4">{emptyText}</span>}
            </div>
        </div>
    )
}
