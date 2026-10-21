import { ChannelPageSkeleton, DirectMessagePageSkeleton } from "@components/features/dm-channel/DirectMessagePageSkeleton"
import { cn } from "@lib/utils"
import type { SetupStepName } from "../steps"
import type { PreviewModel } from "./model"
import { PreviewChannelSidebar } from "./PreviewChannelSidebar"
import { PreviewDMHeader } from "./PreviewDMHeader"
import { PreviewDMSidebar } from "./PreviewDMSidebar"
import { PreviewRail } from "./PreviewRail"

/** Raven as it's being set up: a window from the rail across, cut off at the form column. */
export const SetupPreview = ({ model, activeStep, finished = false, expanded = false }: { model: PreviewModel; activeStep: SetupStepName; finished?: boolean; expanded?: boolean }) => {
    // The team, and then their leave from Frappe HR, show in the DM sidebar, as the app would open it.
    const dmsOpen = activeStep === "team" || activeStep === "hr"
    // On the HR step a DM is open: with the first person in the list, or yourself.
    const peer = activeStep === "hr" ? model.people.find((person) => person.name) ?? model.profile : undefined
    return (
        // Its skeletons hold still under reduced motion, like the rest of setup (the shared Skeleton always pulses).
        <div className={cn("flex h-full w-full flex-col transition-[padding] transition-setup-expand motion-reduce:[&_[data-slot=skeleton]]:animate-none", expanded ? "p-0" : "py-10 ps-10")}>
            {/* Wider than the pane, so the chat island runs past its right edge and is cut off there.
                Expanded, it's the app's own frame: edge to edge, no corner, border or shadow. */}
            <div
                className={cn(
                    "flex min-h-0 flex-1 overflow-hidden border border-e-0 bg-surface-sidebar animate-setup-open transition-[width,border-radius,border-width,border-color,box-shadow] transition-setup-expand",
                    expanded ? "w-full rounded-none border-0 border-transparent shadow-none" : "w-[calc(100%+16rem)] rounded-s-xl border-outline-gray-2 shadow-xl",
                )}
            >
                <PreviewRail model={model} dmsOpen={dmsOpen} />
                <div key={dmsOpen ? "dms" : "channels"} className="flex h-full shrink-0 animate-setup-blur-in">
                    {dmsOpen ? <PreviewDMSidebar model={model} /> : <PreviewChannelSidebar model={model} activeStep={activeStep} finished={finished} />}
                </div>
                {/* The chat area as the app shows it while loading, for the view that's open. */}
                {dmsOpen ? (
                    <DirectMessagePageSkeleton title={peer && <PreviewDMHeader name={peer.name} image={peer.image} onLeave={model.leave} />} />
                ) : (
                    <ChannelPageSkeleton />
                )}
            </div>
        </div>
    )
}
