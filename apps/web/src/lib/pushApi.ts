/**
 * POST to a whitelisted raven.api.notification method (plain fetch — no hook
 * context here). Shared by the web push module (lib/push) and the native push
 * module (native/push); kept in its own file so neither import cycle nor the
 * Capacitor bridge drags into the other.
 */
export const callNotificationAPI = async (method: "subscribe" | "unsubscribe", body: Record<string, string | undefined>) => {
    const response = await fetch(`/api/method/raven.api.notification.${method}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
            "Content-Type": "application/json",
            ...(window.csrf_token ? { "X-Frappe-CSRF-Token": window.csrf_token } : {}),
        },
    })
    if (!response.ok) throw new Error(`Failed to ${method} push token (${response.status})`)
}
