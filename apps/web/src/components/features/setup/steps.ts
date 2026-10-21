import _ from "@lib/translate"

export type SetupStepName = "profile" | "workspace" | "channel" | "team" | "hr"

export type StepStatus = "completed" | "skipped"

export type StepStatuses = Partial<Record<SetupStepName, StepStatus>>

/**
 * Profile first, then workspace and channel, so the team is added straight into them.
 * HR maps companies to workspaces, so it comes last. Members only set up their profile.
 */
export const getSetupSteps = ({ mode, hasTeamStep, hrInstalled }: { mode: "admin" | "profile"; hasTeamStep: boolean; hrInstalled: boolean }): SetupStepName[] =>
    mode === "profile"
        ? ["profile"]
        : [
            "profile",
            "workspace",
            "channel",
            ...(hasTeamStep ? ["team" as const] : []),
            ...(hrInstalled ? ["hr" as const] : []),
        ]

export const getSetupStepTitle = (step: SetupStepName): string => {
    switch (step) {
        case "profile":
            return _("Set up your profile")
        case "workspace":
            return _("Set up your workspace")
        case "channel":
            return _("Create your first channel")
        case "team":
            return _("Add your team")
        case "hr":
            return _("First Frappe HR, now Raven. You're on a roll.")
    }
}
