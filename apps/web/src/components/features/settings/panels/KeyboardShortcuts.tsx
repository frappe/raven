import type { ReactNode } from "react"
import { useAtomValue } from "jotai"
import {
    ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, BellOffIcon, BoldIcon, Building2Icon, CodeIcon, CornerDownLeftIcon,
    EyeOffIcon, HighlighterIcon, ImageIcon, ItalicIcon, LinkIcon, ListIcon, ListOrderedIcon, MailCheckIcon,
    PencilIcon, PlusIcon, QuoteIcon, SaveIcon, SearchIcon, SendIcon, SettingsIcon, SquareCodeIcon, StrikethroughIcon,
    TerminalIcon, UnderlineIcon, UndoIcon, RedoIcon, WrapTextIcon, XIcon,
} from "lucide-react"
import { Badge } from "@components/ui/badge"
import { Kbd, KbdGroup } from "@components/ui/kbd"
import { KeyboardMetaKeyIcon } from "@components/ui/keyboard-keys"
import {
    SettingsPanelContent, SettingsPanelDescription, SettingsPanelHeader, SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import { EnterKeyBehaviourAtom } from "@utils/preferences"
import _ from "@lib/translate"

// Platform-correct key labels, same test the formatting toolbar uses.
const isMac = typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform)
const ALT = isMac ? "⌥" : "Alt"
const SHIFT = isMac ? "⇧" : "Shift"

const Mod = () => <Kbd><KeyboardMetaKeyIcon /></Kbd>
const Alt = () => <Kbd>{ALT}</Kbd>
const Shift = () => <Kbd>{SHIFT}</Kbd>
const Key = ({ children }: { children: ReactNode }) => <Kbd>{children}</Kbd>
const Enter = () => <Kbd><CornerDownLeftIcon /></Kbd>

type Shortcut = { keys: ReactNode; icon: ReactNode; label: string; description: string }
type Group = { title: string; note?: string; shortcuts: Shortcut[] }

