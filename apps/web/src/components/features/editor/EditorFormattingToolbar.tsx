import { Fragment, useEffect, useState } from "react"
import { useEditorState, type Editor } from "@tiptap/react"
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    Strikethrough,
    Code,
    SquareCode,
    List,
    ListOrdered,
    Quote,
    Highlighter,
    EyeOff,
    Link as LinkIcon,
    type LucideIcon,
    CheckIcon,
} from "lucide-react"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Separator } from "@components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

// Platform-correct shortcut hints for the tooltips.
const isMac = typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform)
const MOD = isMac ? "⌘" : "Ctrl"
const SHIFT = isMac ? "⇧" : "Shift"
const ALT = isMac ? "⌥" : "Alt"
const combo = (...keys: string[]) => keys.join(isMac ? "" : "+")

type Mark =
    | "bold"
    | "italic"
    | "underline"
    | "strike"
    | "code"
    | "highlight"
    | "bulletList"
    | "orderedList"
    | "blockquote"
    | "codeBlock"
    | "spoiler"

interface FormatButton {
    mark: Mark
    icon: LucideIcon
    label: string
    shortcut: string
    run: (editor: Editor) => void
}

// Grouped so the toolbar reads as: marks (incl. code + code block) | lists & quote | link.
const GROUPS: FormatButton[][] = [
    [
        { mark: "bold", icon: Bold, label: _("Bold"), shortcut: combo(MOD, "B"), run: (e) => e.chain().focus().toggleBold().run() },
        { mark: "italic", icon: Italic, label: _("Italic"), shortcut: combo(MOD, "I"), run: (e) => e.chain().focus().toggleItalic().run() },
        { mark: "underline", icon: UnderlineIcon, label: _("Underline"), shortcut: combo(MOD, "U"), run: (e) => e.chain().focus().toggleUnderline().run() },
        { mark: "strike", icon: Strikethrough, label: _("Strikethrough"), shortcut: combo(MOD, SHIFT, "S"), run: (e) => e.chain().focus().toggleStrike().run() },
        { mark: "highlight", icon: Highlighter, label: _("Highlight"), shortcut: combo(MOD, SHIFT, "H"), run: (e) => e.chain().focus().toggleHighlight().run() },
        { mark: "spoiler", icon: EyeOff, label: _("Spoiler"), shortcut: "||…||", run: (e) => e.chain().focus().toggleSpoiler().run() },
    ],
    [
        { mark: "code", icon: Code, label: _("Code"), shortcut: combo(MOD, "E"), run: (e) => e.chain().focus().toggleCode().run() },
        { mark: "codeBlock", icon: SquareCode, label: _("Code block"), shortcut: combo(MOD, ALT, "C"), run: (e) => e.chain().focus().toggleCodeBlock().run() },
    ],
    [
        { mark: "bulletList", icon: List, label: _("Bullet list"), shortcut: combo(MOD, SHIFT, "8"), run: (e) => e.chain().focus().toggleBulletList().run() },
        { mark: "orderedList", icon: ListOrdered, label: _("Numbered list"), shortcut: combo(MOD, SHIFT, "7"), run: (e) => e.chain().focus().toggleOrderedList().run() },
        { mark: "blockquote", icon: Quote, label: _("Quote"), shortcut: combo(MOD, SHIFT, "B"), run: (e) => e.chain().focus().toggleBlockquote().run() },
    ],
]

const ACTIVE_CLASS = "bg-surface-gray-3 text-ink-gray-9"
const LINK_SHORTCUT = combo(MOD, SHIFT, "U")

/**
 * Static formatting toolbar — a row of toggle buttons that sits at the top of the
 * composer when the user turns formatting on (the Type toggle in the action bar).
 * Slack-style: predictable placement, no floating-positioned bubble to misfire on
 * multi-line selections. Built from Espresso ui/ components + Lucide icons; tooltips
 * show the keyboard shortcut. The Link button opens a small popover to enter a URL.
 */
interface EditorFormattingToolbarProps {
    editor: Editor
    /**
     * Bumped each time the user presses the link shortcut (⌘⇧U) — opens the link
     * popover even when this toolbar was just revealed by the shortcut. Resets to 0
     * via onLinkConsumed so re-toggling the toolbar later doesn't reopen it.
     */
    linkSignal?: number
    onLinkConsumed?: () => void
}

