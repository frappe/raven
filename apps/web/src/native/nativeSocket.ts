import { socketDown, socketUp } from "./reachability"

type Handler = (...args: unknown[]) => void
type Handle = { remove: () => Promise<void> }

export type Target = { url: string; namespace: string; origin: string }

export type RavenSocketPlugin = {
    connect(options: Target & { token: string }): Promise<void>
    disconnect(): Promise<void>
    emit(options: { event: string; args: unknown[] }): Promise<void>
    setToken(options: { token: string }): Promise<void>
    addListener(name: string, handler: (payload: { event?: string; args?: unknown[]; message?: string }) => void): Promise<Handle>
}

// Wrapped in an object: resolving a promise with the proxy itself would call its `then`.
const defaultPlugin = async () => {
    const { registerPlugin } = await import("@capacitor/core")
    return { plugin: registerPlugin<RavenSocketPlugin>("RavenSocket") }
}

const dispatch = (handlers: Map<string, Set<Handler>>, event: string, args: unknown[]) => {
    handlers.get(event)?.forEach((handler) => handler(...args))
}

/**
 * The socket surface the app uses (on/off/emit/connected/connect and the manager's
 * reconnect event), backed by the native socket.io client.
 */
export class NativeSocket {
    connected = false
    private handlers = new Map<string, Set<Handler>>()
    private managerHandlers = new Map<string, Set<Handler>>()
    // The native clients drop emits before the namespace connects; socket.io buffers them.
    private queue: { event: string; args: unknown[] }[] = []
    // Registered once: Capacitor warns on every repeated registerPlugin call.
    private plugin: Promise<{ plugin: RavenSocketPlugin }>

    constructor(private target: Target, private token: () => string, plugin: () => Promise<{ plugin: RavenSocketPlugin }> = defaultPlugin) {
        this.plugin = plugin()
    }

    /** socket.io's `socket.io` manager; the app only listens for "reconnect" on it. */
    readonly io = {
        on: (event: string, handler: Handler) => { add(this.managerHandlers, event, handler); return this.io },
        off: (event: string, handler?: Handler) => { remove(this.managerHandlers, event, handler); return this.io },
    }

    async start() {
        const { plugin } = await this.plugin
        await plugin.addListener("connect", () => {
            socketUp()
            this.connected = true
            const queued = this.queue
            this.queue = []
            queued.forEach(({ event, args }) => plugin.emit({ event, args }).catch(() => { }))
            dispatch(this.handlers, "connect", [])
        })
        await plugin.addListener("disconnect", () => { socketDown(); this.connected = false; dispatch(this.handlers, "disconnect", []) })
        await plugin.addListener("connect_error", ({ message }) => dispatch(this.handlers, "connect_error", [message]))
        await plugin.addListener("reconnect", () => dispatch(this.managerHandlers, "reconnect", []))
        await plugin.addListener("event", ({ event, args }) => { if (event) dispatch(this.handlers, event, args ?? []) })
        await plugin.connect({ ...this.target, token: this.token() })
        // A site that never answers fires no disconnect; a first connect this slow gets the same check.
        setTimeout(() => { if (!this.connected) socketDown() }, 10_000)
        // A background drops the socket; on return, dial again at once rather than after the client's backoff.
        const { App } = await import("@capacitor/app")
        await App.addListener("appStateChange", ({ isActive }) => { if (isActive && !this.connected) this.connect() })
    }

    on(event: string, handler: Handler) { add(this.handlers, event, handler); return this }
    off(event: string, handler?: Handler) { remove(this.handlers, event, handler); return this }

    emit(event: string, ...args: unknown[]) {
        if (this.connected) this.plugin.then(({ plugin }) => plugin.emit({ event, args })).catch(() => { })
        else this.queue.push({ event, args })
        return this
    }

    connect() {
        this.plugin.then(({ plugin }) => plugin.connect({ ...this.target, token: this.token() })).catch(() => { })
        return this
    }

    disconnect() {
        this.plugin.then(({ plugin }) => plugin.disconnect()).catch(() => { })
        return this
    }

    // A socket the server rejected for a stale token only comes back with a fresh dial.
    setToken(token: string) {
        this.plugin
            .then(async ({ plugin }) => {
                await plugin.setToken({ token })
                if (!this.connected) await plugin.connect({ ...this.target, token })
            })
            .catch(() => { })
    }
}

const add = (map: Map<string, Set<Handler>>, event: string, handler: Handler) => {
    if (!map.has(event)) map.set(event, new Set())
    map.get(event)!.add(handler)
}

const remove = (map: Map<string, Set<Handler>>, event: string, handler?: Handler) => {
    if (handler) map.get(event)?.delete(handler)
    else map.delete(event)
}
