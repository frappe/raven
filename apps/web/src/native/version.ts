// "3.1.0" >= "3.0.0"; missing segments count as 0; non-numeric segments as 0.
export const versionAtLeast = (version: string, minimum: string): boolean => {
    const parse = (v: string) => v.split(".").map((part) => parseInt(part, 10) || 0)
    const a = parse(version), b = parse(minimum)
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0)
        if (diff !== 0) return diff > 0
    }
    return true
}

/** "minor" when major or minor differ; patch differences and unknown versions are silent. */
export const versionMismatch = (siteVersion: string, appVersion: string): "minor" | null => {
    if (!siteVersion || !appVersion) return null
    const [sa, sb] = siteVersion.split("."), [aa, ab] = appVersion.split(".")
    return sa === aa && sb === ab ? null : "minor"
}
