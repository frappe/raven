import { useState } from "react"
import { useAtomValue } from "jotai"
import Picker from "@emoji-mart/react"
import { SmilePlusIcon } from "lucide-react"
import type { Editor } from "@tiptap/react"
import { Button } from "@components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useTheme } from "@components/theme-provider"
import { customEmojiCategoriesAtom } from "@lib/emojiMart"
import _ from "@lib/translate"

/** A picked emoji from emoji-mart (`native` for standard, `src` for custom). */
type PickedEmoji = { id: string; native?: string; src?: string }

/**
 * Full emoji picker (emoji-mart) in a popover — complements the `:` autocomplete.
 * Inserts the same way as the suggestion: standard emojis as the native unicode
 * text, custom emojis as a CustomEmoji node. Uses the global emoji-mart data
 * (Apple set + registered custom emojis).
 */
export const EmojiPickerButton = ({ editor }: { editor: Editor }) => {
    const [open, setOpen] = useState(false)
    const { themeValue } = useTheme()
    const customEmojis = useAtomValue(customEmojiCategoriesAtom)

    const onSelect = (emoji: PickedEmoji) => {
        if (emoji.native) {
            editor.chain().focus().insertContent(`${emoji.native} `).run()
        } else if (emoji.src) {
            editor
                .chain()
                .focus()
                .insertContent([
                    { type: "customEmoji", attrs: { src: emoji.src, alt: `:${emoji.id}:` } },
                    { type: "text", text: " " },
                ])
                .run()
        }
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" isIconButton aria-label={_("Emoji")}>
                            <SmilePlusIcon />
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>{_("Emoji")}</TooltipContent>
            </Tooltip>
            <PopoverContent side="top" align="start" className="w-auto border-0 p-0">
                <Picker onEmojiSelect={onSelect} theme={themeValue} set="native" custom={customEmojis} previewPosition="none" />
            </PopoverContent>
        </Popover>
    )
}
