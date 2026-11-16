import { siteUrl } from "@lib/site"
import _ from "@lib/translate"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useInstalledApps, type InstalledApp } from "@hooks/useInstalledApps"

const RavenLogo = () => {
    return <img src={siteUrl("/assets/raven/raven_logo.svg")} alt="Raven Logo" className="w-8 h-8" />
}

/** The Raven logo; pressing it lists the site's other apps. */
const AppSwitcher = () => {
    const apps = useInstalledApps()

    // Nothing to switch to: the logo stays a plain mark.
    if (apps.length === 0) return <RavenLogo />

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={_("Switch app")}
                            className="cursor-pointer rounded-lg focus-visible:focus-ring"
                        >
                            <RavenLogo />
                        </button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                    {_("Switch app")}
                </TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="start" className="min-w-48">
                {/* One app may declare several apps-screen entries, so name alone can repeat. */}
                {apps.map((app) => <AppItem key={`${app.name}:${app.route}`} app={app} />)}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const AppItem = ({ app }: { app: InstalledApp }) => {
    // An external route leaves the site, so it gets its own tab.
    const isExternal = app.route.startsWith("http")
    return (
        <DropdownMenuItem asChild>
            <a href={siteUrl(app.route)} {...(isExternal && { target: "_blank", rel: "noopener noreferrer" })}>
                <Avatar className="size-5 shrink-0 rounded-sm">
                    <AvatarImage src={app.logo && siteUrl(app.logo)} alt="" />
                    <AvatarFallback className="rounded-sm bg-surface-gray-3 text-2xs text-ink-gray-5">
                        {app.title.charAt(0)}
                    </AvatarFallback>
                </Avatar>
                {_(app.title)}
            </a>
        </DropdownMenuItem>
    )
}

export default AppSwitcher
