import { useRef, useState } from "react"
import { useFrappePostCall, useFrappeDeleteDoc } from "frappe-react-sdk"
import { useHotkeys } from "react-hotkeys-hook"
import { useAtom } from "jotai"
import { toast } from "sonner"
import { Button } from "@components/ui/button"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@components/ui/alert-dialog"
import ChatInput from "@components/features/ChatInput/ChatInput"
import { FileDropZone } from "@components/features/ChatInput/FileDropZone"
import { useComposerGate, ComposerArea } from "@components/features/ChatInput/composerGate"
import ChatStream from "@components/features/message/ChatStream"
import { ThreadHeader } from "./ThreadHeader"
import { ThreadRootMessage } from "./ThreadRootMessage"
import { PollDrawer } from "./renderers/PollDrawer"
import { useChannelById } from "@stores/channels/useChannelList"
import { useChannelMembers } from "@hooks/useChannelMembers"
import { useUserCookieData } from "@hooks/useUserCookieData"
import { unreadThreadsStore } from "@stores/threads/unreadStore"
import { threadListStore } from "@stores/threads/listStore"
import { pollDrawerAtom } from "@utils/channelAtoms"
import { getErrorMessage } from "@lib/frappe"
import _ from "@lib/translate"

/**
 * The thread view: header + root message + replies stream + composer. Router-agnostic —
 * `threadID`, `parentChannelID`, and `onClose` are PROPS, supplied by ThreadDrawerRoute (the
 * channel/DM/threads-page route glue) or by any other host (notifications, a modal, …).
 *
 * A thread IS a channel (its id = the original message id), so the stream + composer target the
 * threadID. `parentChannelID` is the channel the thread lives in — used only to inherit DM
 * status for the composer's mention banner, to seed the root-message lookup, and to refocus the
 * parent composer on close (handled by the host's onClose). It may be absent (e.g. a cold
 * threads-page deep-link), in which case those degrade gracefully.
 */
export default function ThreadDrawer({
    threadID,
    parentChannelID,
    onClose,
}: {
    threadID: string
    parentChannelID?: string
    onClose: () => void
}) {
    const parentIsDM = useChannelById(parentChannelID ?? "")?.is_direct_message === 1
    const threadInputRef = useRef<HTMLFormElement>(null)

    // Gate the actions by your membership in the thread (already in the members store, seeded by
    // the pill / get_thread_details). Only members can leave; only thread admins can delete.
    const { name: currentUser } = useUserCookieData()
    const { members } = useChannelMembers(threadID ?? "")
    const me = members.find((m) => m.name === currentUser)
    const isMember = !!me
    const isAdmin = me?.is_admin === 1

    // Same composer gate as channels — a non-participant sees the not-member banner + Join.
    const composerGate = useComposerGate(threadID ?? "")

    // A poll inside the thread opens its detail drawer keyed by the THREAD's id — the thread
    // occupies the only rail slot, so we host the drawer here (overlaying the thread), mirroring
    // ChatContentView for the channel. Closing it returns to the thread.
    const [threadPoll, setThreadPoll] = useAtom(pollDrawerAtom(threadID ?? ""))

    // A thread IS a channel, so leave/delete reuse the channel APIs on the threadID; both close
    // the thread on success. Threads aren't in the channel_list SWR cache, so (unlike channel
    // leave/delete) there's nothing to patch there — we drop the thread from the unread-threads
    // badge (no more participant-scoped events) and from the threads-list windows so it doesn't
    // linger in the list. (On leave it may reappear under "Other" on that tab's next refetch.)
    const { call: leaveThread, loading: leaving } = useFrappePostCall("raven.api.raven_channel.leave_channel")
    const onLeaveThread = () => {
        if (!threadID) return
        leaveThread({ channel_id: threadID })
            .then(() => {
                unreadThreadsStore.remove(threadID)
                threadListStore.removeEverywhere(threadID)
                toast.success(_("You left the thread"))
                onClose()
            })
            .catch((e) => toast.error(_("Could not leave the thread"), { description: getErrorMessage(e) }))
    }

    const { deleteDoc, loading: deleting } = useFrappeDeleteDoc()
    const [confirmDelete, setConfirmDelete] = useState(false)
    const onDeleteThread = () => {
        if (!threadID) return
        // Backend permission-gates this to the thread's owner/admins; non-owners get a toast.
        deleteDoc("Raven Channel", threadID)
            .then(() => {
                unreadThreadsStore.remove(threadID)
                threadListStore.removeEverywhere(threadID)
                toast.success(_("Thread deleted"))
                onClose()
            })
            .catch((e) => toast.error(_("Could not delete the thread"), { description: getErrorMessage(e) }))
    }

    // Esc closes the thread's poll drawer first, then the thread. enableOnContentEditable because
    // the composer (ProseMirror) is a contentEditable, not a form tag. Disabled while the
    // delete-confirm dialog is open — it owns Esc (Radix), so one press doesn't close both.
    useHotkeys(
        "esc",
        () => {
            if (threadPoll) setThreadPoll(null)
            else onClose()
        },
        { enableOnFormTags: true, enableOnContentEditable: true, enabled: !confirmDelete },
    )

    // A poll in this thread takes over the rail (its detail drawer overlays the thread).
    if (threadPoll) {
        return (
            <div className="flex flex-col h-full">
                <PollDrawer
                    user={threadPoll.user}
                    poll={threadPoll.poll}
                    currentUserVotes={threadPoll.currentUserVotes}
                    onClose={() => setThreadPoll(null)}
                />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full w-full">
            {/* Whole-thread drop target (mirrors the channel pane); disabled when you can't post,
                so a drop can't stage files there's no composer to send them from. */}
            <FileDropZone channelID={threadID ?? ""} disabled={composerGate.state !== "composer"}>
                <ThreadHeader
                    onClose={onClose}
                    onLeave={onLeaveThread}
                    onRequestDelete={() => setConfirmDelete(true)}
                    leaving={leaving}
                    canLeave={isMember}
                    canDelete={isAdmin}
                />

                {/* Root message — what this thread is about (collapsed preview above the replies).
                    Keyed by thread so its expand state resets when you switch threads. */}
                <ThreadRootMessage key={threadID} threadID={threadID ?? ""} parentID={parentChannelID} />

                {/* Thread messages — ChatStream owns its own scroll/virtualization */}
                {threadID && <ChatStream channelID={threadID} />}

                {/* Message input — posts into the thread channel (or skeleton / not-member banner) */}
                <div className="shrink-0">
                    <ComposerArea gate={composerGate} isThread>
                        {threadID && <ChatInput channelID={threadID} ref={threadInputRef} isDirectMessage={parentIsDM} parentChannelID={parentChannelID} />}
                    </ComposerArea>
                </div>
            </FileDropZone>

            {/* Deleting a thread removes it and its replies for everyone — confirm first.
                Controlled (not a trigger) because the dropdown unmounts its items on close. */}
            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{_("Delete this thread?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {_("The thread and all its replies will be permanently deleted for everyone. This can't be undone.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>{_("Cancel")}</AlertDialogCancel>
                        <Button type="button" variant="solid" theme="red" size="md" loading={deleting} loadingText={_("Deleting…")} onClick={onDeleteThread}>
                            {_("Delete thread")}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