export const EditorFormattingToolbar = ({ editor, linkSignal = 0, onLinkConsumed }: EditorFormattingToolbarProps) => {
    const active = useEditorState({
        editor,
        selector: ({ editor }) => ({
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            underline: editor.isActive("underline"),
            strike: editor.isActive("strike"),
            code: editor.isActive("code"),
            highlight: editor.isActive("highlight"),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            blockquote: editor.isActive("blockquote"),
            codeBlock: editor.isActive("codeBlock"),
            spoiler: editor.isActive("spoiler"),
            link: editor.isActive("link"),
        }),
    })

    return (
        <div className="flex items-center gap-0.5 overflow-x-auto bg-surface-gray-1 px-1.5 py-1">
            {GROUPS.map((group, i) => (
                <Fragment key={i}>
                    {i > 0 && <Separator orientation="vertical" className="mx-1 h-4!" />}
                    {group.map(({ mark, icon: Icon, label, shortcut, run }) => (
                        <Tooltip key={mark}>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    isIconButton
                                    aria-label={label}
                                    aria-pressed={active[mark]}
                                    onClick={() => run(editor)}
                                    className={cn(active[mark] && ACTIVE_CLASS)}
                                >
                                    <Icon />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {label} <span className="ms-1 text-ink-gray-4">{shortcut}</span>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </Fragment>
            ))}

            <Separator orientation="vertical" className="mx-1 h-4!" />

            <LinkButton editor={editor} active={active.link} openSignal={linkSignal} onConsumed={onLinkConsumed} />
        </div>
    )
}

const LinkButton = ({
    editor,
    active,
    openSignal = 0,
    onConsumed,
}: {
    editor: Editor
    active: boolean
    openSignal?: number
    onConsumed?: () => void
}) => {
    const [open, setOpen] = useState(false)
    const [url, setUrl] = useState("")

    const handleOpenChange = (next: boolean) => {
        // Prefill with the selection's existing link when opening.
        if (next) setUrl((editor.getAttributes("link").href as string) ?? "")
        setOpen(next)
    }

    // ⌘⇧U bumps openSignal — open the popover, then tell the parent to reset it so a
    // later toolbar re-toggle (which remounts this) doesn't auto-reopen.
    useEffect(() => {
        if (openSignal > 0) {
            handleOpenChange(true)
            onConsumed?.()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openSignal])

    const apply = () => {
        const raw = url.trim()
        // Empty input → strip the link from the selection.
        if (!raw) {
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
            setOpen(false)
            return
        }
        // A bare domain (typed without a scheme) would become a relative link — prefix https://.
        const href = /^(https?:|mailto:|tel:|ftp:|\/\/)/i.test(raw) ? raw : `https://${raw}`
        const { from, to } = editor.state.selection
        if (from === to) {
            // Nothing selected → insert the typed text as the linked text.
            editor.chain().focus().insertContent({ type: "text", text: raw, marks: [{ type: "link", attrs: { href } }] }).run()
        } else {
            editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
        }
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            isIconButton
                            aria-label={_("Link")}
                            aria-pressed={active}
                            className={cn(active && ACTIVE_CLASS)}
                        >
                            <LinkIcon />
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    {_("Link")} <span className="ms-1 text-ink-gray-4">{LINK_SHORTCUT}</span>
                </TooltipContent>
            </Tooltip>
            <PopoverContent side="top" align="start" className="w-72 p-2">
                <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                        // The popover is portaled to <body>, but React bubbles synthetic
                        // events through the component tree — so without stopPropagation
                        // this submit reaches the ChatInput <form> and sends the message.
                        e.preventDefault()
                        e.stopPropagation()
                        apply()
                    }}
                >
                    <Input
                        autoFocus
                        inputSize="sm"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder={_("Paste a link")}
                    />
                    <Button type="submit" size="sm" variant={"ghost"} isIconButton aria-label={_("Apply")}>
                        <CheckIcon />
                    </Button>
                </form>
            </PopoverContent>
        </Popover>
    )
}
