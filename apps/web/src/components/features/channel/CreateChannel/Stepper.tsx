import { CheckIcon } from 'lucide-react'
import { cn } from '@lib/utils'

interface Step {
    id: number
    title: string
    /** Rendered grayed-out — the step doesn't apply (e.g. Add Members for an
     *  Open channel, where everyone is already a member). Keeping the step
     *  visible-but-disabled avoids the layout shift of removing it. */
    disabled?: boolean
}

interface StepperProps {
    steps: Step[]
    currentStep: number
}

export const Stepper = ({ steps, currentStep }: StepperProps) => {
    return (
        <nav aria-label="Form progress" className="flex items-center justify-center gap-3">
            <ol className="flex items-center gap-3">
                {steps.map((step, index) => (
                    <li key={step.id} className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            {/* Step Circle */}
                            <div
                                className={cn(
                                    'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-all',
                                    step.disabled
                                        ? 'bg-surface-gray-1 text-ink-gray-3'
                                        : [
                                            currentStep > index && 'bg-ink-gray-8 text-ink-base',
                                            currentStep === index && 'bg-ink-gray-8 text-ink-base',
                                            currentStep < index && 'bg-surface-gray-2 text-ink-gray-4',
                                        ]
                                )}
                                aria-current={!step.disabled && currentStep === index ? 'step' : undefined}
                                aria-disabled={step.disabled || undefined}
                                aria-label={
                                    step.disabled
                                        ? `${step.title} - Not applicable`
                                        : currentStep > index
                                            ? `${step.title} - Completed`
                                            : currentStep === index
                                                ? `${step.title} - Current step`
                                                : `${step.title} - Not completed`
                                }
                            >
                                {!step.disabled && currentStep > index ? (
                                    <CheckIcon className="size-4" aria-hidden="true" />
                                ) : (
                                    <span aria-hidden="true">{step.id}</span>
                                )}
                            </div>

                            {/* Step Title */}
                            <span
                                className={cn(
                                    'text-sm-medium transition-colors',
                                    step.disabled
                                        ? 'text-ink-gray-3'
                                        : currentStep >= index
                                            ? 'text-ink-gray-8'
                                            : 'text-ink-gray-4'
                                )}
                                aria-hidden="true"
                            >
                                {step.title}
                            </span>
                        </div>

                        {/* Connector Line */}
                        {index < steps.length - 1 && (
                            <div
                                className={cn(
                                    'h-px w-8 transition-colors',
                                    currentStep > index
                                        ? 'bg-ink-gray-8'
                                        : 'bg-outline-gray-2'
                                )}
                                aria-hidden="true"
                            />
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    )
}

