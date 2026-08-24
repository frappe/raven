import { FrappeConfig, FrappeContext, useFrappeGetCall, useSWRConfig } from 'frappe-react-sdk'
import { useCallback, useContext } from 'react'

export type UnreadThread = { name: string, unread_count: number }

// TODO: Deprecate this hook in favor of store
const useUnreadThreadsCount = (workspaceID?: string) => {
    return useFrappeGetCall<{ message: UnreadThread[] }>('raven.api.threads.get_unread_threads', {
        workspace: workspaceID
    }, ["unread_thread_count", workspaceID ?? ""])
}

/**
 * Hook to fetch and update the unread thread count for a particular thread when a new message is sent.
 */
export const useUnreadThreadsCountEventListener = (workspaceID?: string) => {
    const { call } = useContext(FrappeContext) as FrappeConfig
    const { mutate } = useSWRConfig()

    const onThreadReplyEvent = useCallback((threadID: string) => {
        mutate(["unread_thread_count", workspaceID ?? ""], async (data?: { message: UnreadThread[] }) => {
            return call.get<{ message: UnreadThread[] }>('raven.api.threads.get_unread_threads', {
                workspace: workspaceID,
                thread_id: threadID
            }).then((res) => {
                if (res.message.length > 0) {
                    const existingCounts = [...(data?.message ?? [])]
                    const isPresent = existingCounts.find((t) => t.name === threadID)

                    if (isPresent) {
                        return {
                            message: existingCounts.map((thread) => {
                                if (thread.name !== threadID) return thread
                                return { ...thread, unread_count: res.message[0].unread_count }
                            })
                        }
                    } else {
                        return {
                            message: [...existingCounts, {
                                name: threadID,
                                unread_count: res.message[0].unread_count
                            }]
                        }
                    }
                }
                return data
            }).catch((err) => {
                console.error(err)
                return data
            })
        }, { revalidate: false })
    }, [workspaceID, call, mutate])

    return onThreadReplyEvent
}

export default useUnreadThreadsCount
