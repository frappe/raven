import { useAtomValue } from "jotai"
import { chatStyleAtom } from "@utils/preferences"
import { isCurrentUser } from "@utils/userDisplay"

/**
 * Per-row message layout flags. `isLeftRight` turns on the iMessage layout for
 * everyone; `isOwn` is true only for the current user's messages in that mode —
 * those render right-aligned with no avatar.
 *
 * This runs once per message row, so the owner check uses isCurrentUser (a
 * cached string compare). useUserCookieData would re-parse document.cookie on
 * every row — see its own doc comment.
 */
export const useMessageAlignment = (owner: string) => {
    const isLeftRight = useAtomValue(chatStyleAtom) === "Left-Right"
    return { isLeftRight, isOwn: isLeftRight && isCurrentUser(owner) }
}