/** Other → Keyboard Shortcuts: every shortcut the web app registers, grouped by where it works. */
export const KeyboardShortcuts = () => {
    const enterSends = useAtomValue(EnterKeyBehaviourAtom) === "send-message"

    const groups: Group[] = [
        {
            title: _("Navigation"),
            shortcuts: [
                {
                    keys: <KbdGroup><Mod /><Key>K</Key></KbdGroup>,
                    icon: <TerminalIcon />, label: _("Command palette"),
                    description: _("Search channels, people and messages, or run a command."),
                },
                {
                    keys: <KbdGroup><Mod /><Key>G</Key></KbdGroup>,
                    icon: <SearchIcon />, label: _("Search"),
                    description: _("Open the search page. With the palette open, it carries the typed query along."),
                },
                {
                    keys: <KbdGroup><Mod /><Key>/</Key></KbdGroup>,
                    icon: <SettingsIcon />, label: _("Settings"),
                    description: _("Open your profile and settings."),
                },
                {
                    keys: <Key>Esc</Key>,
                    icon: <XIcon />, label: _("Close"),
                    description: _("Close the open thread, drawer or panel. In the message box, cancel the reply."),
                },
            ],
        },
        {
            title: _("Channels and lists"),
            note: _("These work in the channel list, direct messages, threads and notifications."),
            shortcuts: [
                {
                    keys: <KbdGroup><Alt /><Key><ArrowDownIcon /></Key></KbdGroup>,
                    icon: <ArrowDownIcon />, label: _("Next"),
                    description: _("Move to the next channel, direct message, thread or notification."),
                },
                {
                    keys: <KbdGroup><Alt /><Key><ArrowUpIcon /></Key></KbdGroup>,
                    icon: <ArrowUpIcon />, label: _("Previous"),
                    description: _("Move to the previous one."),
                },
                {
                    keys: <KbdGroup><Alt /><Shift /><Key><ArrowDownIcon /></Key></KbdGroup>,
                    icon: <MailCheckIcon />, label: _("Next unread"),
                    description: _("Jump to the next item with unread messages."),
                },
                {
                    keys: <KbdGroup><Alt /><Shift /><Key><ArrowUpIcon /></Key></KbdGroup>,
                    icon: <MailCheckIcon />, label: _("Previous unread"),
                    description: _("Jump to the previous item with unread messages."),
                },
                {
                    keys: <KbdGroup><Mod /><Alt /><Key><ArrowDownIcon /></Key></KbdGroup>,
                    icon: <Building2Icon />, label: _("Next workspace"),
                    description: _("Switch to the next workspace, in your workspace order."),
                },
                {
                    keys: <KbdGroup><Mod /><Alt /><Key><ArrowUpIcon /></Key></KbdGroup>,
                    icon: <Building2Icon />, label: _("Previous workspace"),
                    description: _("Switch to the previous workspace."),
                },
            ],
        },
        {
            title: _("Writing a message"),
            note: _("What Enter does can be changed in Preferences."),
            shortcuts: [
                enterSends
                    ? {
                        keys: <Enter />,
                        icon: <SendIcon />, label: _("Send"),
                        description: _("Send the message."),
                    }
                    : {
                        keys: <KbdGroup><Mod /><Enter /></KbdGroup>,
                        icon: <SendIcon />, label: _("Send"),
                        description: _("Send the message."),
                    },
                enterSends
                    ? {
                        keys: <KbdGroup><Shift /><Enter /></KbdGroup>,
                        icon: <WrapTextIcon />, label: _("New line"),
                        description: _("Start a new line without sending."),
                    }
                    : {
                        keys: <Enter />,
                        icon: <WrapTextIcon />, label: _("New line"),
                        description: _("Start a new line without sending."),
                    },
                {
                    keys: <KbdGroup><Mod /><Shift /><Enter /></KbdGroup>,
                    icon: <BellOffIcon />, label: _("Send silently"),
                    description: _("Send without notifying anyone."),
                },
                {
                    keys: <Key><ArrowUpIcon /></Key>,
                    icon: <PencilIcon />, label: _("Edit last message"),
                    description: _("With the message box empty, open your last message for editing."),
                },
                {
                    keys: <KbdGroup><Mod /><Shift /><Key>U</Key></KbdGroup>,
                    icon: <LinkIcon />, label: _("Add link"),
                    description: _("Open the link popover for the selected text."),
                },
            ],
        },
        {
            title: _("Formatting"),
            shortcuts: [
                { keys: <KbdGroup><Mod /><Key>B</Key></KbdGroup>, icon: <BoldIcon />, label: _("Bold"), description: _("Toggle bold on the selection.") },
                { keys: <KbdGroup><Mod /><Key>I</Key></KbdGroup>, icon: <ItalicIcon />, label: _("Italic"), description: _("Toggle italic on the selection.") },
                { keys: <KbdGroup><Mod /><Key>U</Key></KbdGroup>, icon: <UnderlineIcon />, label: _("Underline"), description: _("Toggle underline on the selection.") },
                { keys: <KbdGroup><Mod /><Shift /><Key>S</Key></KbdGroup>, icon: <StrikethroughIcon />, label: _("Strikethrough"), description: _("Toggle strikethrough on the selection.") },
                { keys: <KbdGroup><Mod /><Shift /><Key>H</Key></KbdGroup>, icon: <HighlighterIcon />, label: _("Highlight"), description: _("Toggle highlight on the selection.") },
                { keys: <Kbd>||…||</Kbd>, icon: <EyeOffIcon />, label: _("Spoiler"), description: _("Wrap text in double bars to hide it until clicked.") },
                { keys: <KbdGroup><Mod /><Key>E</Key></KbdGroup>, icon: <CodeIcon />, label: _("Code"), description: _("Toggle inline code on the selection.") },
                { keys: <KbdGroup><Mod /><Alt /><Key>C</Key></KbdGroup>, icon: <SquareCodeIcon />, label: _("Code block"), description: _("Turn the current block into a code block.") },
                { keys: <KbdGroup><Mod /><Shift /><Key>8</Key></KbdGroup>, icon: <ListIcon />, label: _("Bullet list"), description: _("Turn the current block into a bullet list.") },
                { keys: <KbdGroup><Mod /><Shift /><Key>7</Key></KbdGroup>, icon: <ListOrderedIcon />, label: _("Numbered list"), description: _("Turn the current block into a numbered list.") },
                { keys: <KbdGroup><Mod /><Shift /><Key>B</Key></KbdGroup>, icon: <QuoteIcon />, label: _("Quote"), description: _("Turn the current block into a quote.") },
            ],
        },
        {
            title: _("Viewing images"),
            note: _("In the attachment viewer, or while hovering a gallery of images in a message."),
            shortcuts: [
                { keys: <Key><ArrowLeftIcon /></Key>, icon: <ImageIcon />, label: _("Previous image"), description: _("Show the previous image.") },
                { keys: <Key><ArrowRightIcon /></Key>, icon: <ImageIcon />, label: _("Next image"), description: _("Show the next image.") },
            ],
        },
        {
            title: _("Settings"),
            shortcuts: [
                {
                    keys: <KbdGroup><Mod /><Key>B</Key></KbdGroup>,
                    icon: <PlusIcon />, label: _("New"),
                    description: _("In a settings list, create a new record."),
                },
                {
                    keys: <KbdGroup><Mod /><Key>S</Key></KbdGroup>,
                    icon: <SaveIcon />, label: _("Save"),
                    description: _("Save the open settings form."),
                },
            ],
        },
        {
            title: _("Browser"),
            note: _("Your browser provides these. Raven keeps every channel and page in the history, so they work as you would expect."),
            shortcuts: [
                {
                    keys: isMac
                        ? <KbdGroup><Mod /><Key>[</Key></KbdGroup>
                        : <KbdGroup><Alt /><Key><ArrowLeftIcon /></Key></KbdGroup>,
                    icon: <UndoIcon />, label: _("Back"),
                    description: _("Go back to the previous channel or page."),
                },
                {
                    keys: isMac
                        ? <KbdGroup><Mod /><Key>]</Key></KbdGroup>
                        : <KbdGroup><Alt /><Key><ArrowRightIcon /></Key></KbdGroup>,
                    icon: <RedoIcon />, label: _("Forward"),
                    description: _("Go forward again."),
                },
            ],
        },
    ]

    return (
        <>
            <SettingsPanelHeader>
                <SettingsPanelTitle>{_("Keyboard Shortcuts")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Get around Raven quickly with keyboard shortcuts.")}</SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0 gap-6">
                {groups.map((group) => (
                    <section key={group.title} className="flex flex-col gap-2">
                        <h3 className="text-base font-medium text-ink-gray-8">{group.title}</h3>
                        {group.note && <p className="text-p-sm text-ink-gray-6">{group.note}</p>}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-40">{_("Shortcut")}</TableHead>
                                    <TableHead className="w-44">{_("Action")}</TableHead>
                                    <TableHead>{_("Description")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {group.shortcuts.map((shortcut) => (
                                    <TableRow key={shortcut.label} className="hover:bg-surface-gray-2">
                                        <TableCell>{shortcut.keys}</TableCell>
                                        <TableCell>
                                            <Badge size="lg" variant="outline">
                                                {shortcut.icon}
                                                {shortcut.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-p-sm text-ink-gray-6 text-wrap">{shortcut.description}</p>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </section>
                ))}
            </SettingsPanelContent>
        </>
    )
}

export default KeyboardShortcuts
