// PKCE primitives: random strings + S256 challenge, using the Web Crypto API
// (available in the WebView and Node 20; no extra dependencies).

export const base64Url = (buf: ArrayBuffer | Uint8Array): string => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    let binary = ""
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export const randomString = (bytes = 32): string => {
    const buf = new Uint8Array(bytes)
    crypto.getRandomValues(buf)
    return base64Url(buf)
}

export const codeChallengeS256 = async (verifier: string): Promise<string> => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
    return base64Url(digest)
}
