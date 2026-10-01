import { useEffect, useRef, useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@components/ui/alert-dialog"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import { revokeTokens, signIn, tokenStore } from "./auth"
import { subscribeNativeKeyboard } from "./keyboard"
import { pendingNotice, pendingPath, pendingRelogin } from "./pending"
import { unsubscribeSitePush } from "./push"
import { completeSite, forgetSite, loadSites, normalizeSiteUrl, probeSite, saveSite, setDefaultSite, wipeSiteData, type ProbeResult, type Site } from "./sites"
import { versionAtLeast, versionMismatch } from "./version"
import logo from "@raven/public/raven_logo.svg"

type ProbeError = Exclude<ProbeResult, { site: Site }>["error"]
/** A failure the picker words itself; anything else shows the thrown message as is. */
class PickerError extends Error {
    constructor(readonly kind: ProbeError | "no-address") { super(kind) }
}

const appVersion = async () => (await import("@capacitor/app")).App.getInfo().then((i) => i.version).catch(() => "0")

/** Opens a saved site: silent when tokens exist, else the browser login. */
const open = async (site: Site) => {
    // A record without the site's client info is completed once, before it can open.
    if (!site.sitename || !site.clientId) {
        const result = await completeSite(site)
        if ("error" in result) throw new PickerError(result.error)
        site = result.site
    }
    if (!(await tokenStore.get(site.url))) await signIn(site.url, site.clientId)
    await saveSite(site)
    await setDefaultSite(site.url)
    const notice = await versionNotice(site)
    if (notice) await pendingNotice.set(JSON.stringify(notice))
    window.location.replace("/")
    // The page is leaving: never settle, so the picker stays busy until it does.
    return new Promise<void>(() => { })
}

/** What the app toasts once it is up; worded there, where it is shown. */
export type VersionNotice = { kind: "mismatch"; site: string; app: string } | { kind: "update" }

const versionNotice = async (site: Site): Promise<VersionNotice | null> => {
    if (versionMismatch(site.ravenVersion, __RAVEN_VERSION__)) return { kind: "mismatch", site: site.ravenVersion, app: __RAVEN_VERSION__ }
    if (site.minAppVersion && !versionAtLeast(await appVersion(), site.minAppVersion)) return { kind: "update" }
    return null
}

// The trash button's width. A row with a logo slides by this much, and the logo plus its padding is
// exactly that wide, so it tucks away at the row's left edge. A row without one gives up the width on
// its right instead: sliding would clip the name.
const REVEAL_PX = 48

/** One saved site. The trash hides behind the row until a swipe left slides the row aside. */
const SiteRow = ({ site, revealed, disabled, onReveal, onOpen, onRemove }: {
    site: Site; revealed: boolean; disabled: boolean
    onReveal: (revealed: boolean) => void; onOpen: () => void; onRemove: () => void
}) => {
    const card = useRef<HTMLDivElement>(null)
    // Only a favicon the site set for itself; Raven's own artwork is the app's logo already.
    const [logoFailed, setLogoFailed] = useState(false)
    const logoUrl = site.logo && !site.logo.startsWith("/assets/raven/") && !logoFailed ? new URL(site.logo, site.url).href : null
    // A drag writes --reveal on the card directly, so no touch move renders; letting go hands the result to state.
    const drag = useRef<{ x: number; y: number; horizontal: boolean | null; reveal: number } | null>(null)
    const rest = revealed ? 1 : 0

    const onTouchStart = (e: React.TouchEvent) => { drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, horizontal: null, reveal: rest } }
    const onTouchMove = (e: React.TouchEvent) => {
        const d = drag.current
        if (!d || !card.current) return
        const dx = e.touches[0].clientX - d.x, dy = e.touches[0].clientY - d.y
        // The first few pixels decide the axis, so a vertical scroll of the list never drags a row.
        if (d.horizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) d.horizontal = Math.abs(dx) > Math.abs(dy)
        if (!d.horizontal) return
        d.reveal = Math.min(1, Math.max(0, rest - dx / REVEAL_PX))
        // data-dragging turns the transitions off, so the row follows the finger exactly.
        card.current.dataset.dragging = ""
        card.current.style.setProperty("--reveal", String(d.reveal))
    }
    const onTouchEnd = () => {
        const d = drag.current
        drag.current = null
        if (!d?.horizontal || !card.current) return
        const open = d.reveal > 0.5
        delete card.current.dataset.dragging
        card.current.style.setProperty("--reveal", open ? "1" : "0")
        onReveal(open)
    }

    return (
        <li style={{ "--slot": `${REVEAL_PX}px` } as React.CSSProperties} className="relative shrink-0 overflow-hidden rounded-lg">
            <button type="button" aria-label={_("Remove site")} aria-hidden={!revealed} tabIndex={revealed ? 0 : -1} disabled={disabled} onClick={onRemove}
                className="absolute inset-y-0 right-0 flex w-[var(--slot)] items-center justify-end pe-1.5 text-ink-red-6">
                {/* Hard against the right edge: the gap to the slid card is the wider one, so the icon reads as apart from the row. */}
                <Trash2 className="size-5" />
            </button>
            <div ref={card} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
                // --reveal runs from 0 closed to 1 open; the slide reads it.
                style={{ "--reveal": rest } as React.CSSProperties}
                // A touch lights the whole row.
                className={cn("relative flex items-center rounded-lg bg-surface-gray-2 duration-200 ease-out has-[button:active]:bg-surface-gray-3 data-[dragging]:transition-none",
                    logoUrl ? "-translate-x-[calc(var(--reveal)*var(--slot))] transition-[translate]" : "me-[calc(var(--reveal)*var(--slot))] transition-[margin]")}>
                {/* A tap on a row that is slid aside puts it back; only a resting row opens its site. */}
                <button type="button" disabled={disabled} onClick={() => (revealed ? onReveal(false) : onOpen())}
                    className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-lg py-3 pe-3 text-left", logoUrl ? "ps-2" : "ps-3")}>
                    {logoUrl && <img src={logoUrl} alt="" className="size-10 shrink-0 rounded-md" onError={() => setLogoFailed(true)} />}
                    <span className="flex flex-1 flex-col gap-1 min-w-0">
                        <span className="text-base font-medium truncate">{site.name}</span>
                        <span className="text-sm text-ink-gray-6 truncate">{new URL(site.url).host}</span>
                    </span>
                </button>
            </div>
        </li>
    )
}

