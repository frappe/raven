import { useState } from "react"
import { useAtomValue } from "jotai"
import Picker from "@emoji-mart/react"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useTheme } from "@components/theme-provider"
import { customEmojiCategoriesAtom } from "@lib/emojiMart"
import { useToggleReaction } from "./useToggleReaction"
import type { Message } from "@raven/types/common/Message"

/** A picked emoji from emoji-mart (`native` for standard, `src`/`id` for custom). */
type PickedEmoji = { id: string; native?: string; src?: string }

/**
 * Emoji picker (emoji-mart) for adding a reaction to a message — reused by the reaction
 * pill row's "+" and the hover toolbar's smiley. `children` is the trigger (a button),
 * rendered via PopoverTrigger asChild. `onOpenChange` lets a caller (the hover toolbar)
 * keep itself mounted while the picker is open.
 *
 * The picker body lives in {@link ReactionPickerPanel}, mounted only while the popover is
 * open — so a closed picker (one per reacted message) holds no theme/custom-emoji
 * subscriptions. (emoji-mart itself is already in the bundle via the composer's picker, so
 * there's nothing extra to lazy-load here.)
 */
export const ReactionPicker = ({
    message,
    children,
    tooltip,
    side = "top",
    align = "start",
    onOpenChange,
}: {
    message: Message
    children: React.ReactNode
    tooltip?: string
    side?: "top" | "bottom" | "left" | "right"
    align?: "start" | "center" | "end"
    onOpenChange?: (open: boolean) => void
}) => {
    const [open, setOpen] = useState(false)

    const handleOpenChange = (next: boolean) => {
        setOpen(next)
        onOpenChange?.(next)
    }

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>{children}</PopoverTrigger>
                </TooltipTrigger>
                {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
            </Tooltip>
            <PopoverContent side={side} align={align} className="w-auto border-0 p-0">
                <ReactionPickerPanel message={message} onClose={() => handleOpenChange(false)} />
            </PopoverContent>
        </Popover>
    )
}

/**
 * The emoji-mart picker itself. Split out so its subscriptions (theme, custom emojis) only
 * come into play once the popover opens — a closed picker holds none. Exported for hosts
 * that aren't popovers (the mobile action sheet renders it inside the drawer).
 */
export const ReactionPickerPanel = ({ message, onClose, perLine = 9, dynamicWidth = false }: { message: Message; onClose: () => void; perLine?: number; dynamicWidth?: boolean }) => {
    const toggleReaction = useToggleReaction()
    const { themeValue } = useTheme()
    const customEmojis = useAtomValue(customEmojiCategoriesAtom)

    const onSelect = (emoji: PickedEmoji) => {
        if (emoji.native) toggleReaction(message, emoji.native, false)
        else if (emoji.src) toggleReaction(message, emoji.src, true, emoji.id)
        onClose()
    }

    return <Picker onEmojiSelect={onSelect} theme={themeValue} set="native" custom={customEmojis} skinTonePosition="none" previewPosition="none" perLine={perLine} dynamicWidth={dynamicWidth} />
}
