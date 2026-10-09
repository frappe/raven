import { useMemo } from "react"
import { ExternalLinkIcon } from "lucide-react"
import {
    SettingsPanelContent,
    SettingsPanelDescription,
    SettingsPanelHeader,
    SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import { Separator } from "@components/ui/separator"
import _ from "@lib/translate"
import { siteUrl } from "@lib/site"
// Bundled, because the app is not served from the site that holds this file.
import ravenLogo from "@raven/public/raven_logo.svg"

const LINKS = [
    { label: _("GitHub"), href: "https://github.com/frappe/raven" },
    { label: _("Website"), href: "https://ravenchat.ai" },
    // { label: _("Documentation"), href: "https://docs.ravenapp.cloud" },
]

/** Version of every installed app, plus links. Same footer as the mobile profile page. */
export const About = () => {
    // boot.versions is { app: version } for every app on the site; boot.app_data
    // has each app's title (and logo). Both come from Frappe's own boot.
    // Older Frappe has no app_data: then the list falls back to the app slugs.
    const versions = useMemo(() => {
        const all = (window?.frappe?.boot?.versions ?? {}) as Record<string, string>
        const appData = (window?.frappe?.boot?.app_data ?? []) as { app_name: string; app_title?: string }[]
        const titles = new Map(appData.map((a) => [a.app_name, a.app_title]))
        // Raven first, then Frappe, then the rest alphabetically by title.
        const rank = (app: string) => (app === "raven" ? 0 : app === "frappe" ? 1 : 2)
        return Object.entries(all)
            .map(([app, version]) => ({ app, title: titles.get(app) || app, version }))
            .sort((a, b) => rank(a.app) - rank(b.app) || a.title.localeCompare(b.title))
    }, [])

    return (
        <>
            <SettingsPanelHeader>
                <SettingsPanelTitle>{_("About")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("A piece of craft by Frappe.")}</SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0 gap-6">
                <div className="flex items-center gap-3">
                    <img src={ravenLogo} alt="Raven" className="h-10 w-10" />
                    <div className="flex flex-col">
                        <span className="text-base font-semibold text-ink-gray-9">Raven</span>
                        {versions[0]?.app === "raven" && (
                            <span className="font-numeric text-sm text-ink-gray-5">v{versions[0].version}</span>
                        )}
                    </div>
                </div>

                <ul className="flex flex-col gap-2">
                    {LINKS.map((link) => (
                        <li key={link.href}>
                            <a
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-ink-gray-7 underline underline-offset-4 hover:text-ink-gray-9"
                            >
                                {link.label}
                                <ExternalLinkIcon className="h-3 w-3" />
                            </a>
                        </li>
                    ))}
                </ul>

                <Separator />

                {/* Every installed app. Handy when asking for support. */}
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-ink-gray-7">{_("Installed apps")}</p>
                    <dl className="grid w-fit grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm">
                        {versions.map(({ app, title, version }) => (
                            <div key={app} className="contents">
                                <dt className="text-ink-gray-7">{title}</dt>
                                <dd className="font-numeric text-ink-gray-5">v{version}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <Separator />

                {/* The Frappe app's own artwork, which only the site has. */}
                <img src={siteUrl("/assets/frappe/images/frappe-comp-logo.svg")} alt="Frappe" className="h-5 w-auto self-start dark:invert" />
            </SettingsPanelContent>
        </>
    )
}

export default About
