import * as React from "react"

import { cn } from "@lib/utils"
import { useFileSrc } from "@hooks/useFileSrc"

type ImageStatus = "loading" | "loaded" | "error"

/**
 * Image URLs that have painted once this session. A remounting avatar for one of
 * these starts out loaded, so its fallback never paints. Route changes remount
 * whole page shells (the mobile footer with the profile avatar, for one), and
 * without this Safari showed the initials for a frame on every navigation.
 */
const loadedSources = new Set<string>()

// Lets the fallback know whether the image has painted, so it can get out of
// the way. Transparent logos would otherwise show the initials through them.
const AvatarContext = React.createContext<{
  status: ImageStatus
  setStatus: (status: ImageStatus) => void
}>({ status: "loading", setStatus: () => {} })

function Avatar({
  className,
  ...props
}: React.ComponentProps<"span">) {
  const [status, setStatus] = React.useState<ImageStatus>("loading")
  return (
    <AvatarContext.Provider value={{ status, setStatus }}>
      <span
        data-slot="avatar"
        className={cn(
          "relative isolate flex size-8 shrink-0 overflow-hidden",
          className
        )}
        {...props}
      />
    </AvatarContext.Provider>
  )
}

/**
 * A plain <img>. It is in the DOM from the first render, so the browser
 * paints a cached image in the same frame and retries a failed one on the
 * next mount. A failed image is hidden rather than removed. Removing it
 * would remount it and request the same URL again.
 */
function AvatarImage({
  className,
  src,
  alt = "",
  onLoad,
  onError,
  ...props
}: React.ComponentProps<"img">) {
  const { status, setStatus } = React.useContext(AvatarContext)
  const ref = React.useRef<HTMLImageElement>(null)
  // Private site files need the token in native; useFileSrc routes them through the media proxy.
  const fileSrc = useFileSrc(src)

  // Every new src starts over. A layout effect runs before paint, so an image
  // known to be loaded flips the status in the same frame and the fallback never
  // shows. A cached image can also be complete already, so read the element
  // rather than waiting for the load event.
  React.useLayoutEffect(() => {
    if (!src) return
    const image = ref.current
    const ready = loadedSources.has(src) || (image?.complete && image.naturalWidth > 0)
    setStatus(ready ? "loaded" : "loading")
    return () => setStatus("loading")
  }, [src, setStatus])

  if (!src) return null

  // An image this session has already shown is loaded eagerly and decoded on the
  // main thread, so a remount paints it in its first frame with no flash. A first
  // showing keeps lazy loading and async decoding: initials while it arrives is the
  // intended state there, and a large original must not decode on the main thread
  // while a list scrolls. Explicit props from the caller still win.
  const known = loadedSources.has(src)

  return (
    <img
      ref={ref}
      data-slot="avatar-image"
      src={fileSrc}
      alt={alt}
      loading={known ? "eager" : "lazy"}
      decoding={known ? "sync" : "async"}
      hidden={status === "error"}
      className={cn("aspect-square size-full object-cover object-center", className)}
      onLoad={(event) => {
        if (src) loadedSources.add(src)
        setStatus("loaded")
        onLoad?.(event)
      }}
      onError={(event) => {
        setStatus("error")
        onError?.(event)
      }}
      {...props}
    />
  )
}

/** Shown behind the image until it has painted, and on its own when there is no image. */
function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<"span">) {
  const { status } = React.useContext(AvatarContext)
  if (status === "loaded") return null
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        "bg-surface-gray-2 text-ink-gray-5 absolute inset-0 -z-10 flex items-center justify-center rounded-full select-none",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
