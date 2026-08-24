import { AtSign } from "lucide-react"
import type { Editor } from "@tiptap/react"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import _ from "@lib/translate"

/** Inserts "@" and focuses the editor, opening the mention suggestion. */
export const MentionButton = ({ editor }: { editor: Editor }) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                isIconButton
                aria-label={_("Mention someone")}
                onClick={() => editor.chain().focus().insertContent("@").run()}
            >
                <AtSign />
            </Button>
        </TooltipTrigger>
        <TooltipContent>{_("Mention")}</TooltipContent>
    </Tooltip>
)
