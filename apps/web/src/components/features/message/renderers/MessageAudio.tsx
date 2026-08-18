import { AudioLinesIcon, Music, Pause, Play } from "lucide-react"
import { Slider } from "@components/ui/slider"
import { getFileName } from "@raven/lib/utils/operations"
import { useAudioPlayer, formatTime } from "./AudioPlayer"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"

type FileLikeMessage = Message & { file?: string }

/**
 * Inline audio as an "album" card: a square cover on top (a Music icon until a
 * cover thumbnail is extracted at upload), with a PERSISTENT player footer —
 * filename + play/pause + seek + time always visible, so it reads as audio at
 * rest (a hover-only treatment looked like a plain image) and works on touch.
 * Fixed shape, so the row height is known up front (the scroll engine needs it).
 */
export const MessageAudio = ({ messages }: { messages: Message[] }) => (
    <div className="space-y-1">
        {(messages as FileLikeMessage[]).map((message, index) => (
            <AudioCard key={`${message.file || message.name}:${index}`} message={message} />
        ))}
    </div>
)

const AudioCard = ({ message }: { message: FileLikeMessage }) => {
    const { audioProps, playing, currentTime, duration, toggle, seek } = useAudioPlayer()

    return (
        <Tooltip>
            <TooltipTrigger asChild>

                {/* role=button, not <button>: the seek Slider is interactive and
                    can't be nested inside a real <button> (invalid HTML). */}
                <div
                    data-message-id={message.name}
                    data-media-root=""
                    role="button"
                    tabIndex={0}
                    aria-label={playing ? _("Pause") : _("Play")}
                    aria-pressed={playing}
                    onClick={() => toggle()}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            toggle()
                        }
                    }}
                    className="w-full max-w-72 group/audio h-16 flex cursor-pointer items-center gap-1 overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-base outline-none focus-visible:focus-ring"
                >
                    <audio src={message.file} {...audioProps} />

                    {/* Square cover — Music icon until a real cover thumbnail exists */}
                    <div className="flex aspect-square size-16 max-w-16 w-full items-center justify-center bg-surface-gray-2 text-ink-gray-4">
                        {playing ? <AudioLinesIcon className="size-6 group-hover/audio:hidden animate-pulse" /> : <Music className="size-6 group-hover/audio:hidden" />}
                        {playing ? <Pause className="size-6 group-hover/audio:block hidden" /> : <Play className="size-6 group-hover/audio:block hidden" />}
                    </div>

                    {/* Persistent player footer */}
                    <div className="flex flex-col gap-3 p-2 w-full items-start">
                        <span className="truncate text-sm font-medium text-ink-gray-8">
                            {getFileName(message.file ?? "")}
                        </span>
                        {/* Stop click + keydown so seeking doesn't toggle play */}
                        <div
                            className="flex w-full items-center gap-2"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                        >
                            <Slider
                                value={[currentTime]}
                                min={0}
                                max={duration || 1}
                                step={1}
                                onValueChange={(values) => seek(values[0])}
                                aria-label={_("Seek")}
                                className="flex-1"
                            />
                            <span className="shrink-0 text-2xs tabular-nums text-ink-gray-5">{formatTime(currentTime)}</span>
                        </div>
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent>
                {playing ? _("Click to pause") : _("Click to play")}
            </TooltipContent>
        </Tooltip>
    )
}
