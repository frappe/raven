import { toast } from "sonner"
import { showDownloadToast } from "@components/common/DownloadToast"
import { nativePlatform } from "./platform"
import { ravenShell } from "./shell"
import { cancelDownload, downloadToCache } from "./download"

// Android goes through RavenShell.share: our own chooser, which excludes Raven and tracks no result.
const shareSheet = async (options: { title: string; uri: string }) => {
    if (nativePlatform() === "android") return (await ravenShell()).plugin.share(options)
    const { Share } = await import("@capacitor/share")
    await Share.share({ title: options.title, files: [options.uri] })
}

// Downloaded natively, then handed to the share sheet from the cache.
export const shareFileNative = async (absoluteUrl: string, fileName: string): Promise<"shared" | "cancelled" | "failed"> => {
    const id = crypto.randomUUID()
    const show = (percent?: number) => showDownloadToast(id, fileName, percent, () => { cancelDownload(id) })
    show()
    try {
        const uri = await downloadToCache(absoluteUrl, id, (fraction) => show(Math.round(fraction * 100)))
        toast.dismiss(id)
        await shareSheet({ title: fileName, uri })
        return "shared"
    } catch (e) {
        toast.dismiss(id)
        return /cancel/i.test(String((e as Error)?.message ?? e)) ? "cancelled" : "failed"
    }
}
