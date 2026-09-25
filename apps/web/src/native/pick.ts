import { toast } from "sonner"
import _ from "@lib/translate"
import { readNativeFiles } from "./shareIn"

type Picked = { path?: string; name: string; mimeType: string }

/** iOS: a native picker in place of a file input, whose chooser menu WebKit cannot skip. Empty when cancelled. */
export const pickNativeFiles = async (kind: "files" | "photos"): Promise<File[]> => {
    const { FilePicker } = await import("@capawesome/capacitor-file-picker")
    // The plugin leaves its copy of every pick in the temp folder; each one is deleted once read.
    const copies: string[] = []
    // iOS may hand a HEIC photo over as is, and browsers on other devices cannot show one.
    const readable = async (f: Picked & { path: string }) => {
        copies.push(f.path)
        if (!/^image\/hei[cf]$/i.test(f.mimeType)) return { uri: f.path, name: f.name, type: f.mimeType }
        const jpeg = await FilePicker.convertHeicToJpeg({ path: f.path }).catch(() => null)
        if (!jpeg) return { uri: f.path, name: f.name, type: f.mimeType }
        copies.push(jpeg.path)
        return { uri: jpeg.path, name: f.name.replace(/\.[^.]+$/, ".jpg"), type: "image/jpeg" }
    }
    let picked: Awaited<ReturnType<typeof readable>>[]
    try {
        // skipTranscoding off asks iOS for formats other devices can show.
        const { files } = await (kind === "photos" ? FilePicker.pickMedia({ skipTranscoding: false }) : FilePicker.pickFiles())
        picked = await Promise.all(files.flatMap((f: Picked) => (f.path ? [readable({ ...f, path: f.path })] : [])))
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
