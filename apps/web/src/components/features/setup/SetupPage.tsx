import { useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router"
import { useLocalStorage } from "usehooks-ts"
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk"
import { Button } from "@components/ui/button"
import { Progress } from "@components/ui/progress"
import { useWorkspaces } from "@hooks/useWorkspaces"
import { channelStore } from "@stores/channels/store"
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser"
import { isHRInstalled } from "@lib/apps"
import { siteKey } from "@lib/site"
import { hasRole } from "@lib/permissions"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { isFrappeSetupComplete, markSetupDoneLocally } from "@utils/setup"
import { getSetupSteps, getSetupStepTitle, type SetupStepName, type StepStatus, type StepStatuses } from "./steps"
import { ChannelStep } from "./steps/ChannelStep"
import { HRStep } from "./steps/HRStep"
import { ProfileStep } from "./steps/ProfileStep"
import { TeamStep } from "./steps/TeamStep"
import { WorkspaceStep } from "./steps/WorkspaceStep"
import { finaleSchedule, type FinalePhase } from "./finale"
import { FinaleMessage } from "./FinaleMessage"
import { buildPreviewModel, type PreviewDraft, type PreviewModel } from "./preview/model"
import { teamPreviewPeople } from "./steps/teamPreview"
import { SetupPreview } from "./preview/SetupPreview"
import type { SetupState, SetupStepBodyProps, SiteUser } from "./types"
import { prefersReducedMotion, useStepTransition } from "./useStepTransition"
import { useSetupTelemetry } from "./useSetupTelemetry"

const ALL_STEPS: SetupStepName[] = ["profile", "workspace", "channel", "team", "hr"]
// One empty list, so a failed people request doesn't hand the team step a new array every render.
const NO_SITE_USERS: SiteUser[] = []

/**
 * First-admin setup, or a new member's profile: a full page with one step at a time. Covers
 * the app, which can't take focus meanwhile (its chat composer focuses itself on load).
 */
const SetupPage = ({ mode, onFinished }: { mode: "admin" | "profile"; onFinished: () => void }) => {
    const navigate = useNavigate()
    // Only the admin flow adds people.
    const { data, isLoading } = useFrappeGetCall<{ message: SiteUser[] }>("raven.api.setup.get_site_users", undefined, mode === "admin" ? undefined : null, {
        revalidateOnFocus: false,
        revalidateIfStale: false,
    })
    const siteUsers = data?.message ?? NO_SITE_USERS

    // Kept across reloads, so a refresh mid-setup doesn't offer to make a second workspace or channel.
    // Per user, so another admin on the same browser starts their own; per mode, so a profile never ends the admin's;
    // per site in the app, so one site's workspace never leaks into another's setup.
    const progressKey = siteKey(`${mode === "admin" ? "raven_setup_progress" : "raven_profile_progress"}:${window.frappe?.boot?.user?.name}`)
    const [saved, setSaved, clearSaved] = useLocalStorage<{ setup: SetupState; statuses: StepStatuses }>(progressKey, {
        setup: { invited: [], addedSiteUsers: [] },
        statuses: {},
    })
    const { setup, statuses } = saved
    const [current, setCurrent] = useState<SetupStepName>(() => ALL_STEPS.find((step) => !saved.statuses[step]) ?? "profile")
    const [finishing, setFinishing] = useState(false)
    // After the last step: "Now," then "Send a Raven", the preview growing into the app, then the app.
    const [finale, setFinale] = useState<FinalePhase | null>(null)
    const finaleTimers = useRef<number[]>([])
    // Set by the expand phase only: with no preview (narrow screens) the leave phase isn't expanded.
    const [expanded, setExpanded] = useState(false)
    useEffect(() => () => finaleTimers.current.forEach(window.clearTimeout), [])
    const { call: completeSetup } = useFrappePostCall("raven.api.setup.complete_setup")

    // Email invites create users, so they need System Manager; anyone can add people already in Raven.
    const hasTeamStep = hasRole("System Manager") || siteUsers.length > 0 || setup.addedSiteUsers.length > 0
    const steps = getSetupSteps({ mode, hasTeamStep, hrInstalled: isHRInstalled() })
    // A step can drop out once the data loads (no one to add); land on the next one still to do.
    const step = steps.includes(current) ? current : steps.find((name) => !statuses[name]) ?? steps[steps.length - 1]
    const index = steps.indexOf(step)
    const isLast = index === steps.length - 1

    // Saved progress is checked against the server once the workspace list is in. Progress whose
    // workspace no longer exists is from an earlier install on this origin (a reinstalled site, the
    // same user): it's dropped, or the flow would skip to the team step over records that are gone.
    // No saved progress (another device, cleared storage) but setup already made the workspace:
    // on a fresh site the one workspace this admin runs is setup's.
    const { workspaces, isLoading: workspacesLoading, error: workspacesError } = useWorkspaces()
    const checkedWorkspaces = useRef(false)
    useEffect(() => {
        if (mode !== "admin" || workspacesLoading || workspacesError || checkedWorkspaces.current) return
        checkedWorkspaces.current = true
        if (saved.setup.workspace) {
            if (workspaces.some((workspace) => workspace.name === saved.setup.workspace)) return
            clearSaved()
            setCurrent("profile")
            return
        }
        const administered = workspaces.filter((workspace) => workspace.workspace_member_name && workspace.is_admin)
        if (administered.length !== 1) return
        setSaved({ setup: { ...saved.setup, workspace: administered[0].name }, statuses: { ...saved.statuses, workspace: "completed" } })
        setCurrent((name) => (name === "workspace" ? "channel" : name))
    }, [workspacesLoading]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const app = document.getElementById("root")
        app?.setAttribute("inert", "")
        // The app's shortcuts listen on document and would still open the command menu or
        // settings over this page; keys stop at body. The page's own handlers run before.
        const stop = (event: KeyboardEvent) => event.stopPropagation()
        document.body.addEventListener("keydown", stop)
        document.body.addEventListener("keyup", stop)
        return () => {
            app?.removeAttribute("inert")
            document.body.removeEventListener("keydown", stop)
            document.body.removeEventListener("keyup", stop)
        }
    }, [])

    const telemetry = useSetupTelemetry({ mode, step, steps })

    const finish = (finalSetup: SetupState, finalStatuses: StepStatuses) => {
        setFinishing(true)
        telemetry.finishing()
        const withStatus = (status: StepStatus) => steps.filter((name) => finalStatuses[name] === status)
        // Members only set up their profile; completing the site is the admin flow's.
        const completesSite = mode === "admin"
        // The local flag ends the flow even if this save fails.
        const save = completesSite ? completeSetup({ completed_steps: withStatus("completed"), skipped_steps: withStatus("skipped") }) : Promise.resolve()
        save
            .catch(() => { })
            .finally(() => {
                if (completesSite) markSetupDoneLocally()
                // The app opens underneath, so it's there when the preview gives way to it.
                if (finalSetup.workspace) {
                    const workspace = `/${encodeURIComponent(finalSetup.workspace)}`
                    navigate(finalSetup.channel ? `${workspace}/${encodeURIComponent(finalSetup.channel.id)}` : workspace)
                }
                // Saved progress feeds the preview, so it's cleared only once the preview has handed over to the app.
                playFinale(() => {
                    clearSaved()
                    onFinished()
                })
            })
    }

    const playFinale = (close: () => void) => {
        const previewShown = window.matchMedia("(min-width: 1024px)").matches
        finaleTimers.current = finaleSchedule({ reducedMotion: prefersReducedMotion(), previewShown }).map(({ at, phase }) =>
            window.setTimeout(() => {
                if (phase === "closed") return close()
                if (phase === "expand") setExpanded(true)
                setFinale(phase)
            }, at),
        )
    }

    const settle = (status: StepStatus, patch?: Partial<SetupState>) => {
        const nextSetup = patch ? { ...setup, ...patch } : setup
        // A step finished before stays finished when skipped on a revisit.
        const nextStatuses = statuses[step] === "completed" ? statuses : { ...statuses, [step]: status }
        setSaved({ setup: nextSetup, statuses: nextStatuses })
        telemetry.settled(step, status)
        if (isLast) finish(nextSetup, nextStatuses)
        else setCurrent(steps[index + 1])
    }

    const { myProfile } = useCurrentRavenUser()
    const [draft, setDraft] = useState<PreviewDraft>({})
    // A step's unsaved typing never outlives the step. Reset during render, not in an
    // effect: child effects run first, so an effect would wipe the new step's first draft.
    const [draftStep, setDraftStep] = useState(step)
    const [stepBusy, setStepBusy] = useState(false)
    if (draftStep !== step) {
        setDraftStep(step)
        setDraft({})
        setStepBusy(false)
    }

    const savedWorkspace = workspaces.find((workspace) => workspace.name === setup.workspace)
    const savedPreview: PreviewModel = {
        profile: myProfile?.full_name ? { name: myProfile.full_name, image: myProfile.user_image || undefined } : undefined,
        workspace: savedWorkspace ? { name: savedWorkspace.workspace_name, logo: savedWorkspace.logo || undefined } : undefined,
        channel: setup.channel ? { name: setup.channel.name, type: channelStore.getChannel(setup.channel.id)?.type } : undefined,
        // Everyone on the site is in DMs, added to the workspace or not, then invitees.
        people: teamPreviewPeople([], setup.invited, [
            ...siteUsers,
            ...setup.addedSiteUsers.filter((added) => !siteUsers.some((user) => user.user === added.user)),
        ]),
        // The HR step reports its toggle; elsewhere no one shows on leave.
        leave: false,
    }
    const preview = buildPreviewModel(savedPreview, draft)

    const props: SetupStepBodyProps = {
        setup,
        isLast,
        finishing,
        onBack: index > 0
            ? () => {
                telemetry.wentBack(step, steps[index - 1])
                setCurrent(steps[index - 1])
            }
            : undefined,
        onDone: (patch) => settle("completed", patch),
        onSkip: () => settle("skipped"),
        onSave: (patch) => setSaved((current) => ({ ...current, setup: { ...current.setup, ...patch } })),
        onPreview: (patch) => setDraft((current) => ({ ...current, ...patch })),
        onBusyChange: setStepBusy,
    }

    const { shown, phase } = useStepTransition(step)
    // A step fading out renders as itself, busy; it can't settle anything, hold Back, or write the next step's preview.
    const shownProps: SetupStepBodyProps = shown === step ? props : {
        ...props,
        isLast: steps.indexOf(shown) === steps.length - 1,
        finishing: true,
        onDone: () => { },
        onSkip: () => { },
        onBusyChange: () => { },
        onPreview: () => { },
    }

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-title"
            className={cn("fixed inset-0 z-50 flex bg-surface-base", finale === "leave" && "animate-setup-fade-out")}
        >
            {/* The live preview. Decorative, so hidden from assistive tech. At the end it grows to fill the screen. */}
            <aside
                aria-hidden
                className={cn(
                    "hidden min-w-0 overflow-hidden bg-surface-gray-2 transition-[width] transition-setup-expand lg:flex",
                    expanded ? "lg:w-full" : "lg:w-1/2",
                )}
            >
                {/* Once done, it shows where the app opens: the workspace, on the new channel. */}
                <SetupPreview model={preview} activeStep={finale ? "channel" : step} finished={!!finale} expanded={expanded} />
            </aside>
            <main
                className={cn(
                    "relative flex w-full min-w-0 flex-col border-s border-outline-gray-1 bg-surface-base pb-8 transition-[width,padding,border-width,opacity] transition-setup-expand",
                    expanded ? "overflow-hidden border-s-0 px-0 opacity-0 lg:w-0" : "overflow-y-auto px-6 lg:w-1/2 lg:px-12",
                )}
            >
                {/* Holds the steps' place; Back sits in the corner, equally far from the top and the side. */}
                <div className="h-14 shrink-0">
                    {props.onBack && !finale && (
                        <Button variant="ghost" size="md" className="absolute start-4 top-4 h-10 md:h-8" onClick={props.onBack} disabled={finishing || stepBusy}>
                            <ArrowLeft />
                            {_("Back")}
                        </Button>
                    )}
                </div>
                {finale && finale !== "out" ? (
                    <FinaleMessage phase={finale} />
                ) : !isLoading && (
                    // Whether there's a team step depends on the people list; wait so the steps don't jump.
                    <div className={cn("mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 pt-[12vh]", finale === "out" ? "animate-setup-step-out" : "animate-setup-open-late")}>
                        {steps.length > 1 && (
                            <Progress
                                value={((index + 1) / steps.length) * 100}
                                intervals={steps.length}
                                size="md"
                                ariaLabel={_("Setup progress")}
                            />
                        )}
                        <div
                            key={shown}
                            // A step fading out can't be clicked, typed into or submitted again.
                            inert={phase === "out"}
                            // The title and fields fade; the footer stays put and only swaps its label.
                            className={cn(
                                "flex min-h-[28rem] flex-col gap-2 [&_form]:flex-1",
                                phase === "out"
                                    ? "[&>h1]:animate-setup-step-out [&_form>*:not([data-slot=step-footer])]:animate-setup-step-out"
                                    : "[&>h1]:animate-setup-step-in [&_form>*:not([data-slot=step-footer])]:animate-setup-step-in",
                            )}
                        >
                            <h1 id="setup-title" className="text-2xl-semibold text-ink-gray-9">
                                {getSetupStepTitle(shown)}
                            </h1>
                            {shown === "profile" ? (
                                <ProfileStep {...shownProps} askPassword={mode === "admin" && !!window.frappe?.boot?.is_fc_site && !isFrappeSetupComplete()} />
                            ) : shown === "workspace" ? (
                                <WorkspaceStep {...shownProps} />
                            ) : shown === "channel" ? (
                                <ChannelStep {...shownProps} />
                            ) : shown === "team" ? (
                                <TeamStep {...shownProps} siteUsers={siteUsers} canInvite={hasRole("System Manager")} />
                            ) : (
                                <HRStep {...shownProps} />
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>,
        document.body,
    )
}

export default SetupPage
