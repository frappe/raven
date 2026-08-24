import { useAtomValue } from "jotai"
import { chatStyleAtom } from "@utils/preferences"
import { useUserCookieData } from "./useUserCookieData"

/**
 * Per-row message layout flags. `isLeftRight` turns on bubble styling for everyone;
 * `isOwn` is true only for the current user's messages in Left-Right mode — those render
 * right-aligned with no avatar (iMessage-style). Cheap: a primitive atom + a cookie read,
 * so it's fine to call per message row.
 */
export const useMessageAlignment = (owner: string) => {
    const isLeftRight = useAtomValue(chatStyleAtom) === "Left-Right"
    const { name } = useUserCookieData()
    return { isLeftRight, isOwn: isLeftRight && owner === name }
}
