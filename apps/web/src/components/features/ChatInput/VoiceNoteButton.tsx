import { useSetAtom } from "jotai"
import { Mic } from "lucide-react"
import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { unlockAudioContext } from "@lib/audioContext"
import { voiceRecordingAtom } from "@utils/channelAtoms"
import _ from "@lib/translate"

export const VoiceNoteButton = ({ channelID, size = "sm", variant = "ghost" }: { channelID: string; size?: "sm" | "lg"; variant?: "ghost" | "solid" }) => {
    const setRecording = useSetAtom(voiceRecordingAtom(channelID))
    const button = (
        <Button
            variant={variant}
            size={size}
            isIconButton
            type="button"
            className={size === "lg" ? "rounded-full" : undefined}
            aria-label={_("Record voice note")}
            // Don't take focus: on mobile that would open the keyboard.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
                unlockAudioContext()
                setRecording(true)
            }}
        >
            <Mic />
        </Button>
    )
    if (size === "lg") return button
    return (
        <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>{_("Record voice note")}</TooltipContent>
        </Tooltip>
    )
}
