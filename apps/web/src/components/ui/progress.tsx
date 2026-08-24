import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@lib/utils"
import { cva, VariantProps } from "class-variance-authority"

const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full",
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

interface ProgressProps extends React.ComponentProps<typeof ProgressPrimitive.Root>, VariantProps<typeof progressVariants> {
  /** Optional text label displayed on the progress bar */
  label?: React.ReactNode,
  /** Whether to show a hint/tooltip for the progress value */
  hint?: boolean,
  /** Override the default hint text with custom progress value */
  hintText?: React.ReactNode,
  /** Render as discrete filled segments instead of a continuous bar */
  intervals?: boolean,
  /** Number of segments to render when `intervals` is enabled */
  intervalCount?: number
}

function Progress({
  className,
  value,
  size = "sm",
  label,
  hint,
  hintText,
  intervals = false,
  intervalCount = 6,
  ...props
}: ProgressProps) {

  const progressValue = hintText ? hintText : `${value}%`

  const filledIntervalCount =
    (value ?? 0) > 100 ? intervalCount : Math.round(((value ?? 0) / 100) * intervalCount)

  return (
    <div className="flex flex-col gap-2.5">
      {label || hint ? <div className="flex items-baseline justify-between gap-1">
        {label && <span className="text-base-medium text-ink-gray-8">{label}</span>}
        {hint && <span className="text-base-medium text-ink-gray-4">{progressValue}</span>}
      </div> : null}
      <ProgressPrimitive.Root
        data-slot="progress"
        data-size={size}
        value={value}
        className={cn(progressVariants({ size }), intervals ? "flex gap-1" : "bg-surface-gray-2", className)}
        {...props}
      >
        {intervals ? (
          Array.from({ length: intervalCount }, (_, index) => (
            <div
              key={index}
              data-slot="progress-interval"
              className={cn("h-full flex-1", index < filledIntervalCount ? "bg-surface-gray-10" : "bg-surface-gray-2")}
            />
          ))
        ) : (
          <ProgressPrimitive.Indicator
            data-slot="progress-indicator"
            className="bg-surface-gray-10 rounded-xl h-full w-full flex-1 transition-all"
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
          />
        )}
      </ProgressPrimitive.Root>
    </div>
  )
}

export { Progress }
