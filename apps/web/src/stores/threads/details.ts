import { channelMembersStore, type MemberMeta } from "@stores/members/store"
import { threadMetaStore } from "@stores/threads/store"

/** get_thread_details, the threads side-car of a messages page, and create_thread all return this. */
export type ThreadDetails = { members: Record<string, MemberMeta>; message_count: number }

/**
 * Seed a thread's members and reply count. `epochAtStart` and `startedAt` are read before
 * the request went out, so a break or realtime patch during it wins over the count.
 */
export const applyThreadDetails = (threadID: string, details: ThreadDetails, epochAtStart: number, startedAt: number) => {
    channelMembersStore.setMembers(threadID, details.members ?? {})
    threadMetaStore.applyFetched(threadID, details.message_count, epochAtStart, startedAt)
}
