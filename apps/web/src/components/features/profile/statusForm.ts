import dayjs, { type Dayjs } from "dayjs"
import type { UserData } from "@db"
import { durationEndsAt, getEffectiveStatus, type StatusDurationId } from "@lib/statusExpiry"

/**
 * The status fields both profile forms share. `availability_expires_at` is the stored end,
 * carried but never edited here. `clear_after: "at"` = end at `clear_after_at` (stored or picked).
 */
export type StatusFormValues = {
    availability_status: string
    availability_expires_at: string | null
    custom_status: string
    clear_after: StatusDurationId | "at"
    clear_after_at: string | null
}

/** Starting values, from the status with expired parts already cleared. */
export const getStatusFormValues = (user: UserData, nowServer: string): StatusFormValues => {
    const status = getEffectiveStatus(user, nowServer)
    return {
        availability_status: status.availability,
        availability_expires_at: status.availabilityEndsAt,
        custom_status: status.customStatus,
        clear_after: status.customStatusEndsAt ? "at" : "never",
        clear_after_at: status.customStatusEndsAt,
    }
}

/**
 * Each status goes out with its end time, so a form opened before the sweep can't revive
 * what it cleared. Availability changed here gets no end; the quick pickers set timed ones.
 */
export const getStatusPayload = (values: StatusFormValues, seededAvailability: string | undefined, now: Dayjs = dayjs()) => {
    const customEnd =
        values.clear_after === "at"
            ? values.clear_after_at
            : values.clear_after === "custom"
                ? null
                : durationEndsAt(values.clear_after, now)
    return {
        availability_status: values.availability_status,
        availability_expires_at: values.availability_status === seededAvailability ? values.availability_expires_at : null,
        custom_status: values.custom_status,
        custom_status_expires_at: values.custom_status.trim() ? customEnd : null,
    }
}
