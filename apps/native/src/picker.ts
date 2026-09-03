import { signIn } from "./auth"
import { loadSites, normalizeSiteUrl, removeSite, saveSite, setDefaultSite, validateSite, type Site } from "./sites"

let pickerRoot: HTMLElement | null = null

const TRASH_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`

// Just enough travel to tuck the avatar away.
const REVEAL_WIDTH = 48
let closeOpenRow: (() => void) | null = null

/** iOS-style swipe left on a row reveals the delete action; a tap opens the site. */
const attachSwipeToDelete = (row: HTMLElement, card: HTMLElement, onTap: () => void) => {
    let startX = 0, startY = 0, offset = 0, base = 0, horizontal: boolean | null = null
    const settle = (to: number) => {
        offset = to
        card.style.transition = "transform 0.2s ease"
        card.style.transform = `translateX(${to}px)`
    }
    const close = () => settle(0)
    card.addEventListener("touchstart", (e) => {
        startX = e.touches[0].clientX; startY = e.touches[0].clientY
        base = offset; horizontal = null
        if (closeOpenRow && closeOpenRow !== close) closeOpenRow()
    }, { passive: true })
    card.addEventListener("touchmove", (e) => {
        const dx = e.touches[0].clientX - startX
        const dy = e.touches[0].clientY - startY
        if (horizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) horizontal = Math.abs(dx) > Math.abs(dy)
        if (!horizontal) return
        offset = Math.min(0, Math.max(-REVEAL_WIDTH, base + dx))
        card.style.transition = "none"
        card.style.transform = `translateX(${offset}px)`
    }, { passive: true })
    card.addEventListener("touchend", () => {
        if (!horizontal) return
        if (offset < -REVEAL_WIDTH / 2) { settle(-REVEAL_WIDTH); closeOpenRow = close }
        else { close(); if (closeOpenRow === close) closeOpenRow = null }
    })
    card.addEventListener("click", () => {
        // A revealed row's tap just puts it back; only a resting row opens the site.
        if (offset !== 0 || horizontal) { close(); closeOpenRow = null; horizontal = null; return }
        onTap()
    })
}

export const showError = (message: string) => {
    const error = pickerRoot?.querySelector<HTMLElement>("#error")
    // The line keeps its height when empty so an error never shifts the layout.
    if (error) error.textContent = message
}

export const openSite = async (site: Site) => {
    if (!site.clientId || !site.logo) {
        // Sites saved before OAuth/logo support (or before the admin created the client) pick it up here.
        const info = await validateSite(site.url)
        if (info) {
            site = { ...site, name: info.name, clientId: info.clientId ?? site.clientId, logo: info.logo ?? site.logo }
            await saveSite(site)
        }
    }
    if (!site.clientId) {
        // Move the opened site to the front: the picker lists last-opened first.
        await saveSite(site)
        await setDefaultSite(site.url)
        window.location.href = `${site.url}/raven`
        return
    }
    // The system browser handles the OAuth dance; the WebView loads /raven on success.
    try {
        await signIn(site.url, site.clientId)
        // Only a completed sign-in reorders the list and sets the auto-open target.
        await saveSite(site)
        await setDefaultSite(site.url)
    } catch (e) {
        showError(`Sign-in failed: ${String((e as { message?: string })?.message ?? e)}`)
    }
}

export const renderPicker = async (root: HTMLElement) => {
    pickerRoot = root
    const sites = await loadSites()
    root.innerHTML = `
      <h1 class="wordmark">raven</h1>
      <section id="existing" hidden>
        <p class="label">Select an existing site</p>
        <ul id="sites"></ul>
        <div class="or"><hr /><span>or</span><hr /></div>
      </section>
      <form id="add">
        <label class="label" for="url">Site URL</label>
        <input id="url" type="url" placeholder="raven.frappe.cloud" autocapitalize="none" autocorrect="off" />
        <button type="submit" class="primary">Add Site</button>
      </form>
      <p id="error" role="alert"></p>`
    const existing = root.querySelector<HTMLElement>("#existing")!
    existing.hidden = sites.length === 0
    const list = root.querySelector<HTMLUListElement>("#sites")!
    for (const site of sites) {
        const li = document.createElement("li")
        const open = document.createElement("button"); open.className = "open"
        if (site.logo) {
            const avatar = document.createElement("img"); avatar.className = "avatar"
            avatar.src = site.url + site.logo; avatar.alt = ""
            open.appendChild(avatar)
        } else {
            const avatar = document.createElement("span"); avatar.className = "avatar"
            avatar.textContent = site.name.charAt(0).toUpperCase()
            open.appendChild(avatar)
        }
        const meta = document.createElement("span"); meta.className = "meta"
        const name = document.createElement("span"); name.className = "name"; name.textContent = site.name
        const url = document.createElement("span"); url.className = "url"; url.textContent = site.url
        meta.append(name, url)
        open.appendChild(meta)
        const trash = document.createElement("button"); trash.className = "trash"; trash.setAttribute("aria-label", "Remove site")
        trash.innerHTML = TRASH_ICON
        trash.addEventListener("click", async () => {
            // Surgical removal keeps the list's scroll position.
            await removeSite(site.url)
            li.remove()
            existing.hidden = list.children.length === 0
        })
        attachSwipeToDelete(li, open, () => openSite(site))
        li.append(trash, open)
        list.appendChild(li)
    }
    const form = root.querySelector<HTMLFormElement>("#add")!
    form.addEventListener("submit", async (e) => {
        e.preventDefault()
        showError("")
        const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
        button.disabled = true
        try {
            const url = normalizeSiteUrl(root.querySelector<HTMLInputElement>("#url")!.value)
            const info = url ? await validateSite(url) : null
            if (!url || !info) { showError("Could not reach a Raven site at that address."); return }
            // Keep the client id so opening this site can sign in via OAuth.
            const site = { url, name: info.name, clientId: info.clientId, logo: info.logo }
            await saveSite(site)
            await openSite(site)
        } finally {
            button.disabled = false
        }
    })
}
