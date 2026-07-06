import { FrappeConfig, FrappeContext, useFrappeGetCall, useSWRConfig } from 'frappe-react-sdk'
import { useCallback, useContext } from 'react'

export type UnreadThread = { name: string, workspace?: string, unread_count: number }
const useUnreadThreadsCount = () => {

    return useFrappeGetCall<{ message: UnreadThread[] }>('raven.api.threads.get_unread_threads', undefined, ["unread_thread_count"])

}

/**
 * Hook to fetch and update the unread thread count for a particular thread when a new message is sent.
 */
export const useUnreadThreadsCountEventListener = () => {

    const { call } = useContext(FrappeContext) as FrappeConfig

    const { mutate } = useSWRConfig()

    const onThreadReplyEvent = useCallback((threadID: string) => {
        // Whenever a thread reply event is received, we should call the get_unread_threads endpoint to get the unread thread count for the thread
        // This endpoint will only return the count for that thread
        mutate(["unread_thread_count"], async (data?: { message: UnreadThread[] }) => {

            return call.get<{ message: UnreadThread[] }>('raven.api.threads.get_unread_threads', {
                // workspace: workspaceID,
                thread_id: threadID
            }).then((res) => {
                // Update the unread thread count for the thread
                if (res.message.length > 0) {

                    const existingCounts = [...(data?.message ?? [])]

                    // If the threadID for which we fetched new unread counts is not present in the existing counts, then add it
                    // If it is present, then update the count
                    const isPresent = existingCounts.find((t) => t.name === threadID)

                    if (isPresent) {
                        return {
                            message: existingCounts.map((thread) => {
                                if (thread.name !== threadID) {
                                    return thread
                                }

                                // Update the count
                                return {
                                    ...thread,
                                    workspace: res.message[0].workspace,
                                    unread_count: res.message[0].unread_count
                                }
                            })
                        }
                    } else {
                        return {
                            message: [...existingCounts, {
                                name: threadID,
                                workspace: res.message[0].workspace,
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

        }, {
            revalidate: false
        })

    }, [])

    return onThreadReplyEvent

}

export default useUnreadThreadsCount