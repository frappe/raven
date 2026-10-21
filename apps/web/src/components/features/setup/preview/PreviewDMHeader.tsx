import { TreePalm } from "lucide-react"
import { generateAvatarColor, getInitials } from "@components/features/message/UserAvatar"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Badge } from "@components/ui/badge"
import _ from "@lib/translate"
import { cn } from "@lib/utils"

/** The open DM's header as the app shows it: avatar and name, then the "On Leave" badge while they're on leave. */
export const PreviewDMHeader = ({ name, image, onLeave }: { name: string; image?: string; onLeave: boolean }) => (
    <div className="flex min-w-0 items-center gap-2 px-1.5 animate-setup-blur-in">
        {/* Capped as the app's header caps it, so a long name truncates and the badge stays in view. */}
        <div className="flex min-w-0 max-w-64 items-center gap-2">
            <Avatar className="size-6 shrink-0 rounded-full">
                {image && <AvatarImage src={image} alt="" />}
                <AvatarFallback className={cn("select-none border-0 text-[10px] font-medium", generateAvatarColor(name))}>
                    {getInitials(name)}
                </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium text-ink-gray-8">{name}</span>
        </div>
        {onLeave && (
            <Badge variant="subtle" theme="amber" size="md" className="animate-setup-blur-in">
                <TreePalm />
                {_("On Leave")}
            </Badge>
        )}
    </div>
)
