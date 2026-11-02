import type { BillingTrial } from "@frappe/cloud-sdk/api"
import { CircleAlert, CircleX, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { Button } from "@components/ui/button"
import { formatDate } from "@lib/date"
import { cn } from "@lib/utils"
import { useCloudSettings } from "@hooks/useCloudSettings"
import { useTrialCard } from "./useTrialCard"
import _ from "@lib/translate"

/** From this many days left, the card turns amber. */
const URGENT_DAYS = 3

type CardTheme = "gray" | "amber" | "red"

const ICONS = { gray: CircleAlert, amber: TriangleAlert, red: CircleX } as const

/** Raven's Button has no amber theme: the same subtle ramp Frappe UI's SidebarCard uses. */
const AMBER_ACTION = "bg-surface-amber-2 hover:bg-surface-amber-3 active:bg-surface-amber-4 text-ink-amber-7"

type TrialCardContent = {
    theme: CardTheme
    title: string
    description: string
    action: string
    dismissible: boolean
}

const endsInTitle = (daysLeft: number) => {
    if (daysLeft <= 0) return _("Your trial ends today")
    if (daysLeft === 1) return _("Your trial ends tomorrow")
    return _("Your trial ends in {0} days", [String(daysLeft)])
}

/** What the card says for each state of the trial. */
const trialCardContent = (trial: BillingTrial): TrialCardContent => {
    if (trial.state === "Ended") {
        return {
            theme: "red",
            title: _("Your trial has ended"),
            description: trial.deletes_on
                ? _("Your site will be deleted on {0}. Choose a plan to keep it.", [formatDate(trial.deletes_on, "D MMM")])
                : _("Choose a plan to keep using your site."),
            action: _("Choose a plan"),
            dismissible: false,
        }
    }
    if (trial.held) {
        return {
            theme: "amber",
            title: _("Your plan is over your spending limit"),
            description: _("Raise the limit or choose a smaller plan to end your trial."),
            action: _("Manage billing"),
            dismissible: true,
        }
    }
    return {
        theme: trial.days_left <= URGENT_DAYS ? "amber" : "gray",
        title: endsInTitle(trial.days_left),
        description: _("Choose a plan to keep your site after the trial."),
        action: _("Choose a plan"),
        dismissible: true,
    }
}

type TrialCardProps = {
    trial: BillingTrial
    onAction: () => void
    /** True while the billing dialog opens. */
    opening?: boolean
    onDismiss?: () => void
}

/** A trial notice for the bottom of the sidebar: Frappe UI's SidebarCard, built on the alert. */
export const TrialCard = ({ trial, onAction, opening, onDismiss }: TrialCardProps) => {
    const content = trialCardContent(trial)
    const Icon = ICONS[content.theme]
    const showDismiss = content.dismissible && onDismiss

    return (
        <Alert
            variant="outline"
            theme={content.theme}
            // A notice, not an announcement: no live region.
            role={undefined}
            className="rounded-6 border-outline-gray-1 bg-surface-base p-3 has-[>svg]:gap-x-1.5"
        >
            <Icon aria-hidden />
            <AlertTitle className={cn("text-p-sm-medium text-ink-gray-8", showDismiss && "pe-6")}>{content.title}</AlertTitle>
            <AlertDescription className="col-span-2 col-start-1 mt-1 text-p-xs text-ink-gray-6">
                {content.description}
            </AlertDescription>
            <Button
                variant="subtle"
                theme={content.theme === "red" ? "red" : "gray"}
                size="sm"
                loading={opening}
                onClick={onAction}
                className={cn("col-span-2 col-start-1 mt-3 w-full", content.theme === "amber" && AMBER_ACTION)}
            >
                {content.action}
            </Button>
            {showDismiss && (
                <Button
                    variant="ghost"
                    size="xs"
                    isIconButton
                    aria-label={_("Dismiss")}
                    onClick={onDismiss}
                    className="absolute end-1.5 top-1.5"
                >
                    <X />
                </Button>
            )}
        </Alert>
    )
}

/** The trial card at the bottom of the channel sidebar, when there is a trial to show. */
export const SidebarTrialCard = () => {
    const { trial, dismiss } = useTrialCard()
    const { opening, open } = useCloudSettings()
    if (!trial) return null

    const openBilling = () =>
        open().catch((error: unknown) =>
            toast.error(error instanceof Error ? error.message : _("Could not open Cloud Settings")),
        )

    return (
        <div className="shrink-0 p-2">
            <TrialCard trial={trial} opening={opening} onAction={openBilling} onDismiss={dismiss} />
        </div>
    )
}
