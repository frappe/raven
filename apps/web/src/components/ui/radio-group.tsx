import * as React from "react"
import { CircleIcon } from "lucide-react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@lib/utils"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "peer border shrink-0 rounded-full outline-none transition align-middle",
        "size-4 aspect-square",
        "border-outline-gray-4",
        "data-[state=checked]:bg-ink-gray-8 data-[state=checked]:border-ink-gray-8 data-[state=checked]:text-ink-base",
        "hover:border-outline-gray-7 hover:shadow-checkbox-hover hover:data-[state=checked]:bg-ink-gray-7 hover:data-[state=checked]:border-ink-gray-7",
        "active:border-outline-gray-6 active:data-[state=checked]:bg-ink-gray-6 active:data-[state=checked]:border-ink-gray-6",
        "focus-visible:border-outline-gray-8 focus-visible:focus-ring focus-visible:data-[state=checked]:bg-ink-gray-8 focus-visible:data-[state=checked]:border-ink-gray-8",
        "disabled:border-outline-gray-2 disabled:bg-surface-gray-1 disabled:cursor-not-allowed disabled:data-[state=checked]:bg-surface-gray-3 disabled:data-[state=checked]:border-surface-gray-3",
        "aria-invalid:border-outline-red-3",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="fill-current absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
