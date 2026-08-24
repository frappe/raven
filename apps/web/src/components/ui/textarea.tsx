import * as React from "react"

import { cn } from "@lib/utils"
import { cva, VariantProps } from "class-variance-authority"


const textareaVariants = cva(cn("flex field-sizing-content w-full transition-colors focus-visible:bg-surface-base focus-visible:border-outline-gray-4 focus-visible:shadow-sm focus-visible:focus-ring active:bg-surface-base active:shadow-textarea-active active:border-outline-gray-4 outline-none border border-transparent placeholder:text-ink-gray-4 text-ink-gray-8 disabled:bg-surface-gray-1 disabled:placeholder:text-ink-gray-3 disabled:text-ink-gray-3 disabled:cursor-not-allowed aria-readonly:bg-surface-gray-1 aria-readonly:text-ink-gray-6 aria-readonly:pointer-events-none aria-invalid:focus-ring-red aria-invalid:border-outline-red-3",
  "in-data-[slot=input-group]:border-transparent! in-data-[slot=input-group]:focus-visible:shadow-none! in-data-[slot=input-group]:focus-visible:outline-none! in-data-[slot=input-group]:bg-transparent!"),
  {
    variants: {
      inputSize: {
        sm: "text-p-base rounded py-1.5 px-2 min-h-15",
        md: "text-p-base rounded-md py-2.5 px-3 min-h-20.5",
        lg: "text-p-lg rounded-md py-3 px-3.5 min-h-25.5",
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

function Textarea({ inputSize = "md", variant = "subtle", className, ...props }: React.ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>) {
  return (
    <textarea
      data-slot="textarea"
      data-input-size={inputSize}
      data-variant={variant}
      className={cn(
        textareaVariants({ inputSize, variant }),
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
