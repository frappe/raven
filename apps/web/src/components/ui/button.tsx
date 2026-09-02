import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { Spinner } from "./spinner"
import { cn } from "@lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed whitespace-nowrap transition-colors disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:focus-ring-red aria-invalid:border-outline-red-3",
  {
    variants: {
      variant: {
        solid: "",
        subtle: "",
        ghost: "bg-transparent",
        outline: "bg-surface-base border",
        link: "bg-transparent underline-offset-4 underline",
      },
      size: {
        xs: "h-6 text-xs px-1.5 rounded-3 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-7 text-base px-2 rounded [&_svg:not([class*='size-'])]:size-4",
        md: "h-8 text-base-medium px-2.5 rounded [&_svg:not([class*='size-'])]:size-4.5",
        lg: "h-10 text-xl-medium px-3 rounded-md [&_svg:not([class*='size-'])]:size-5",
      },
      theme: {
        // gray relies on the global :focus-visible ring (--focus-outline-default)
        gray: "focus-visible:focus-ring",
        red: "focus-visible:focus-ring-red",
      },
      isIconButton: {
        true: "px-0",
        false: ""
      }
    },
    compoundVariants: [
      // Icon only buttons - Sizes
      {
        isIconButton: true,
        size: "xs",
        className: "size-6"
      },
      {
        isIconButton: true,
        size: "sm",
        className: "size-7"
      },
      {
        isIconButton: true,
        size: "md",
        className: "size-8"
      },
      {
        isIconButton: true,
        size: "lg",
        className: "size-10"
      },
      // Solid buttons
      {
        variant: "solid",
        theme: "gray",
        className: "text-ink-base bg-surface-gray-10 hover:bg-surface-gray-9 active:bg-surface-gray-8 disabled:bg-surface-gray-2 disabled:text-ink-gray-4"
      },
      {
        variant: "solid",
        theme: "red",
        className: "text-ink-base dark:text-ink-red-10 bg-surface-red-7 hover:bg-surface-red-8 active:bg-surface-red-9 disabled:bg-surface-red-2 disabled:text-ink-red-5"
      },
      // Subtle Buttons
      {
        variant: "subtle",
        theme: "gray",
        className: "text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4 disabled:bg-surface-gray-2 disabled:text-ink-gray-4"
      },
      {
        variant: "subtle",
        theme: "red",
        className: "text-ink-red-8 bg-surface-red-2 hover:bg-surface-red-3 active:bg-surface-red-4 disabled:bg-surface-red-2 disabled:text-ink-red-5"
      },
      // Outline buttons
      {
        variant: "outline",
        theme: "gray",
        className:
          "text-ink-gray-8 border-outline-gray-2 hover:border-outline-gray-3 active:border-outline-gray-3 active:bg-surface-gray-4 disabled:bg-surface-gray-2 disabled:text-ink-gray-4 disabled:border-outline-gray-2"
      },
      {
        variant: "outline",
        theme: "red",
        className:
          "text-ink-red-8 border-outline-red-1 hover:border-outline-red-3 active:border-outline-red-3 active:bg-surface-red-3 disabled:bg-surface-red-2 disabled:text-ink-red-5 disabled:border-outline-red-1"
      },
      // Ghost buttons
      {
        variant: "ghost",
        theme: "gray",
        className:
          "text-ink-gray-8 hover:bg-surface-gray-3 active:bg-surface-gray-4 disabled:text-ink-gray-4"
      },
      {
        variant: "ghost",
        theme: "red",
        className:
          "text-ink-red-8 hover:bg-surface-red-3 active:bg-surface-red-4 disabled:text-ink-red-5"
      },
      //Link buttons
      {
        variant: "link",
        theme: "gray",
        className: "text-ink-gray-8 hover:text-ink-gray-8 active:text-ink-gray-8 disabled:text-ink-gray-4"
      },
      {
        variant: "link",
        theme: "red",
        className: "text-ink-red-8 hover:text-ink-red-8 active:text-ink-red-8 disabled:text-ink-red-5"
      },
    ],
    defaultVariants: {
      variant: "solid",
      size: "sm",
      theme: "gray",
    },
  }
)

function Button({
  className,
  variant = "solid",
  size = "sm",
  theme = "gray",
  isIconButton = false,
  asChild = false,
  loading = false,
  loadingText,
  disabled,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner and blocks interaction without dimming the button. */
    loading?: boolean
    /** Optional label shown in place of the children while loading. */
    loadingText?: React.ReactNode
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-theme={theme}
      data-loading={loading || undefined}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      // Swallow activation (pointer + keyboard, since Enter on a button fires
      // click) while loading, without the native `disabled` dimming.
      onClick={loading ? (e) => e.preventDefault() : onClick}
      className={cn(buttonVariants({ variant, size, theme, className, isIconButton }), loading && "pointer-events-none")}
      {...props}
    >
      {asChild ? (
        // Slot requires exactly one child — forward it untouched. (Loading
        // spinner injection isn't supported in asChild mode.)
        children
      ) : (
        <>
          {loading && <Spinner />}
          {/* An icon button is a fixed square: rendering the spinner NEXT TO the icon
              would squeeze both and shift the glyph. There it replaces the icon. A
              labelled button keeps its label beside the spinner (or swaps in loadingText). */}
          {loading
            ? (isIconButton ? null : (loadingText ?? children))
            : children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
