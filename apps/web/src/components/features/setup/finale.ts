/**
 * After the last step: the form leaves, a check and "All done" show, "All done" gives way to
 * "Now, send a raven.", the preview grows into the app and the page fades onto it.
 */
export type FinalePhase = "out" | "done" | "send" | "expand" | "leave" | "closed"

const OUT_MS = 250
// The check draws, then "All done" is read.
const DONE_MS = 1400
// "All done" fades out, a beat, "Now," fades in, then "send a raven.", and the whole line is read.
const SEND_MS = 3000
// The `transition-setup-expand` utility in index.css.
const EXPAND_MS = 600
const LEAVE_MS = 250

/** When each phase starts, in ms from the finish. No preview (narrow screens) means nothing to expand. */
export const finaleSchedule = ({ reducedMotion, previewShown }: { reducedMotion: boolean; previewShown: boolean }): { at: number; phase: FinalePhase }[] => {
    if (reducedMotion) return [{ at: 0, phase: "done" }, { at: 1000, phase: "send" }, { at: 2000, phase: "closed" }]
    const send = OUT_MS + DONE_MS
    const leave = send + SEND_MS + (previewShown ? EXPAND_MS : 0)
    return [
        { at: 0, phase: "out" },
        { at: OUT_MS, phase: "done" },
        { at: send, phase: "send" },
        ...(previewShown ? [{ at: send + SEND_MS, phase: "expand" as const }] : []),
        { at: leave, phase: "leave" },
        { at: leave + LEAVE_MS, phase: "closed" },
    ]
}
