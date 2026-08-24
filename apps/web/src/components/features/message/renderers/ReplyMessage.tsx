import { useSetAtom } from "jotai"
import { messageTargetAtom, makeMessageTarget } from "@utils/channelAtoms"
import { RepliedMessagePreview, type RepliedMessageDetails } from "./RepliedMessagePreview"

export default function ReplyMessage({
    repliedMessage,
    channelID,
    linkedMessageID,
}: {
    repliedMessage: RepliedMessageDetails
    /** Channel the quoted message lives in (replies are always in-channel). */
    channelID: string
    /** Id of the original message — clicking the card jumps the stream to it. */
    linkedMessageID?: string | null
}) {
    const setMessageTarget = useSetAtom(messageTargetAtom(channelID))

    const jumpToOriginal = () => {
        // makeMessageTarget: a fresh intent object, so re-clicking the same reply re-jumps.
        if (linkedMessageID) setMessageTarget(makeMessageTarget(linkedMessageID))
    }

    return (
        <div className="py-0.5">
            <div
                className="border-l-2 cursor-pointer border-outline-gray-3 bg-surface-gray-1 pl-3 py-2"
                role="button"
                onClick={jumpToOriginal}
            >
                <RepliedMessagePreview details={repliedMessage} />
            </div>
        </div>
    )
}
