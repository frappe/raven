import { toast } from "sonner"
import _ from "@lib/translate"
import { readNativeFiles } from "./shareIn"

type Picked = { path?: string; name: string; mimeType: string; size: number }

/** A picked file as the composer names it while it is read: a HEIC photo already carries its .jpg name. */
export type NamedPick = { name: string; size: number }

const isHeic = (mimeType: string) => /^image\/hei[cf]$/i.test(mimeType)
const jpegName = (name: string) => name.replace(/\.[^.]+$/, ".jpg")

// iOS reports a cancel just after the picker closes; waiting this long keeps a cancel from showing a row.
const CLOSE_GRACE_MS = 150

type PickProgress = {
    /** The picker closed and its files are still being copied over. */
    onClosed?: () => void
    /** The picks as soon as the picker hands them over, before the slow conversion and read. */
    onNamed?: (picks: NamedPick[]) => void
}

/** iOS: a native picker in place of a file input, whose chooser menu WebKit cannot skip. Empty when cancelled. */
export const pickNativeFiles = async (kind: "files" | "photos", { onClosed, onNamed }: PickProgress = {}): Promise<File[]> => {
    const { FilePicker } = await import("@capawesome/capacitor-file-picker")
    // Set once the plugin answers: a pick, a cancel or a failure no longer needs the "closed" row.
    let answered = false
    const dismissed = await FilePicker.addListener("pickerDismissed", () => {
        setTimeout(() => { if (!answered) onClosed?.() }, CLOSE_GRACE_MS)
    }).catch(() => null)
    // The plugin leaves its copy of every pick in the temp folder; each one is deleted once read.
    const copies: string[] = []
    // iOS may hand a HEIC photo over as is, and browsers on other devices cannot show one.
    const readable = async (f: Picked & { path: string }) => {
        copies.push(f.path)
        if (!isHeic(f.mimeType)) return { uri: f.path, name: f.name, type: f.mimeType }
        const jpeg = await FilePicker.convertHeicToJpeg({ path: f.path }).catch(() => null)
        if (!jpeg) return { uri: f.path, name: f.name, type: f.mimeType }
        copies.push(jpeg.path)
        return { uri: jpeg.path, name: jpegName(f.name), type: "image/jpeg" }
    }
    let picked: Awaited<ReturnType<typeof readable>>[]
    try {
        // skipTranscoding off asks iOS for formats other devices can show.
        const { files } = await (kind === "photos" ? FilePicker.pickMedia({ skipTranscoding: false }) : FilePicker.pickFiles())
            .finally(() => { answered = true; void dismissed?.remove() })
        const onDisk = (files as Picked[]).filter((f): f is Picked & { path: string } => Boolean(f.path))
        onNamed?.(onDisk.map((f) => ({ name: isHeic(f.mimeType) ? jpegName(f.name) : f.name, size: f.size })))
        picked = await Promise.all(onDisk.map(readable))
    } catch (e) {
        // The plugin fails a whole pick over one bad item; only its cancel is silent.
        if (!/cancel/i.test(String((e as Error | null)?.message))) toast.error(_("The selected files could not be attached."))
        return []
    }
    const files = await readNativeFiles(picked)
    const { Filesystem } = await import("@capacitor/filesystem")
    await Promise.all(copies.map((path) => Filesystem.deleteFile({ path }).catch(() => { })))
    // A file that cannot be read is dropped; say so, or the pick looks like it did nothing.
    if (!files.length && picked.length) toast.error(_("The selected files could not be attached."))
    else if (files.length < picked.length) toast.error(_("Some of the selected files could not be attached."))
    return files
}
