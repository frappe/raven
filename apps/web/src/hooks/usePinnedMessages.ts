import { useFrappeGetCall } from "frappe-react-sdk"
import { Message } from "@raven/types/common/Message"

export const usePinnedMessages = (channelID: string) => {
    const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: Message[] }>("raven.api.raven_message.get_pinned_messages", { 'channel_id': channelID }, `pins::${channelID}`, {
        revalidateOnFocus: false
    })

    return {
        pins: data?.message ?? [],
        error,
        isLoading,
        mutate
    }
}