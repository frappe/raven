import { useState } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import Picker from "@emoji-mart/react"
import { useFrappePostCall } from "frappe-react-sdk"
import { ArrowDownAzIcon, ClockIcon, ImagesIcon, LayoutPanelLeftIcon } from "lucide-react"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { Switch } from "@components/ui/switch"
import { Button } from "@components/ui/button"
import { useTheme } from "@components/theme-provider"
import { customEmojiCategoriesAtom } from "@lib/emojiMart"
import { DoubleTapReactionAtom, QuickEmojisAtom, type QuickEmoji, type TimeFormat, timeFormatAtom, imageGroupingLayoutAtom } from "@utils/preferences"
import { errorResponseToast } from "@components/ui/error-banner"
import { PrefRow, PrefSection } from "./PrefRows"
import _ from "@lib/translate"

/** A picked emoji from emoji-mart (`native` for standard, `src`/`id` for custom). */
type PickedEmoji = { id: string; native?: string; src?: string }

/**
 * Mobile home for the same settings desktop keeps in the Preferences panel
 * (settings/panels/Preferences.tsx — same fields, same wire format; only the
 * layout differs: drawer rows instead of the two-column panel). Server-backed
 * fields go through frappe.client.set_value on Raven User; enter-key behaviour
 * and quick emojis are device-local (atomWithStorage).
 *
 * Tapping a quick-emoji slot swaps the SHEET to the emoji picker (same
 * shadow-DOM touch fixes as the message action sheet) — a popover like the
 * desktop panel uses would portal outside the drawer's scroll lock and not
 * scroll on mobile.
 */
