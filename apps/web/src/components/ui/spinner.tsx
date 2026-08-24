import { cn } from "@lib/utils"
import "./spinner.css"

type SpinnerSize = "xs" | "sm" | "md" | "lg"

// px diameter, ring thickness and inner padding per size, matching the Figma
// sizes (the ring is inset from the box edge by ~7.5% of the diameter).
const sizeMap: Record<SpinnerSize, { px: number; thickness: number; inset: number }> = {
  xs: { px: 12, thickness: 1.5, inset: 0.9 },
  sm: { px: 14, thickness: 2, inset: 1.05 },
  md: { px: 16, thickness: 2, inset: 1.2 },
  lg: { px: 20, thickness: 2, inset: 1.5 },
}

function Spinner({
  className,
  size,
  theme,
  track = false,
  style,
  ...props
}: Omit<React.ComponentProps<"svg">, "size"> & {
  /** Fixed diameter preset. Omit to size via a `size-*`/width class instead. */
  size?: SpinnerSize
  /** Tints the comet; omit to inherit the current text color. */
  theme?: "gray" | "red"
  /** Faint full-circle track behind the arc. */
  track?: boolean
}) {
  // Fixed sizing applies only for a valid `size`. Otherwise the spinner is
  // sized by CSS (a width/height class or inline style), falling back to the
  // 16px svg attributes; thickness/inset stay proportional via the % defaults.
  const s = size ? sizeMap[size] : undefined
  const sizeStyle = s
    ? ({
        width: `${s.px}px`,
        height: `${s.px}px`,
        "--fui-spinner-thickness": `${s.thickness}px`,
        "--fui-spinner-mask-thickness": `${s.thickness}px`,
        "--fui-spinner-inset": `${s.inset}px`,
      } as React.CSSProperties)
    : undefined

  const colorClass = theme ? { gray: "text-ink-gray-8", red: "text-ink-red-8" }[theme] : undefined

  return (
    <svg
      role="status"
      aria-label="Loading"
      width={16}
      height={16}
      className={cn("fui-spinner inline-block shrink-0", colorClass, track && "fui-spinner--track", className)}
      style={{ ...sizeStyle, ...style }}
      {...props}
    />
  )
}

export { Spinner }
