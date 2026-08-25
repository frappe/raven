import { cn } from "@lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("bg-surface-gray-3 animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
