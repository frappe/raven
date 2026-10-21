import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@lib/utils"
import { clampProgress, getFilledIntervals } from "@lib/progress"
import { cva, VariantProps } from "class-variance-authority"

const progressVariants = cva(
  "relative w-full transform-gpu overflow-hidden rounded-7",
  {
    variants: {
      size: {
        sm: "h-0.5",
        md: "h-1",
        lg: "h-2",
        xl: "h-3"
      }
    }
  }
)

interface ProgressProps extends Omit<React.ComponentProps<typeof ProgressPrimitive.Root>, "value">, VariantProps<typeof progressVariants> {
  /** 0–100; out-of-range values pin to the ends */
  value: number,
  /** Text above the bar, on the left */
  label?: React.ReactNode,
  /** Shows the value as a percentage, on the right */
  hint?: boolean,
  /** Replaces the percentage; shown even without `hint` */
  hintText?: React.ReactNode,
  /** Number of segments; omit for a continuous bar */
  intervals?: number,
  /** Accessible name; defaults to a string `label`, then "Progress" */
  ariaLabel?: string
}

function Progress({
  className,
  value,
  size = "sm",
  label,
  hint,
  hintText,
  intervals,
  ariaLabel,
  ...props
}: ProgressProps) {

  const clamped = clampProgress(value)
  const filled = intervals ? getFilledIntervals(value, intervals) : 0
  const showHint = hint || hintText != null

  return (
    <div className="flex w-full flex-col gap-2.5">
      {label || showHint ? <div className="flex items-baseline justify-between">
        {label ? <span className="text-base-medium text-ink-gray-8">{label}</span> : <span />}
        {showHint && <span className="self-end">{hintText ?? <span className="text-base-medium text-ink-gray-4">{value}%</span>}</span>}
      </div> : null}
      <ProgressPrimitive.Root
        data-slot="progress"
        data-size={size}
        value={clamped}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : "Progress")}
        className={cn(progressVariants({ size }), intervals ? "flex gap-1" : "bg-surface-gray-2", className)}
        {...props}
      >
        {intervals ? (
          Array.from({ length: intervals }, (_, index) => (
            <div
              key={index}
              data-slot="progress-interval"
              className={cn("h-full flex-1 transition-colors duration-300 motion-reduce:transition-none", index < filled ? "bg-surface-gray-10" : "bg-surface-gray-2")}
            />
          ))
        ) : (
          // Full-width fill slid left: transform composites, animating width reflows.
          <ProgressPrimitive.Indicator
            data-slot="progress-indicator"
            className="h-full w-full bg-surface-gray-10 transition-transform duration-[660ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(${clamped - 100}%)` }}
          />
        )}
      </ProgressPrimitive.Root>
    </div>
  )
}

export { Progress }
