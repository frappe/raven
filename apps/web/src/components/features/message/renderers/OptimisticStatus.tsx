import { useContext } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"
import { CircleAlertIcon } from "lucide-react"
import type { Message } from "@raven/types/common/Message"
import { retrySend, discardSend } from "@stores/messages/messageSender"
import { isOptimistic } from "@stores/messages/types"
import _ from "@lib/translate"

/**
 * Row classes for an optimistic message: dim while sending, faint red wash with a
 * left accent when failed (Option A — the message itself is differentiated, no
 * alert box). The accent is an INSET box-shadow, not a border, so it doesn't take
 * up layout space — a real border-left would shove the content 2px right of every
 * other (non-failed) row under box-sizing: border-box.
 */
export const optimisticRowClass = (message: Message): string => {
    if (!isOptimistic(message)) return ""
    if (message._status === "failed") {
        return "bg-surface-red-1 hover:bg-surface-red-2 shadow-[inset_2px_0_0_0_var(--outline-red-4)] rounded-l-none"
    }
    return "opacity-50"
}

/**
 * The Left-Right variant of the row treatment: dim while sending, nothing when
 * failed. A red row wash doesn't work there — the bubble paints over it — so a
 * failed send shows as an icon beside the bubble (FailedSendIndicator) instead.
 */
export const sendingDimClass = (message: Message): string =>
    isOptimistic(message) && message._status !== "failed" ? "opacity-50" : ""

/** Red mark beside an own message whose send failed — like iMessage's error
 *  icon. Retry/Discard live in the OptimisticStatus footer below the message. */
export const FailedSendIndicator = ({ message }: { message: Message }) => {
    if (!isOptimistic(message) || message._status !== "failed") return null
    return (
        <CircleAlertIcon
            className="size-4 shrink-0 text-ink-red-6"
            aria-label={_("Failed to send")}
        />
    )
}

/** Quiet inline footer for a failed send: retry (re-sends the same batch) or discard. */
export const OptimisticStatus = ({ message }: { message: Message }) => {
    const { call } = useContext(FrappeContext) as FrappeConfig

    if (!isOptimistic(message) || message._status !== "failed") return null

    const channelID = message.channel_id
    const batchId = message.message_batch_id ?? ""

    return (
        <div className="flex items-center gap-3 pt-1.5 text-xs">
            <span className="inline-flex items-center gap-1 text-ink-red-6 font-medium">
                {/* <AlertTriangleIcon className="size-3.5" /> */}
                {_("Failed to send")}
            </span>
            <button
                type="button"
                className="font-medium text-ink-red-6 underline underline-offset-3 hover:text-ink-red-7"
                onClick={() => retrySend(call, channelID, batchId)}
            >
                {_("Retry")}
            </button>
            <button
                type="button"
                className="text-ink-gray-5 underline underline-offset-3 hover:text-ink-gray-7"
                onClick={() => discardSend(channelID, batchId)}
            >
                {_("Discard")}
            </button>
        </div>
    )
}
