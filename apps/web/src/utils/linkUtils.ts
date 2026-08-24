// URL regex pattern to match various URL formats
const URL_REGEX = /(https?:\/\/[^\s]+)/g

export const extractUrlsFromText = (text: string): string[] => {
    const matches = text.match(URL_REGEX)
    return matches || []
}

export const isValidUrl = (url: string): boolean => {
    try {
        new URL(url)
        return true
    } catch {
        return false
    }
} 