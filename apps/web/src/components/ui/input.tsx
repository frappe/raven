import * as React from "react"

import { cn } from "@lib/utils"
import { cva, VariantProps } from "class-variance-authority"

const inputVariants = cva(cn("flex w-full min-w-0 transition-colors outline-none border border-transparent",
  "focus-visible:bg-surface-base focus-visible:border-outline-gray-4 focus-visible:shadow-sm focus-visible:focus-ring",
  "active:bg-surface-base active:shadow-sm active:border-outline-gray-4",
  "placeholder:text-ink-gray-4 text-ink-gray-8",
  "disabled:bg-surface-gray-1 disabled:placeholder:text-ink-gray-3 disabled:text-ink-gray-3 disabled:cursor-not-allowed disabled:pointer-events-none",
  "aria-readonly:bg-surface-gray-1 aria-readonly:text-ink-gray-6 aria-readonly:pointer-events-none aria-invalid:focus-ring-red aria-invalid:border-outline-red-3",
  "in-data-[slot=input-group]:border-transparent! in-data-[slot=input-group]:focus-visible:shadow-none! in-data-[slot=input-group]:focus-visible:outline-none! in-data-[slot=input-group]:bg-transparent!"),
  {
    variants: {
      inputSize: {
        sm: "text-base rounded py-1.5 px-2 h-7",
        md: "text-base rounded py-1.5 px-2.5 h-8",
        lg: "text-xl rounded-md py-1.5 px-3 h-10",
      },
      variant: {
        subtle: "bg-surface-gray-2 hover:bg-surface-gray-3 hover:border-outline-elevation-2 aria-invalid:bg-surface-red-1",
        outline: "bg-surface-base border-outline-gray-2 hover:border-outline-gray-3 hover:shadow-sm active:border-outline-gray-4 disabled:border-outline-gray-2",
      }
    },
    defaultVariants: {
      inputSize: "md",
      variant: "subtle"
    }
  }
)

function Input({ className, type, inputSize = "md", variant = "subtle", ...props }: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      data-input-size={inputSize}
      data-variant={variant}
      className={cn(
        "file:text-ink-gray-8 file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium",
        inputVariants({ inputSize, variant }),
        className
      )}
      {...props}
    />
  )
}

export { Input }
