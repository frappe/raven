import { cn } from '@lib/utils'
import type React from 'react'

export interface ProgressCircleProps extends React.ComponentProps<'svg'> {
    value: number
    className?: string
}

// https://github.com/shadcn-ui/ui/issues/697
// https://github.com/shadcn-ui/ui/issues/697#issuecomment-2621653578 CircularProgress

function clamp(input: number, a: number, b: number): number {
    return Math.max(Math.min(input, Math.max(a, b)), Math.min(a, b))
}

// match values with lucide icons for compatibility
const size = 24
const strokeWidth = 4

// fix to percentage values
const total = 100

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/progress
 * @see https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/progressbar_role
 */
export const ProgressCircle = ({ value, className, ...restSvgProps }: ProgressCircleProps) => {
    const normalizedValue = clamp(value, 0, total)

    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const progress = (normalizedValue / total) * circumference
    const halfSize = size / 2

    const commonParams = {
        cx: halfSize,
        cy: halfSize,
        r: radius,
        fill: 'none',
        strokeWidth,
    }

    return (
        // biome-ignore lint/a11y/useFocusableInteractive: false positive (progress + progressbar are not focusable interactives)
        // biome-ignore lint/nursery/useAriaPropsSupportedByRole: biome rule at odds with mdn docs (presumed nursary bug with rule)
        <svg
            // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: false positive (progressbar not an interactive role)
            role="progressbar"
            viewBox={`0 0 ${size} ${size}`}
            className={cn('size-4 text-ink-gray-8', className)}
            aria-valuenow={normalizedValue}
            aria-valuemin={0}
            aria-valuemax={100}
            {...restSvgProps}
        >
            <circle {...commonParams} className="stroke-current/25" />
            <circle
                {...commonParams}
                stroke="currentColor"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                strokeLinecap="round"
                transform={`rotate(-90 ${halfSize} ${halfSize})`}
                className="stroke-current"
            />
        </svg>
    )
}