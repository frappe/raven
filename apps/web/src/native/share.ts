// Files above this size aren't staged through the base64 Cache round-trip.
const MAX_NATIVE_FILE_SHARE_BYTES = 50 * 1024 * 1024

// Fetch with the session cookie, stage in Cache, share the file URI.
export const shareFileNative = async (
    absoluteUrl: string,
    fileName: string
): Promise<'shared' | 'cancelled' | 'failed'> => {
    try {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([
            import('@capacitor/filesystem'),
            import('@capacitor/share'),
        ])
        const res = await fetch(absoluteUrl, { credentials: 'include' })
        if (!res.ok) return 'failed'
        const blob = await res.blob()
        if (blob.size > MAX_NATIVE_FILE_SHARE_BYTES) {
            await Share.share({ title: fileName, url: absoluteUrl })
            return 'shared'
        }
        // Cache path must stay flat; nested names would fail on iOS.
        const safeName = fileName.replace(/[/\\]/g, "_")
        const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve((reader.result as string).split(',')[1])
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
        const { uri } = await Filesystem.writeFile({ path: safeName, data, directory: Directory.Cache })
        await Share.share({ title: fileName, files: [uri] })
        return 'shared'
    } catch (e) {
        return /cancel/i.test(String((e as Error)?.message ?? e)) ? 'cancelled' : 'failed'
    }
}
