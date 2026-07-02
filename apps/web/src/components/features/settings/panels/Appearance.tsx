import { Label } from "@components/ui/label"
import { Separator } from "@components/ui/separator"
import { SettingsPanelDescription, SettingsPanelHeader, SettingsPanelTitle, SettingsPanelContent, SettingsFormLabel, SettingsFormDescription, SettingsFormRow } from "@components/ui/settings-dialog"
import { useTheme } from "@components/theme-provider"
import { useAtom, useSetAtom } from "jotai"
import { chatStyleAtom, imageGroupingLayoutAtom, type ChatStyle } from "@utils/preferences"
import _ from "@lib/translate"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { getErrorMessage } from "@lib/frappe"
import { Select, SelectItem, SelectValue, SelectTrigger, SelectContent } from "@components/ui/select"
import { Grid3x2Icon, ImagesIcon, FileStack, LayoutPanelLeftIcon } from "lucide-react"

const Appearance = () => {

    return (
        <>
            <SettingsPanelHeader>
                <SettingsPanelTitle>{_("Appearance")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Configure how you want Raven to look.")}</SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent>

                <div className='flex flex-col gap-4 w-full'>

                    <div className="flex flex-col flex-1 gap-4">

                        <ThemeSwitcher />

                        <Separator />

                        <LeftRightLayoutSwitcher />

                        <Separator />

                        <ImageGroupingBehaviour />

                    </div>
                </div>
            </SettingsPanelContent>
        </>
    )
}


const ThemeSwitcher = () => {

    const { theme, setTheme } = useTheme()

    const themeCards: Array<{ value: "dark" | "light" | "system", label: string }> = [
        {
            value: "system",
            label: _("Automatic"),
        },
        {
            value: "light",
            label: _("Light"),
        },
        {
            value: "dark",
            label: _("Dark"),
        }
    ]

    return <div className="flex flex-col gap-3 pb-3">
        <div className="flex flex-col">
            <SettingsFormLabel htmlFor="theme">{_("Theme")}</SettingsFormLabel>
            <SettingsFormDescription>
                {_("Switch between light, dark, or system theme")}
            </SettingsFormDescription>
        </div>
        <div className="flex gap-3">
            {themeCards.map((option) => {
                const selected = theme === option.value

                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setTheme(option.value)}
                        aria-pressed={selected}
                        className={`flex-1 basis-0 min-w-0 overflow-hidden rounded-lg border cursor-pointer transition-colors focus-visible:focus-default ${selected ? "border-outline-gray-8" : "border-outline-gray-3 hover:border-outline-gray-5"}`}
                    >
                        {option.value === "system" ? (
                            <div className="flex w-full min-w-0">
                                <ThemePreviewWindow theme="light" roundedClass="rounded-tl-[10.5px]" />
                                <ThemePreviewWindow theme="dark" roundedClass="rounded-tr-[10.5px]" />
                            </div>
                        ) : (
                            <ThemePreviewWindow theme={option.value} roundedClass="rounded-t-[10.5px]" />
                        )}
                        <div className="flex items-center justify-between px-3 py-2">
                            <div className="text-base text-ink-gray-7">{option.label}</div>
                            <span className={`rounded-full size-3.5 ${selected ? "border-4 border-outline-gray-8" : "border border-outline-gray-4"}`} />
                        </div>
                    </button>
                )
            })}
        </div>
    </div>

}