export const PreferencesDrawer = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
    const { myProfile, mutate } = useCurrentRavenUser()
    const { call } = useFrappePostCall("frappe.client.set_value")
    const setTimeFormat = useSetAtom(timeFormatAtom)
    const [quickEmojis, setQuickEmojis] = useAtom(QuickEmojisAtom)
    const [doubleTapReaction, setDoubleTapReaction] = useAtom(DoubleTapReactionAtom)
    const { themeValue } = useTheme()
    const customEmojis = useAtomValue(customEmojiCategoriesAtom)

    /**
     * What the picker view is editing: a quick-emoji slot index, the double-tap
     * reaction, or null = the settings list.
     */
    const [pickingSlot, setPickingSlot] = useState<number | "double-tap" | null>(null)

    const [imageGrouping, setImageGrouping] = useAtom(imageGroupingLayoutAtom)

    const updateValue = (fieldname: string, value: string | number) => {
        if (!myProfile?.name) return
        call({ doctype: "Raven User", name: myProfile.name, fieldname, value })
            .then(() => {
                if (fieldname === "time_format") setTimeFormat(value as TimeFormat)
                mutate()
            })
            .catch((e) => errorResponseToast(_("Could not update preference"), e, { position: "top-center" }))
    }

    const pickEmoji = (emoji: PickedEmoji) => {
        if (pickingSlot === null) return
        const picked = { id: emoji.id, native: emoji.native, src: emoji.src }
        if (pickingSlot === "double-tap") setDoubleTapReaction(picked)
        else setQuickEmojis(quickEmojis.map((slot, index) => (index === pickingSlot ? picked : slot)))
        setPickingSlot(null)
    }

    const handleOpenChange = (next: boolean) => {
        if (!next) setPickingSlot(null)
        onOpenChange(next)
    }

    return (
        <Drawer open={open} onOpenChange={handleOpenChange}>
            <DrawerContent className={pickingSlot !== null ? "p-0 pt-1" : undefined} showHandle={pickingSlot === null}>
                {pickingSlot !== null ? (
                    // Same touch escape hatches as the message action sheet's picker:
                    // emoji-mart's shadow DOM defeats vaul's drag detection AND the
                    // Radix scroll lock, so hand touch back and stop propagation.
                    <div
                        data-vaul-no-drag
                        onTouchMove={(e) => e.stopPropagation()}
                        className="flex justify-center overflow-hidden [&_em-emoji-picker]:h-[60vh] [&_em-emoji-picker]:w-full"
                    >
                        <Picker
                            onEmojiSelect={pickEmoji}
                            theme={themeValue}
                            set="native"
                            custom={customEmojis}
                            previewPosition="none"
                            skinTonePosition="none"
                            perLine={10}
                        />
                    </div>
                ) : (
                    <div className="flex max-h-[85dvh] flex-col gap-5 overflow-y-auto p-4 pb-10">
                        <DrawerTitle>{_("Preferences")}</DrawerTitle>
                        <DrawerDescription className="sr-only">{_("Quick reactions and composer preferences")}</DrawerDescription>
                        <PrefSection>
                            <PrefRow
                                asLabel
                                label={_("Only show channels with recent activity")}
                                description={_("Hide channels that have not been active in the last 30 days")}
                                control={
                                    <Switch
                                        size="md"
                                        checked={myProfile?.filter_recent_activity === 1}
                                        onCheckedChange={(checked) => updateValue("filter_recent_activity", checked ? 1 : 0)}
                                    />
                                }
                            />
                            <PrefRow
                                asLabel
                                label={_("Show channels that I have joined")}
                                description={_("Public channels that you have not joined will be hidden")}
                                control={
                                    <Switch
                                        size="md"
                                        checked={myProfile?.filter_joined_channels === 1}
                                        onCheckedChange={(checked) => updateValue("filter_joined_channels", checked ? 1 : 0)}
                                    />
                                }
                            />
                            <PrefRow
                                label={_("Sort channels by")}
                                control={
                                    <Select
                                        value={myProfile?.sort_channels_by ? myProfile.sort_channels_by : "Recent Activity"}
                                        onValueChange={(value) => updateValue("sort_channels_by", value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={_("Select sort order")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem className="py-2.5" value="Recent Activity"><ClockIcon /> {_("Recent Activity")}</SelectItem>
                                            <SelectItem className="py-2.5" value="Alphabetical Order"><ArrowDownAzIcon /> {_("Alphabetical Order")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                }
                            />

                            <PrefRow
                                label={_("Time format")}
                                control={
                                    <Select
                                        value={myProfile?.time_format ? myProfile.time_format : "12-hour"}
                                        onValueChange={(value) => updateValue("time_format", value as TimeFormat)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={_("Select time format")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem className="py-2.5" value="12-hour">{_("12 Hour (e.g. 2:00 PM)")}</SelectItem>
                                            <SelectItem className="py-2.5" value="24-hour">{_("24 Hour (e.g. 14:00)")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                }
                            />

                            <PrefRow
                                label={_("Image group layout")}
                                control={
                                    <Select
                                        value={imageGrouping}
                                        onValueChange={(value) => setImageGrouping(value as "stack" | "grid")}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={_("Select image group layout")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem className="py-2.5" value="stack"><ImagesIcon /> {_("Stack")}</SelectItem>
                                            <SelectItem className="py-2.5" value="grid"><LayoutPanelLeftIcon /> {_("Grid")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                }
                            />
                        </PrefSection>

                        <PrefSection>
                            <div className="flex flex-col gap-2.5 py-3">
                                <span className="text-base text-ink-gray-6">{_("Quick reactions")}</span>
                                <div className="flex justify-between">
                                    {quickEmojis.map((emoji, index) => (
                                        <Button
                                            key={index}
                                            variant="outline"
                                            size="lg"
                                            isIconButton
                                            className="rounded-full text-2xl"
                                            aria-label={_("Change quick emoji {0}", [String(index + 1)])}
                                            onClick={() => setPickingSlot(index)}
                                        >
                                            <EmojiFace emoji={emoji} />
                                        </Button>
                                    ))}
                                </div>
                                <span className="text-p-sm text-ink-gray-5">{_("Tap a slot to change its emoji - these are your one-tap reactions.")}</span>
                            </div>

                            <PrefRow
                                label={_("Double-tap reaction")}
                                description={_("Toggled when you double-tap a message")}
                                control={
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        isIconButton
                                        className="rounded-full text-2xl"
                                        aria-label={_("Change double-tap reaction")}
                                        onClick={() => setPickingSlot("double-tap")}
                                    >
                                        <EmojiFace emoji={doubleTapReaction} />
                                    </Button>
                                }
                            />
                        </PrefSection>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    )
}

/**
 * A QuickEmoji face: custom emojis are plain images; native ones render via
 * em-emoji from the Apple set (initialized in App.tsx) so reactions look the
 * same on every platform.
 */
const EmojiFace = ({ emoji }: { emoji: QuickEmoji }) =>
    emoji.src ? (
        <img src={emoji.src} alt={emoji.id} loading="lazy" className="h-4.5 w-4.5 object-contain" aria-hidden="true" />
    ) : (
        <span className="flex h-4.5 w-4.5 items-center justify-center" aria-hidden="true">
            <em-emoji native={emoji.native} set="native" size="1.1em" fallback={emoji.id} />
        </span>
    )

