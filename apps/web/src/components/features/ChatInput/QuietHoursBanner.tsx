import { useLayoutEffect, useReducer, useRef, useState } from "react"
import { useAtomValue } from "jotai"
import { ClockIcon, EllipsisVerticalIcon, MoonStarIcon, XIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { useIsMobile } from "@hooks/use-mobile"
import { useSetQuietHoursNudge, type QuietSendMode } from "@hooks/useQuietHours"
import { QuietHoursDialog } from "@components/features/settings/panels/QuietHoursAdminSection"
import { hasRole } from "@lib/permissions"
import { quietHoursNudgeAtom, type QuietHoursNudge } from "@utils/preferences"
import { currentQuietPeriodStartMs } from "@utils/quietHours"
import _ from "@lib/translate"

/**
 * One banner on screen, ever. Multiple composers can be mounted at once — a
 * channel with its thread beside it on desktop, or layered over it on mobile —
 * and each hosts this component; the same sentence twice is noise. The first
 * mounted instance owns the banner; when it unmounts, the claim passes to the
 * next still-mounted one (so a thread opened standalone gets it too).
 * Module-level because "on screen" is a per-document fact, not per-composer.
 */
let bannerOwner: symbol | null = null
const claimWaiters = new Set<() => void>()

const useBannerOwnership = (): boolean => {
    const idRef = useRef<symbol | null>(null)
    if (idRef.current === null) idRef.current = Symbol("quiet-hours-banner")
    const [isOwner, setIsOwner] = useState(false)

    // Layout effect, not a passive one: the claim must resolve BEFORE first
    // paint. A passive effect made the banner pop in one paint after the
    // composer mounted — the chat stream had already pinned to the bottom (or
    // landed on the unread divider) against the shorter composer, and the late
    // ~40px growth clipped the newest visible messages behind it. Pre-paint,
    // the stream's positioning always sees the composer's final height.
    useLayoutEffect(() => {
        const id = idRef.current!
        const tryClaim = () => {
            if (bannerOwner === null) bannerOwner = id
            setIsOwner(bannerOwner === id)
        }
        tryClaim()
        claimWaiters.add(tryClaim)
        return () => {
            claimWaiters.delete(tryClaim)
            if (bannerOwner === id) {
                bannerOwner = null
                // Offer the claim to whichever instance is still mounted.
                claimWaiters.forEach((waiter) => waiter())
            }
        }
    }, [])

    return isOwner
}

/** A dismissal hides the banner for the REST of the current quiet period —
 *  it returns when the next one starts (i.e. tomorrow, after work ends). */
const DISMISSED_AT_KEY = "raven-quiet-hours-banner-dismissed-at"

const isDismissedThisPeriod = () => {
    try {
        const at = Number(localStorage.getItem(DISMISSED_AT_KEY))
        const periodStart = currentQuietPeriodStartMs()
        return Number.isFinite(at) && periodStart !== null && at >= periodStart
    } catch {
        return false
    }
}

/**
 * Gentle heads-up above the composer during quiet hours (MentionWarningBanner's
 * idiom, calmer surface). In "nudge" mode it tells the user HOW to send
 * silently; in "auto" mode it says sends already are. Dismissing hides it for
 * the rest of this quiet period — the send button's state carries the signal
 * from there. Its menu changes the preference in place (and, for admins, the
 * org's working hours) — the moment someone reads "it's after hours" is
 * exactly when they know which behavior they want.
 *
 * Split in two so the outer gates stay CHEAP: the content component (and its
 * profile/mutation hooks) only mounts while the banner actually shows.
 */
export const QuietHoursBanner = ({ mode }: { mode: QuietSendMode }) => {
    const isOwner = useBannerOwnership()
    // Computed at render, not held in state: when the NEXT quiet period starts
    // while the composer stays mounted (mode flips on, re-rendering us), the
    // old dismissal has expired and the banner shows again on its own.
    const [, rerender] = useReducer((n: number) => n + 1, 0)

    // Cheap gates first — the dismissal check reads localStorage and does
    // timezone math, so it must not run on every composer re-render all day
    // (mode is undefined the whole working day).
    if (!mode || !isOwner) return null
    if (isDismissedThisPeriod()) return null

    const dismiss = () => {
        try {
            localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()))
        } catch {
            // Storage unavailable — the banner just returns next mount.
        }
        rerender()
    }

    return <QuietHoursBannerContent mode={mode} onDismiss={dismiss} />
}

const QuietHoursBannerContent = ({ mode, onDismiss }: { mode: QuietSendMode; onDismiss: () => void }) => {
    const isMobile = useIsMobile()
    const preference = useAtomValue(quietHoursNudgeAtom)
    const setNudge = useSetQuietHoursNudge()
    const isAdmin = hasRole("Raven Admin") || hasRole("System Manager")
    // The working-hours dialog can't live inside the menu (items unmount on
    // select) — it's a controlled sibling the menu item opens.
    const [hoursOpen, setHoursOpen] = useState(false)

    const text =
        mode === "auto"
            ? _("It's after hours - your messages will be sent silently.")
            : isMobile
                ? _("It's after hours - hold Send to message without pinging anyone.")
                : _("It's after hours - send silently to let people rest (⌘⇧↵).")

    return (
        <div className="flex items-center gap-1.5 rounded-md bg-surface-gray-2 dark:bg-surface-elevation-2 py-1 pl-3 pr-1 md:mx-0 mx-1">
            <span className="flex h-lh shrink-0 items-center" aria-hidden="true">
                <MoonStarIcon className="size-4 text-ink-gray-6" />
            </span>
            <span className="flex-1 text-p-xs text-ink-gray-7">{text}</span>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        isIconButton
                        aria-label={_("Quiet hours options")}
                    >
                        <EllipsisVerticalIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end">
                    <DropdownMenuLabel>{_("Messaging after hours")}</DropdownMenuLabel>
                    {/* Same options (and stored values) as the Preferences row.
                        Picking one applies in place — the banner text and send
                        button flip immediately. "Do nothing" doubles as a
                        permanent dismiss: the mode goes undefined and the
                        banner unmounts. */}
                    <DropdownMenuRadioGroup
                        value={preference}
                        onValueChange={(value) => setNudge(value as QuietHoursNudge)}
                    >
                        <DropdownMenuRadioItem value="Nudge">{_("Suggest sending silently")}</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="Auto Silent">{_("Always send silently")}</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="No Nudge">{_("Do nothing")}</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    {isAdmin && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setHoursOpen(true)}>
                                <ClockIcon />
                                {_("Change organization's working hours")}
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <Button
                type="button"
                variant="ghost"
                size="sm"
                isIconButton
                aria-label={_("Dismiss")}
                onClick={onDismiss}
            >
                <XIcon />
            </Button>

            {/* Admin-only, controlled by the menu item above. Mounted while the
                banner shows (closed Radix dialogs render nothing) so opening is
                pre-seeded and closing animates. */}
            {isAdmin && <QuietHoursDialog open={hoursOpen} onOpenChange={setHoursOpen} />}
        </div>
    )
}