export const SitePicker = () => {
    const [sites, setSites] = useState<Site[]>([])
    const [url, setUrl] = useState("")
    const [busy, setBusy] = useState<string | null>(null)
    // Shown in a dialog: a kind the picker words itself, or a thrown message as is, and which action failed.
    const [error, setError] = useState<{ error: PickerError | string; adding: boolean } | null>(null)
    const [removing, setRemoving] = useState<Site | null>(null)
    // A share that arrived with no site open waits for one: the list says where a tap will send it.
    const [sharing, setSharing] = useState(false)
    // shareIn is imported here, not at the top: boot loads this file, and shareIn reaches into the app's modules.
    useEffect(() => {
        Promise.all([pendingPath.peek(), import("./shareIn")]).then(([path, m]) => setSharing(path === m.SHARE_TARGET_PATH)).catch(() => { })
    }, [])
    // One row shows its trash at a time.
    const [revealed, setRevealed] = useState<string | null>(null)
    // The page never resizes for the keyboard, so the column makes room for it itself.
    const [keyboard, setKeyboard] = useState(0)
    useEffect(() => subscribeNativeKeyboard((_open, height) => setKeyboard(height)), [])

    useEffect(() => {
        loadSites().then(async (list) => {
            setSites(list)
            // A dead session lands here with its site named; sign it in again without a tap.
            const url = await pendingRelogin.take()
            const site = url && list.find((s) => s.url === url)
            if (site) run(site.url, () => open(site))
        })
    }, [])

    const run = async (key: string, action: () => Promise<void>) => {
        setBusy(key)
        setError(null)
        try {
            await action()
        } catch (e) {
            setError({ error: e instanceof PickerError ? e : String((e as { message?: string })?.message ?? e), adding: key === "add" })
        } finally {
            setBusy(null)
        }
    }

    const addSite = () => run("add", async () => {
        const origin = normalizeSiteUrl(url)
        if (!origin) throw new PickerError("no-address")
        const result = await probeSite(origin)
        if ("error" in result) throw new PickerError(result.error)
        await open(result.site)
    })

    const remove = (site: Site) => run(site.url, async () => {
        setRemoving(null)
        setRevealed(null)
        // Everything local goes first and at once: a site that has stopped answering must not hold the picker.
        const tokens = await tokenStore.get(site.url)
        await tokenStore.remove(site.url)
        await forgetSite(site.url)
        await wipeSiteData(site.url)
        setSites(await loadSites())
        // The site's side runs on unawaited. The unsubscribe needs the bearer, so it goes before the revoke.
        if (tokens) void unsubscribeSitePush(site, tokens.accessToken).then(() => revokeTokens(site.url, tokens))
    })

    return (
        // The page itself never scrolls: one centred column, and only the sites list scrolls inside it.
        // With the keyboard up the column sits on the keyboard's top edge, so the button stays right above it.
        <main style={{ "--keyboard": `${keyboard}px` } as React.CSSProperties}
            className={cn("h-dvh overflow-hidden bg-surface-white text-ink-gray-9 flex flex-col gap-6 px-6 pt-[var(--inset-top)] max-w-md mx-auto w-full",
                keyboard ? "justify-end pb-[calc(var(--keyboard)+0.75rem)]" : "justify-center pb-[max(var(--inset-bottom),1.5rem)]")}>
            <img src={logo} alt="Raven" className="size-14 self-start" />
            {sites.length > 0 && (
                <section className="flex flex-col gap-2">
                    <p className="text-sm text-ink-gray-6">{sharing ? _("Share to") : _("Select a site")}</p>
                    {/* Capped at four and a half rows, the half hinting at more, so the form stays on screen and in reach.
                        19.5rem is the rest of the column with its bottom padding; the top inset and the keyboard come out too. */}
                    <ul className="flex flex-col gap-2 max-h-[min(20.5rem,calc(100dvh-var(--keyboard)-var(--inset-top)-19.5rem))] overflow-y-auto overscroll-contain scroll-fade">
                        {sites.map((site) => (
                            <SiteRow key={site.url} site={site} revealed={revealed === site.url} disabled={busy !== null}
                                onReveal={(on) => setRevealed(on ? site.url : null)}
                                onOpen={() => run(site.url, () => open(site))} onRemove={() => setRemoving(site)} />
                        ))}
                    </ul>
                    {/* The form below is a second way in, not part of the list. */}
                    <div className="flex items-center gap-2 pt-4 text-sm text-ink-gray-5">
                        <hr className="flex-1 border-outline-gray-2" /><span>{_("or")}</span><hr className="flex-1 border-outline-gray-2" />
                    </div>
                </section>
            )}
            <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); addSite() }}>
                <label htmlFor="site-url" className="text-sm text-ink-gray-6">{_("Site URL")}</label>
                {/* type="text": a type="url" input rejects a bare host; normalizeSiteUrl adds the scheme. */}
                <Input id="site-url" type="text" inputMode="url" inputSize="lg" placeholder="raven.frappe.cloud" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    value={url} onChange={(e) => setUrl(e.target.value)} />
                <Button type="submit" variant="solid" size="lg" loading={busy === "add"} loadingText={_("Connecting…")}>{_("Add site")}</Button>
            </form>
            <AlertDialog open={error !== null} onOpenChange={(o) => { if (!o) setError(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-semibold">{error?.adding ? _("Couldn't add site") : _("Couldn't open site")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {typeof error?.error === "string" && error.error}
                            {error?.error instanceof PickerError && error.error.kind === "no-address" && _("Enter a site address.")}
                            {error?.error instanceof PickerError && error.error.kind === "unreachable" && _("Could not reach this site.")}
                            {error?.error instanceof PickerError && error.error.kind === "not-raven" && _("This does not look like a Raven site.")}
                            {error?.error instanceof PickerError && error.error.kind === "site-too-old" && _("This site runs an older Raven. Ask its admin to update.")}
                            {error?.error instanceof PickerError && error.error.kind === "no-client" && _("This site has no OAuth client for the app. Ask its admin to set one up in Raven Settings.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{_("OK")}</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={removing !== null} onOpenChange={(o) => { if (!o) setRemoving(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-semibold">{_("Remove site?")}</AlertDialogTitle>
                        <AlertDialogDescription>{removing && _("Removing {0} site will log you out of it on this device.", [removing.name])}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{_("Cancel")}</AlertDialogCancel>
                        <Button type="button" variant="solid" theme="red" size="md" onClick={() => removing && remove(removing)}>{_("Remove")}</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    )
}
