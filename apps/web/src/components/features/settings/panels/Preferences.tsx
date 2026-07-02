import { Label } from "@components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { Separator } from "@components/ui/separator"
import { SettingsPanelDescription, SettingsPanelHeader, SettingsPanelTitle, SettingsPanelContent, SettingsFormLabel, SettingsFormDescription, SettingsFormRow } from "@components/ui/settings-dialog"
import { Switch } from "@components/ui/switch"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { EnterKeyBehaviourAtom, QuickEmojisAtom, TimeFormat, timeFormatAtom } from "@utils/preferences"
import _ from "@lib/translate"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { getErrorMessage } from "@lib/frappe"
import { ArrowDownAzIcon, BellDotIcon, ClockIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Button } from "@components/ui/button"
import { useTheme } from "@components/theme-provider"
import { customEmojiCategoriesAtom } from "@lib/emojiMart"
import Picker from "@emoji-mart/react"

const Preferences = () => {

    const { myProfile, mutate } = useCurrentRavenUser()

    const { call } = useFrappePostCall('frappe.client.set_value')

    const setTimeFormatAtomValue = useSetAtom(timeFormatAtom)

    const updateValue = (fieldname: string, value: string | number) => {
        if (!myProfile?.name) return;
        call({
            doctype: 'Raven User',
            name: myProfile.name,
            fieldname: fieldname,
            value: value
        }).then(() => {
            if (fieldname === 'time_format') {
                setTimeFormatAtomValue(value as TimeFormat)
            }
            mutate()
            toast.success(_("Settings updated"), {
                id: "preferences-updated"
            })
        }).catch((e) => {
            toast.error(getErrorMessage(e))
        })
    }

    return (
        <>
            <SettingsPanelHeader>
                <SettingsPanelTitle>{_("Preferences")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Configure behavior and preferences.")}</SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent>

                <div className='flex flex-col gap-4 w-full'>
                    {/* {error && <ErrorBanner error={error} />} */}

                    <div className="flex flex-col flex-1 gap-2">
                        <SettingsFormRow>
                            <div className="flex flex-col">
                                <SettingsFormLabel htmlFor="filter_recent_activity">{_("Only show channels with recent activity")}</SettingsFormLabel>
                                <SettingsFormDescription>{_("Channels with no activity in the last 30 days will be hidden from the sidebar automatically.")}</SettingsFormDescription>
                            </div>
                            <div className="flex justify-end">
                                <Switch
                                    id="filter_recent_activity"
                                    className="dark:disabled:bg-surface-gray-2"
                                    checked={myProfile?.filter_recent_activity === 1}
                                    onCheckedChange={(checked) => updateValue("filter_recent_activity", checked ? 1 : 0)}
                                />
                            </div>
                        </SettingsFormRow>

                        <Separator />

                        <SettingsFormRow>
                            <div className="flex flex-col">
                                <SettingsFormLabel htmlFor="filter_joined_channels">{_("Only show channels that I have joined")}</SettingsFormLabel>
                                <SettingsFormDescription>
                                    {_("Public channels that you have not joined will be hidden from the sidebar.")}
                                </SettingsFormDescription>
                            </div>
                            <div className="flex justify-end">
                                <Switch
                                    id="filter_joined_channels"
                                    className="dark:disabled:bg-surface-gray-2"
                                    checked={myProfile?.filter_joined_channels === 1}
                                    onCheckedChange={(checked) => updateValue("filter_joined_channels", checked ? 1 : 0)}
                                />
                            </div>
                        </SettingsFormRow>

                        <Separator />

                        <SettingsFormRow>
                            <div className="flex flex-col">
                                <SettingsFormLabel htmlFor="sort_channels_by">{_("Sort channels by")}</SettingsFormLabel>
                                <SettingsFormDescription>
                                    {_("Choose how to sort channels in the sidebar.")}
                                </SettingsFormDescription>
                            </div>
                            <div className="min-w-40 flex justify-end">
                                <Select onValueChange={(value) => updateValue('sort_channels_by', value as "Alphabetical Order" | "Recent Activity" | "Unreads First")} value={myProfile?.sort_channels_by ? myProfile.sort_channels_by : "Recent Activity"}>
                                    <SelectTrigger id="sort_channels_by" className="min-w-32">
                                        <SelectValue placeholder={_("Select sort order")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Recent Activity"><ClockIcon /> {_("Recent Activity")}</SelectItem>
                                        {/* <SelectItem value="Unreads First"><BellDotIcon /> {_("Unreads First")}</SelectItem> */}
                                        <SelectItem value="Alphabetical Order"><ArrowDownAzIcon /> {_("Alphabetical Order")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </SettingsFormRow>

                        <Separator />

                        <SettingsFormRow>
                            <div className="flex flex-col">
                                <SettingsFormLabel htmlFor="time_format">{_("Time format")}</SettingsFormLabel>
                                <SettingsFormDescription>
                                    {_("Choose whether to display times in 12-hour or 24-hour format.")}
                                </SettingsFormDescription>
                            </div>
                            <div className="min-w-40 flex justify-end">
                                <Select onValueChange={(value) => updateValue('time_format', value as TimeFormat)} value={myProfile?.time_format ? myProfile.time_format : "12-hour"}>
                                    <SelectTrigger id="time_format" className="min-w-32">
                                        <SelectValue placeholder={_("Select time format")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="12-hour">{_("12 Hour (e.g. 2:00 PM)")}</SelectItem>
                                        <SelectItem value="24-hour">{_("24 Hour (e.g. 14:00)")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </SettingsFormRow>

                        <Separator />

                        <EnterKeyBehaviour />

                        <Separator />

                        <QuickEmojis />
                    </div>

                </div>
            </SettingsPanelContent>
        </>
    )
}


const EnterKeyBehaviour = () => {

    const [enterKeyBehaviour, setEnterKeyBehaviour] = useAtom(EnterKeyBehaviourAtom)


    return <SettingsFormRow>
        <div className="flex flex-col">
            <SettingsFormLabel htmlFor="enterKeyBehaviour">{_("Enter key behaviour")}</SettingsFormLabel>
            <SettingsFormDescription>
                {_("Choose whether to send a message or start a new line when pressing the Enter key.")}<br />
                {enterKeyBehaviour === "send-message" ? _("Pressing Enter will immediately send your message. Use Shift+Enter to add a new line.") : _("Pressing Enter will add a new line. Use Ctrl / ⌘ + Enter to send your message.")}
            </SettingsFormDescription>
        </div>
        <div className="min-w-40 flex justify-end">
            <Select onValueChange={(value) => setEnterKeyBehaviour(value as "send-message" | "new-line")} value={enterKeyBehaviour}>
                <SelectTrigger id="enterKeyBehaviour" className="min-w-32">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="send-message">{_("Send message")}</SelectItem>
                    <SelectItem value="new-line">{_("Start a new line")}</SelectItem>
                </SelectContent>
            </Select>
        </div>
    </SettingsFormRow>
}

const QuickEmojis = () => {

    const [quickEmojis, setQuickEmojis] = useAtom(QuickEmojisAtom)
    const customEmojis = useAtomValue(customEmojiCategoriesAtom)

    const { themeValue } = useTheme()

    const handleEmojiSelect = (index: number, emoji: any) => {
        const newEmojis = [...quickEmojis]
        newEmojis[index] = {
            id: emoji.id,
            native: emoji.native,
            src: emoji.src
        }
        setQuickEmojis(newEmojis)
    }

    return <SettingsFormRow>
        <div className="flex flex-col">
            <SettingsFormLabel htmlFor="quickEmojis">{_("Quick emojis")}</SettingsFormLabel>
            <SettingsFormDescription>
                {_("Set your favorite emojis for quick reactions.")}
                <br />
                {_("Click on any button to set your favorite emoji for quick reactions.")}
            </SettingsFormDescription>
        </div>
        <div className="flex gap-2">
            {quickEmojis.map((emoji, index) => (
                <Popover key={index}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="lg"
                            isIconButton
                            className="text-2xl"
                        >
                            {emoji.src ? (
                                <img
                                    src={emoji.src}
                                    alt={emoji.id}
                                    loading="lazy"
                                    className="h-4.5 w-4.5 object-contain"
                                    aria-hidden="true"
                                />
                            ) : (
                                // em-emoji renders from the Apple set (initialized in
                                // App.tsx) so reactions look the same on every platform
                                <span className="flex h-4.5 w-4.5 items-center justify-center" aria-hidden="true">
                                    <em-emoji native={emoji.native} set="apple" size="1.1em" fallback={emoji.id} />
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Picker
                            onEmojiSelect={(emoji: any) => handleEmojiSelect(index, emoji)} theme={themeValue} set="apple" custom={customEmojis} previewPosition="none"
                        />
                    </PopoverContent>
                </Popover>
            ))}
        </div>
    </SettingsFormRow>
}
export default Preferences