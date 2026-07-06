import { useSWRConfig } from 'frappe-react-sdk'
import { useEffect } from 'react'
import { UnreadThread } from './useUnreadThreadsCount'

/** Whenever a thread is opened/closed, this hook will reset it's unread count to 0 */
const useThreadPageActive = (threadID?: string) => {

    const { mutate } = useSWRConfig()

    /** Update the thread count to 0 when joining the thread + when the thread is closed */
    useEffect(() => {

        const updateThreadCountToZero = (threadID?: string) => {
            if (!threadID) return

            // We need to reset the count to 0 for the particular thread only when the thread changes - not the workspace
            mutate(["unread_thread_count"], (data?: { message: UnreadThread[] }) => {
                if (data && data.message) {

                    const unreadThreads = [...data.message]
                    // Check if the threadID is present in the array
                    const threadIndex = unreadThreads.findIndex((thread) => thread.name === threadID)
                    if (threadIndex !== -1) {
                        // Remove the thread from the array
                        unreadThreads.splice(threadIndex, 1)
                    }

                    return {
                        message: unreadThreads
                    }
                }

                return data
            }, {
                revalidate: false
            })
        }

        updateThreadCountToZero(threadID)

        return () => {
            updateThreadCountToZero(threadID)
        }

    }, [threadID])
}

export default useThreadPageActive