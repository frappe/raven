import { CalendarSyncIcon } from "lucide-react"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** Integrations → Scheduled Messages. TODO: list + schedule reminders. */
export const ScheduledMessages = () => (
    <PlaceholderPanel
        title={_("Scheduled Messages")}
        description={_("You can create a scheduled message & a bot will send it to you at the specified time.")}
        icon={CalendarSyncIcon}
        emptyTitle={_("Reminders")}
        emptyDescription={
            <>
                {_("Schedule messages to be sent to you at a specific date and time.")}
                <br />
                {_("These support the CRON syntax.")}
            </>
        }
    />
)

export default ScheduledMessages
