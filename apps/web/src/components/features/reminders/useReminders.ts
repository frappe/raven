import { useFrappeEventListener, useFrappeGetCall, useSWRConfig } from "frappe-react-sdk"
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
    /** Plain text. For a poll this is the question and its options, one per line. */
    message_content?: string | null
    message_type?: BaseMessage["message_type"] | null
    message_owner?: string | null
    message_is_bot?: 0 | 1 | null
    message_bot?: string | null
    message_creation?: string | null
    message_file?: string | null
}

/** Explicit SWR keys so unread-changing actions and the realtime listener can
 *  revalidate the badge and the list directly. */
export const UNREAD_REMINDER_COUNT_KEY = "unread_reminder_count"
export const REMINDERS_LIST_KEY = "reminders_list"

/**
 * The one socket subscriber for `raven_reminders_updated`, mounted once in AppListeners.
 * The SDK's listener cleanup drops every handler for an event, not just its own, so a
 * second subscriber unmounting would silently kill the first. The event carries no
 * payload and is user-targeted: revalidate the badge and the list, wherever they are mounted.
 */
export const useRemindersRealtime = () => {
    const { mutate: globalMutate } = useSWRConfig()
    useFrappeEventListener("raven_reminders_updated", () => {
        globalMutate(UNREAD_REMINDER_COUNT_KEY)
        globalMutate(REMINDERS_LIST_KEY)
    })
}

/** Fired-but-unread count — the Later badge. Kept live by useRemindersRealtime. */
export const useUnreadReminderCount = (): number => {
    const { data } = useFrappeGetCall<{ message: number }>(
        "raven.api.reminders.get_unread_reminder_count",
        undefined,
        UNREAD_REMINDER_COUNT_KEY,
        { revalidateOnFocus: true },
    )
    return data?.message ?? 0
}

/** All of the user's reminders + message previews (30-day retention bounds size).
 *  Kept live by useRemindersRealtime. */
export const useRemindersList = () => {
    const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: ReminderRow[] }>(
        "raven.api.reminders.get_reminders",
        undefined,
        REMINDERS_LIST_KEY,
        { revalidateOnFocus: true },
    )
    return { reminders: data?.message ?? [], error, isLoading, mutate }
}
