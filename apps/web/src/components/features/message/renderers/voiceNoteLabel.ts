import _ from "@lib/translate"
import { parseVoiceJson } from "@lib/voiceNote"
import { formatTime } from "./AudioPlayer"

/** "Voice note · 0:12" from a Voice message's `json`; plain "Voice note" when it can't be read. */
export const voiceNoteLabel = (json: unknown): string => {
    const voice = parseVoiceJson(json)
    return voice ? _("Voice note · {0}", [formatTime(voice.duration)]) : _("Voice note")
}
