import { ExternalLinkIcon, MailIcon, MessageSquareWarningIcon } from "lucide-react"
import {
    SettingsPanelContent,
    SettingsPanelDescription,
    SettingsPanelHeader,
    SettingsPanelTitle,
} from "@components/ui/settings-dialog"
import { Button } from "@components/ui/button"
import { Separator } from "@components/ui/separator"
import _ from "@lib/translate"

const LINKS = [
    { label: _("GitHub"), href: "https://github.com/The-Commit-Company/raven" },
    { label: _("Community"), href: "https://community.ravenapp.cloud" },
    { label: _("Website"), href: "https://ravenchat.ai" },
    { label: _("Documentation"), href: "https://docs.ravenapp.cloud" },
]

const SUPPORT_EMAIL = "support@thecommit.company"

/** Ported from v2's Help & Support page — version, links, and how to reach us. */
export const About = () => {
    const version = window?.frappe?.boot?.versions?.raven

    return (
        <>
            <SettingsPanelHeader>
                <SettingsPanelTitle>{_("About")}</SettingsPanelTitle>
                <SettingsPanelDescription>{_("Raven version, links, and support.")}</SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="gap-6">
                {/* Have feedback / found a bug? */}
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-ink-gray-7">{_("Have ideas or ran into an issue?")}</p>
                    <div>
                        <Button asChild variant="outline">
                            <a href={`mailto:${SUPPORT_EMAIL}`}>
                                <MessageSquareWarningIcon />
                                {_("Contact us")}
                            </a>
                        </Button>
                    </div>
                </div>

                <Separator />

                {/* External links */}
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
                    <li>
                        <a
                            href={`mailto:${SUPPORT_EMAIL}`}
                            className="inline-flex items-center gap-1.5 text-sm text-ink-gray-7 underline underline-offset-4 hover:text-ink-gray-9"
                        >
                            {_("Support email")}
                            <MailIcon className="h-3 w-3" />
                        </a>
                    </li>
                </ul>

                <Separator />

                {/* Version */}
                <div className="flex flex-col gap-0.5">
                    <p className="text-sm text-ink-gray-7">
                        <span className="font-semibold text-ink-gray-9">Raven</span>{" "}
                        {version && <span className="font-numeric text-ink-gray-5">v{version}</span>}
                    </p>
                </div>
            </SettingsPanelContent>
        </>
    )
}

export default About
