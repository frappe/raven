import { useSetAtom } from "jotai"
import { Mic } from "lucide-react"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { unlockAudioContext } from "@lib/audioContext"
import { voiceRecordingAtom } from "@utils/channelAtoms"
import _ from "@lib/translate"

export const VoiceNoteButton = ({ channelID }: { channelID: string }) => {
    const setRecording = useSetAtom(voiceRecordingAtom(channelID))
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    isIconButton
                    type="button"
                    aria-label={_("Record voice note")}
                    onClick={() => {
                        unlockAudioContext()
                        setRecording(true)
                    }}
                >
                    <Mic />
                </Button>
            </TooltipTrigger>
            <TooltipContent>{_("Record voice note")}</TooltipContent>
        </Tooltip>
    )
}
