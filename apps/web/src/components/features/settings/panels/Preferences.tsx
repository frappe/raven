import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { Separator } from "@components/ui/separator"
import { SettingsPanelDescription, SettingsPanelHeader, SettingsPanelTitle, SettingsPanelContent, SettingsFormLabel, SettingsFormDescription, SettingsFormRow, SettingsSectionHeader } from "@components/ui/settings-dialog"
import { Switch } from "@components/ui/switch"
import { useAtom, useAtomValue } from "jotai"
import { EnterKeyBehaviourAtom, QuickEmojisAtom, QuietHoursNudge, hideReadReceiptsAtom, quietHoursConfigAtom, quietHoursNudgeAtom, timeFormatAtom } from "@utils/preferences"
import { formatWorkingHoursRange } from "@utils/quietHours"
import { hasRole } from "@lib/permissions"
import _ from "@lib/translate"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { ArrowDownAzIcon, BellDotIcon, ClockIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Button } from "@components/ui/button"
import { useTheme } from "@components/theme-provider"
import { customEmojiCategoriesAtom } from "@lib/emojiMart"
import Picker from "@emoji-mart/react"
import { errorResponseToast } from "@components/ui/error-banner"
import { LinkSettingsAdminSection } from "./LinkSettingsAdminSection"
import { QuietHoursAdminSection } from "./QuietHoursAdminSection"
import { Fragment } from "react"

const Preferences = () => {

    const { myProfile, mutate } = useCurrentRavenUser()

    const { call } = useFrappePostCall('frappe.client.set_value')

    // Read + write the atom (boot-seeded) — hot paths read it instead of the profile cache.
    const [hideReadReceipts, setHideReadReceipts] = useAtom(hideReadReceiptsAtom)
    const [quietHoursNudge, setQuietHoursNudge] = useAtom(quietHoursNudgeAtom)
    // Working hours in the copy below render in the user's chosen time format.
    const timeFormat = useAtomValue(timeFormatAtom)

    const updateValue = (fieldname: string, value: string | number) => {
        if (!myProfile?.name) return;
        call({
            doctype: 'Raven User',
            name: myProfile.name,
            fieldname: fieldname,
            value: value
        }).then(() => {
            if (fieldname === 'hide_read_receipts') {
                setHideReadReceipts(value === 1)
            }
            if (fieldname === 'quiet_hours_nudge') {
                setQuietHoursNudge(value as QuietHoursNudge)
            }
            mutate()
            toast.success(_("Settings updated"), {
                id: "preferences-updated"
            })
        }).catch((e) => {
            errorResponseToast(_("Could not update preference"), e)
        })
    }

    // The nudge preference only means something when the org configured quiet
    // hours — without them there's nothing to nudge about, so the row hides
    // (a visible-but-dead setting reads as broken). Admins still see the
    // section: it hosts the org working-hours configuration. Subscribed via
    // the atom: an admin enabling working hours reveals the row immediately.
    const quietHoursConfigured = useAtomValue(quietHoursConfigAtom) !== null
    const isAdmin = hasRole('Raven Admin') || hasRole('System Manager')

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
                        {/* ---- Messaging ---- */}
                        <SettingsSectionHeader>{_("Messaging")}</SettingsSectionHeader>

                        <SettingsFormRow>
                            <div className="flex flex-col">
                                <SettingsFormLabel htmlFor="hide_read_receipts">{_("Read receipts")}</SettingsFormLabel>
                                <SettingsFormDescription>
                                    {_("When off, others won't see when you've read messages - and you won't be able to view read receipts on messages either.")}
                                </SettingsFormDescription>
                            </div>
                            <div className="flex justify-end">
                                {/* The switch reads POSITIVELY (on = receipts visible, the
                                    default) while the stored field is hide_read_receipts —
                                    hence the inversion both ways. */}
                                <Switch
                                    size="md"
                                    id="hide_read_receipts"
                                    className="dark:disabled:bg-surface-gray-2"
                                    checked={!hideReadReceipts}
                                    onCheckedChange={(checked) => updateValue("hide_read_receipts", checked ? 0 : 1)}
                                />
                            </div>
                        </SettingsFormRow>

                        <Separator />

                        <EnterKeyBehaviour />

                        <Separator />

                        <QuickEmojis />

                        {/* ---- Filtering & sorting ---- */}
                        <SettingsSectionHeader>{_("Filtering & sorting")}</SettingsSectionHeader>

                        <SettingsFormRow>
                            <div className="flex flex-col">
                                <SettingsFormLabel htmlFor="filter_recent_activity">{_("Only show channels with recent activity")}</SettingsFormLabel>
                                <SettingsFormDescription>{_("Channels with no activity in the last 30 days will be hidden from the sidebar automatically.")}</SettingsFormDescription>
                            </div>
                            <div className="flex justify-end">
                                <Switch
                                    size="md"
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
                                    size="md"
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

                        {/* ---- Quiet hours: the user's composer behavior, and (for
                             admins) the org's working-hours window. Hidden entirely
                             when there's nothing to show. ---- */}
                        {(quietHoursConfigured || isAdmin) && (
                            <SettingsSectionHeader>{_("Quiet hours")}</SettingsSectionHeader>
                        )}

                        {quietHoursConfigured && (
                            <SettingsFormRow>
                                <div className="flex flex-col">
                                    <SettingsFormLabel htmlFor="quiet_hours_nudge">{_("Messaging after hours")}</SettingsFormLabel>
                                    <SettingsFormDescription>
                                        {_("Choose what Raven should do when you message someone outside working hours ({0}). Silent messages don't ping anyone - they'll see it when they're back.", [formatWorkingHoursRange(timeFormat) ?? ""])}
                                    </SettingsFormDescription>
                                </div>
                                <div className="min-w-52 flex justify-end">
                                    <Select onValueChange={(value) => updateValue('quiet_hours_nudge', value as QuietHoursNudge)} value={quietHoursNudge}>
                                        <SelectTrigger id="quiet_hours_nudge" className="min-w-52">
                                            <SelectValue placeholder={_("Select quiet hours behavior")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {/* Values are the Raven User select options verbatim. */}
                                            <SelectItem value="Nudge">{_("Suggest sending silently")}</SelectItem>
                                            <SelectItem value="Auto Silent">{_("Always send silently")}</SelectItem>
                                            <SelectItem value="No Nudge">{_("Do nothing")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </SettingsFormRow>
                        )}

                        {/* Renders nothing without the admin role. */}
                        {quietHoursConfigured && <QuietHoursAdminSection />}
                        {!quietHoursConfigured && isAdmin && <QuietHoursAdminSection withSeparator={false} />}



                        {/* ---- Link previews (admin-only rows; header gated the same) ---- */}
                        {isAdmin && <SettingsSectionHeader>{_("Link previews")}</SettingsSectionHeader>}
                        <LinkSettingsAdminSection withLeadingSeparator={false} />
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
            </SettingsFormDescription>
        </div>
        <div className="flex gap-2">
            {quickEmojis.slice(0, 4).map((emoji, index) => (
                <Fragment key={index}>
                    <Popover>
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
                                        <em-emoji native={emoji.native} set="native" size="1.1em" fallback={emoji.id} />
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Picker
                                onEmojiSelect={(emoji: any) => handleEmojiSelect(index, emoji)} theme={themeValue} set="native" custom={customEmojis} previewPosition="none"
                            />
                        </PopoverContent>
                    </Popover>
                </Fragment>
            ))}
        </div>
    </SettingsFormRow>
}
export default Preferences