const ThemePreviewWindow = ({ theme, roundedClass }: { theme: "light" | "dark", roundedClass: string }) => {
    const isLight = theme === "light"
    const frameClass = isLight ? "bg-white border-gray-100" : "bg-gray-900 border-gray-800"
    const subtleSurfaceClass = isLight ? "bg-gray-50" : "bg-gray-800"
    const mutedLineClass = isLight ? "bg-gray-200" : "bg-gray-700"
    const mutedLineStrongClass = isLight ? "bg-gray-300" : "bg-gray-600"
    const dividerClass = isLight ? "border-gray-100" : "border-gray-800"
    const cardClass = isLight ? "bg-white border-gray-200" : "bg-gray-900 border-gray-700"

    return <div className={`flex flex-1 min-w-0 pl-5 pt-3.5 ${isLight ? "bg-surface-gray-2" : "bg-surface-gray-3"} ${roundedClass}`}>
        <div className={`w-full rounded-tl-sm border border-b-0 ${frameClass}`}>
            <div className={`flex gap-[3px] py-[3px] px-1 border-b ${dividerClass}`}>
                <div className="size-1.5 bg-[#FF5F57] rounded-full" />
                <div className="size-1.5 bg-[#FEBC2D] rounded-full" />
                <div className="size-1.5 bg-[#28C840] rounded-full" />
            </div>
            {/* Raven's anatomy in miniature: thin workspace rail · channel sidebar ·
                chat island (header / messages / composer) floating on the canvas gutter. */}
            <div className="flex h-20">
                {/* 1. Primary rail — workspace switcher (thin) */}
                <div className={`flex w-2.5 flex-col items-center gap-1 border-r py-1.5 ${subtleSurfaceClass} ${dividerClass}`}>
                    <div className={`size-1.5 rounded-[2px] ${mutedLineStrongClass}`} />
                    <div className={`size-1.5 rounded-[2px] ${mutedLineClass}`} />
                    <div className={`size-1.5 rounded-[2px] ${mutedLineClass}`} />
                </div>

                {/* 2. Channel sidebar */}
                <div className={`flex w-8 flex-col gap-1 py-1.5 px-1 ${subtleSurfaceClass}`}>
                    <div className={`h-1 w-5 rounded-full ${mutedLineStrongClass}`} />
                    <div className="mt-0.5 flex flex-col gap-1">
                        <div className={`h-1 w-full rounded-full ${mutedLineClass}`} />
                        <div className={`h-1 w-4/5 rounded-full ${mutedLineClass}`} />
                        <div className={`h-1 w-full rounded-full ${mutedLineStrongClass}`} />
                        <div className={`h-1 w-3/5 rounded-full ${mutedLineClass}`} />
                        <div className={`h-1 w-4/5 rounded-full ${mutedLineClass}`} />
                    </div>
                </div>

                {/* 3. Chat island on the canvas gutter */}
                <div className={`flex min-w-0 flex-1 p-0.5 ${subtleSurfaceClass}`}>
                    <div className={`flex min-w-0 flex-1 flex-col rounded-sm border ${cardClass}`}>
                        {/* header */}
                        <div className={`flex items-center border-b px-1.5 py-1 ${dividerClass}`}>
                            <div className={`h-1 w-7 rounded-full ${mutedLineStrongClass}`} />
                        </div>
                        {/* messages */}
                        <div className="flex flex-1 flex-col gap-1.5 p-1.5">
                            {[
                                { avatar: mutedLineStrongClass, lines: ["w-3/5", "w-4/5"] },
                                { avatar: mutedLineStrongClass, lines: ["w-2/5", "w-3/5"] },
                            ].map((row, index) => (
                                <div key={index} className="flex items-start gap-1">
                                    <div className={`size-1.5 shrink-0 rounded-full ${row.avatar}`} />
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        {row.lines.map((width, lineIndex) => (
                                            <div key={lineIndex} className={`h-1 ${width} rounded-full ${mutedLineClass}`} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* composer */}
                        <div className="p-1.5 pt-0">
                            <div className={`h-2 w-full rounded-sm ${subtleSurfaceClass} ${dividerClass}`} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
}


type PreviewMessage = { own: boolean; image?: boolean; width?: string }

// Same composition (3 text + 1 image) for both styles, so the two cards stay equal height.
// "Simple" keeps everything left; "Left-Right" pushes the user's own messages/media right.
const SIMPLE_MESSAGES: PreviewMessage[] = [
    { own: false, width: "w-1/2" },
    { own: false, width: "w-2/5" },
    { own: false, image: true },
    { own: false, width: "w-1/3" },
]

const LEFT_RIGHT_MESSAGES: PreviewMessage[] = [
    { own: false, width: "w-1/2" },
    { own: true, width: "w-2/5" },
    { own: true, image: true },
    { own: false, width: "w-1/3" },
]

/**
 * Full Raven window (thin workspace rail · channel sidebar · chat island) showing how
 * messages align for each chat style. Uses real surface tokens — unlike the theme cards
 * (fixed light/dark), this previews layout, so it should reflect the active theme.
 */
const ChatStylePreview = ({ style }: { style: "Simple" | "Left-Right" }) => {
    const messages = style === "Simple" ? SIMPLE_MESSAGES : LEFT_RIGHT_MESSAGES

    return (
        <div className="flex pl-5 pt-3.5 bg-surface-gray-2 rounded-t-[10.5px]">
            <div className="w-full rounded-tl-sm border border-b-0 border-outline-gray-2 bg-surface-base">
                <div className="flex gap-[3px] py-[3px] px-1 border-b border-outline-gray-2">
                    <div className="size-1.5 bg-[#FF5F57] rounded-full" />
                    <div className="size-1.5 bg-[#FEBC2D] rounded-full" />
                    <div className="size-1.5 bg-[#28C840] rounded-full" />
                </div>
                <div className="flex h-28">
                    {/* Primary rail — workspace switcher */}
                    <div className="flex w-2.5 flex-col items-center gap-1 border-r border-outline-gray-2 bg-surface-gray-2 py-1.5">
                        <div className="size-1.5 rounded-[2px] bg-surface-gray-4" />
                        <div className="size-1.5 rounded-[2px] bg-surface-gray-3" />
                        <div className="size-1.5 rounded-[2px] bg-surface-gray-3" />
                    </div>
                    {/* Channel sidebar */}
                    <div className="flex w-8 flex-col gap-1 bg-surface-gray-2 p-1.5">
                        <div className="h-1.5 w-5 rounded-full bg-surface-gray-4" />
                        <div className="mt-0.5 flex flex-col gap-1">
                            {["w-full", "w-4/5", "w-full", "w-3/5", "w-4/5", "w-2/3"].map((w, i) => (
                                <div key={i} className={`h-1 ${w} rounded-full ${i === 2 ? "bg-surface-gray-4" : "bg-surface-gray-3"}`} />
                            ))}
                        </div>
                    </div>
                    {/* Chat island on the canvas gutter */}
                    <div className="flex min-w-0 flex-1 bg-surface-gray-2 p-1">
                        <div className="flex min-w-0 flex-1 flex-col rounded-sm border border-outline-gray-2 bg-surface-base">
                            <div className="flex items-center border-b border-outline-gray-2 px-1.5 py-1">
                                <div className="h-1.5 w-7 rounded-full bg-surface-gray-4" />
                            </div>
                            <div className="flex flex-1 flex-col gap-1 overflow-hidden p-1.5">
                                {messages.map((msg, index) => (
                                    <div key={index} className={`flex items-end gap-1 ${msg.own ? "justify-end" : "justify-start"}`}>
                                        {!msg.own && <div className="size-2 shrink-0 rounded-full bg-surface-gray-3" />}
                                        {msg.image ? (
                                            <div className="h-4 w-10 rounded-sm bg-surface-gray-3" />
                                        ) : (
                                            <div className={`h-2 ${msg.width} rounded-md bg-surface-gray-3`} />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="p-1.5 pt-0">
                                <div className="h-2.5 w-full rounded-sm bg-surface-gray-2" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const LeftRightLayoutSwitcher = () => {

    const { myProfile, mutate } = useCurrentRavenUser()

    const { call } = useFrappePostCall('frappe.client.set_value')

    const setChatStyleAtomValue = useSetAtom(chatStyleAtom)

    const setChatStyle = (style: ChatStyle) => {
        if (!myProfile?.name) return;
        call({
            doctype: 'Raven User',
            name: myProfile.name,
            fieldname: 'chat_style',
            value: style
        }).then(() => {
            window.frappe.boot.chat_style = style
            // Drive the live layout switch — the message rows read this atom.
            setChatStyleAtomValue(style)
            mutate()
            toast.success(_("Chat style updated"))
        }).catch((e) => {
            toast.error(getErrorMessage(e))
        })
    }

    const currentStyle = myProfile?.chat_style ?? "Simple"

    const chatStyleCards: Array<{ value: "Simple" | "Left-Right"; label: string }> = [
        { value: "Simple", label: _("Simple") },
        { value: "Left-Right", label: _("Left-Right") },
    ]

    return <div className="flex flex-col gap-3 pb-3">
        <div className="flex flex-col">
            <SettingsFormLabel htmlFor="chatLayout">{_("Chat Layout")}</SettingsFormLabel>
            <SettingsFormDescription>
                {_("Switch between simple and left-right chat layout")}
            </SettingsFormDescription>
        </div>
        <div className="flex gap-3">
            {chatStyleCards.map((option) => {
                const selected = currentStyle === option.value

                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setChatStyle(option.value)}
                        aria-pressed={selected}
                        className={`flex-1 basis-0 min-w-0 overflow-hidden rounded-lg border cursor-pointer transition-colors focus-visible:focus-default ${selected ? "border-outline-gray-8" : "border-outline-gray-3 hover:border-outline-gray-5"}`}
                    >
                        <ChatStylePreview style={option.value} />
                        <div className="flex items-center justify-between px-3 py-2">
                            <div className="text-base text-ink-gray-7">{option.label}</div>
                            <span className={`rounded-full size-3.5 ${selected ? "border-4 border-outline-gray-8" : "border border-outline-gray-4"}`} />
                        </div>
                    </button>
                )
            })}
        </div>
    </div>

}

const ImageGroupingBehaviour = () => {

    const [imageGrouping, setImageGrouping] = useAtom(imageGroupingLayoutAtom)


    return <SettingsFormRow>
        <div className="flex flex-col">
            <SettingsFormLabel htmlFor="sort_channels_by">{_("Image group layout")}</SettingsFormLabel>
            <SettingsFormDescription>
                {_("Decide how a group of images should appear in the chat stream.")}
            </SettingsFormDescription>
        </div>
        <div className="min-w-40 flex justify-end">
            <Select onValueChange={(value) => setImageGrouping(value as "stack" | "grid")} value={imageGrouping}>
                <SelectTrigger id="time_format" className="min-w-32">
                    <SelectValue placeholder={_("Select sort order")} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="stack"><ImagesIcon /> {_("Stack")}</SelectItem>
                    <SelectItem value="grid"><LayoutPanelLeftIcon /> {_("Grid/Carousel")}</SelectItem>
                </SelectContent>
            </Select>
        </div>
    </SettingsFormRow>
}

export default Appearance