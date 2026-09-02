import { useFrappeGetCall, useFrappeEventListener } from "frappe-react-sdk"

/** Number of the session user's pending (Scheduled + Failed) rows — drives the sidebar badge. */
export const useScheduledMessagesCount = () => {
    const { data, mutate } = useFrappeGetCall<{ message: number }>(
        "raven.api.scheduled_message.get_scheduled_message_count",
        undefined,
        "scheduled-messages-count",
    )
    useFrappeEventListener("raven_scheduled_message_updated", () => mutate())
    return data?.message ?? 0
}
