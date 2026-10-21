import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import type { FinalePhase } from "./finale"

// One size and line height for both lines, so swapping them moves nothing.
const LINE = "text-[22px] font-semibold leading-[1.3] text-ink-gray-9 md:text-[24px]"
// The sign-off in Newsreader, as on frappe.io/product/raven.
const SERIF = "font-[family-name:Newsreader] font-medium tracking-[0.16px]"

/**
 * What the form column shows after the last step, on the steps' left edge: a check that draws
 * itself and stays, with "All done" under it giving way to "Now, send a raven." The two lines
 * share one slot; the first fades out, then after a beat "Now," fades in, then the rest.
 */
export const FinaleMessage = ({ phase }: { phase: FinalePhase }) => {
    const sent = phase !== "done"
    // First paint has nothing shown, so "All done" fades in like the other line.
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        const frame = requestAnimationFrame(() => setMounted(true))
        return () => cancelAnimationFrame(frame)
    }, [])
    return (
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 pb-[12vh]">
            <span className="flex size-10 items-center justify-center rounded-full bg-surface-green-2 text-ink-green-6 animate-setup-item-in">
                <Check className="size-5 animate-setup-check" strokeWidth={2.5} aria-hidden />
            </span>
            <div className="grid">
                <h1 id="setup-title" className={cn(LINE, "[grid-area:1/1]", fade(mounted && !sent))}>
                    {_("All done")}
                </h1>
                <p aria-hidden className={cn(LINE, SERIF, "[grid-area:1/1]", fade(sent))}>
                    {_("Now,")}{" "}
                    {/* The rest follows the "Now," once it has been read. Always in the line, so nothing reflows. */}
                    <span className={cn("transition-opacity motion-reduce:transition-none", sent ? "opacity-100 duration-500 delay-[1100ms]" : "opacity-0 delay-0 duration-300")}>
                        {_("send a raven.")}
                    </span>
                </p>
            </div>
        </div>
    )
}

/** Fades out in 300ms; fades in over half a second after a 400ms beat, so the other line is gone first. */
const fade = (shown: boolean) =>
    cn("transition-opacity motion-reduce:transition-none", shown ? "opacity-100 duration-500 delay-[400ms]" : "opacity-0 duration-300 delay-0")
