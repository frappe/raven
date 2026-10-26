import { useMediaQuery } from 'usehooks-ts'

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

export function useIsMobile() {

  return useMediaQuery(MOBILE_QUERY)
}

/** One-off viewport read for handlers that run after render. */
export function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
}
