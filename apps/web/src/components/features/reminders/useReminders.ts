import { useFrappeEventListener, useFrappeGetCall } from "frappe-react-sdk"
import type { BaseMessage } from "@raven/types/common/Message"

/** Row shape returned by raven.api.reminders.get_reminders (reminder + message preview). */
export type ReminderRow = {
    name: string
    message: string
    channel_id: string
    /** Naive server-timezone datetime (YYYY-MM-DD HH:mm:ss). */
    remind_at: string
    description?: string | null
    notified: 0 | 1
    is_read: 0 | 1
    /** Message preview fields (LEFT JOIN) — null if the message vanished mid-delete. */
    message_text?: string | null
    message_type?: BaseMessage["message_type"] | null
    message_owner?: string | null
    message_creation?: string | null
    message_file?: string | null
}

/** Explicit SWR key so actions that change unread state (open-completes,
 *  delete, snooze) can revalidate the badge directly via globalMutate —
 *  the realtime ping alone must not be the only refresh path. */
export const UNREAD_REMINDER_COUNT_KEY = "unread_reminder_count"

/** Fired-but-unread count — the Later badge. `raven_reminders_updated` is a
 *  payload-less user-targeted signal: revalidate on every ping. */
export const useUnreadReminderCount = (): number => {
    const { data, mutate } = useFrappeGetCall<{ message: number }>(
        "raven.api.reminders.get_unread_reminder_count",
        undefined,
        UNREAD_REMINDER_COUNT_KEY,
        { revalidateOnFocus: true },
    )
    useFrappeEventListener("raven_reminders_updated", () => mutate())
    return data?.message ?? 0
}

/** All of the user's reminders + message previews (30-day retention bounds size). */
export const useRemindersList = () => {
    const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: ReminderRow[] }>(
        "raven.api.reminders.get_reminders",
        undefined,
        undefined,
        { revalidateOnFocus: true },
    )
    useFrappeEventListener("raven_reminders_updated", () => mutate())
    return { reminders: data?.message ?? [], error, isLoading, mutate }
}
