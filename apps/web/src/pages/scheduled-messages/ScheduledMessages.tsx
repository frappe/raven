import { useState } from "react"
import { useSWRConfig } from "frappe-react-sdk"

import AppMobileFooter from "@components/features/header/AppMobileFooter"
import { PageHeader } from "@components/layout/PageHeader"
import ScheduledMessagesList, { SCHEDULED_MESSAGES_KEY } from "@components/features/schedule-send/ScheduledMessagesList"
import _ from "@lib/translate"

/**
 * Full-page scheduled-messages management — the PWA counterpart of the desktop
 * sidebar dialog (same list, same inline editing), reached from the profile page.
 * Being a real route gives it a history entry, so the OS back-swipe returns to
 * the profile like any other page. Rows never navigate; editing happens inline
 * on the card (the editor's own Escape handling cancels just the edit).
 */
const ScheduledMessages = () => {
    const [editingRowId, setEditingRowId] = useState<string | null>(null)

    // Prefix matcher: revalidates the list key AND the profile badge's count key
    // (`scheduled-messages-count`) in one go after the user's own mutations.
    const { mutate } = useSWRConfig()
    const refreshList = () => {
        mutate((key) => typeof key === "string" && key.startsWith(SCHEDULED_MESSAGES_KEY))
    }

    return (
        <div className="flex flex-col h-dvh overflow-hidden">
            <PageHeader title={_("Scheduled Messages")} />
            <div className="flex-1 min-h-0 px-1 pb-2">
                <ScheduledMessagesList
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
