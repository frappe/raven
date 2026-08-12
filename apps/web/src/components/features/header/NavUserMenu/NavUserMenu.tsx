import { LogOut, Bell, SettingsIcon, Loader2 } from "lucide-react"
import { useLogout } from "@hooks/useLogout"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { Button } from "@components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import { AVAILABILITY_OPTIONS, useSetAvailability, type AvailabilityStatus } from "@hooks/useSetAvailability"
import { getStatusIndicatorColor } from "@components/features/message/UserAvatar"
import { cn } from "@lib/utils"
import { CircleDot } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import _ from "@lib/translate"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { useMemo, useState } from "react"
import { UserData } from "@db"
import { useSetAtom } from "jotai"
import { settingsDialogOpenTab } from "@components/features/settings/settingsDialogAtom"
import { disablePush, enablePush, isPushEnabled } from "@lib/push"
import { toast } from "sonner"
import { getErrorMessage } from "@lib/frappe"
import { FrappeError } from "frappe-react-sdk"
import { useIsPushNotificationEnabled } from "@hooks/fetchers/useIsPushNotificationEnabled"
import { Spinner } from "@components/ui/spinner"

const NavUserMenu = () => {

    const setOpenSettingsDialog = useSetAtom(settingsDialogOpenTab)

    const { myProfile } = useCurrentRavenUser()

    const userCookieData = useUserCookieData()

    const userData: UserData = useMemo(() => {
        if (myProfile) {
            return myProfile
        }
        return {
            name: userCookieData.name,
            full_name: userCookieData.full_name,
            user_image: userCookieData.user_image,
            type: 'User',
            availability_status: '',
            custom_status: '',
            enabled: 1,
            first_name: userCookieData.full_name?.split(' ')?.[0],
        }
    }, [myProfile, userCookieData])

    const { logout, isLoggingOut } = useLogout()

    const isPushAvailable = useIsPushNotificationEnabled()

    // Source of truth for "enabled on this device" is the stored FCM token (lib/push).
    const [pushOn, setPushOn] = useState<boolean>(() => isPushEnabled())

    const togglePush = (next: boolean) => {
        if (next) {
            toast.promise(
                enablePush().then((granted) => {
                    if (!granted) { setPushOn(false); throw new Error(_("Permission denied for push notifications")) }
                    setPushOn(true)
                }),
                { loading: _("Enabling…"), success: _("Push notifications enabled"), error: (e: Error) => e.message },
            )
        } else {
            disablePush()
                .then(() => { setPushOn(false); toast.info(_("Push notifications disabled")) })
                .catch((e: unknown) => toast.error(_("There was an error"), { description: getErrorMessage(e as FrappeError) }))
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" isIconButton>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <UserAvatar user={userData} size="md" className="rounded-lg" showStatusIndicator={true} showBotIndicator={false} addColoredFallback={false} />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{_("Your Profile")}</p>
                        </TooltipContent>
                    </Tooltip>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                side="right"
                align="end"
                sideOffset={12}
                collisionPadding={16}
            >
                <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 p-1.5 text-left text-sm">
                        <UserAvatar user={userData} size="md" className="rounded-lg" showStatusIndicator={true} showBotIndicator={false} addColoredFallback={false} />
                        <div className="flex flex-col gap-0.5 text-left text-sm">
                            <span className="truncate font-semibold text-ink-gray-8">{userData.full_name}</span>
                            <span className="truncate text-xs text-ink-gray-5">{userData.name}</span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <StatusSubMenu />
                <DropdownMenuItem onClick={() => setOpenSettingsDialog("profile")}>
                    <SettingsIcon />
                    <span>{_("Settings")}</span>
                </DropdownMenuItem>
                {isPushAvailable && <DropdownMenuItem onClick={() => togglePush(!pushOn)}>
                    <Bell />
                    <span>{pushOn ? _("Disable Notifications") : _("Enable Notifications")}</span>
                </DropdownMenuItem>}
                <DropdownMenuSeparator />
                {/* preventDefault keeps the menu open (spinner visible) while logout
                    runs; success hard-redirects to /login, failure toasts. */}
                <DropdownMenuItem
                    variant="destructive"
                    disabled={isLoggingOut}
                    onSelect={(e) => { e.preventDefault(); logout() }}
                >
                    {isLoggingOut ? <Spinner /> : <LogOut />}
                    <span>{isLoggingOut ? _("Logging out…") : _("Log out")}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

/** Quick availability switcher — the same options (and write path) as the
 *  profile form, one hover away from the avatar. */
const StatusSubMenu = () => {
    const { availability, setAvailability } = useSetAvailability()

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger>
                <CircleDot />
                <span>{_("Status")}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                    value={availability}
                    onValueChange={(value) => setAvailability(value as AvailabilityStatus)}
                >
                    {AVAILABILITY_OPTIONS.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                            <span className={cn("size-2 rounded-full", getStatusIndicatorColor(option.value))} />
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    )
}

export default NavUserMenu

