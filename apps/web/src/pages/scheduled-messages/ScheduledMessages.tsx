import { useState } from "react"
import { useSWRConfig } from "frappe-react-sdk"

import AppMobileFooter from "@components/features/header/AppMobileFooter"
import { ChannelFilter } from "@components/common/filters/ChannelFilter"
import { PageHeader } from "@components/layout/PageHeader"
import ScheduledMessagesList, { SCHEDULED_MESSAGES_KEY } from "@components/features/schedule-send/ScheduledMessagesList"
import { useChannelList } from "@stores/channels/useChannelList"
import { useUsers } from "@hooks/useUsers"
import _ from "@lib/translate"

/**
 * Full-page scheduled-messages management — the PWA counterpart of the desktop
 * sidebar dialog (same list, same inline editing), reached from the profile page.
 * Being a real route gives it a history entry, so the OS back-swipe returns to
 * the profile like any other page. Rows never navigate; editing happens inline
 * on the card (the editor's own Escape handling cancels just the edit).
 */
const ScheduledMessages = () => {
    const [channel, setChannel] = useState("*all")
    const [editingRowId, setEditingRowId] = useState<string | null>(null)

    const { channels, dmChannels } = useChannelList()
    const users = useUsers()

    // Same breadth as the dialog: a mutation can land in any per-channel key (and
    // the sidebar badge's count key shares the prefix), so revalidate them all.
    const { mutate } = useSWRConfig()
    const refreshList = () => {
        mutate((key) => typeof key === "string" && key.startsWith(SCHEDULED_MESSAGES_KEY))
    }

    return (
        <div className="flex flex-col h-dvh overflow-hidden">
            <PageHeader title={_("Scheduled Messages")} />
            <div className="px-3 py-2 shrink-0">
                <ChannelFilter
                    channels={channels}
                    dmChannels={dmChannels}
                    users={users}
                    value={channel}
                    onValueChange={setChannel}
                    allLabel={_("Any Channel")}
                    // w-fit: the filter sits in a plain block container here, and its
                    // flex wrapper would stretch full-row — pushing the inline clear
                    // button (absolute right) to the screen edge instead of the trigger.
                    className="w-fit shrink-0"
                    triggerClassName="w-50"
                />
            </div>
            <div className="flex-1 min-h-0 px-1 pb-2">
                <ScheduledMessagesList
                    channel={channel}
                    refresh={refreshList}
                    editingRowId={editingRowId}
                    onEditingChange={setEditingRowId}
                    onRowSaved={() => { refreshList(); setEditingRowId(null) }}
                />
            </div>
            <AppMobileFooter />
        </div>
    )
}

export default ScheduledMessages
