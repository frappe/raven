export const isChrome = () =>
    navigator.userAgent.toLowerCase().includes("chrome")

export const showNotification = (payload: any) => {
    // @ts-ignore
    const registration = window.frappePushNotification.serviceWorkerRegistration
    if (!registration) return

    const data = payload?.data ?? {}
    const notification = payload?.notification ?? {}


    const notificationTitle = data.title || notification.title
    const notificationOptions = {
        body: payload?.notification?.body || "",
    }
    if (data.image) {
        // @ts-ignore
        notificationOptions["icon"] = data.image
    }

    if (data.creation) {
        // @ts-ignore
        notificationOptions["timestamp"] = data.creation
    }
    let url = `${data.base_url}/raven/channel/${data.channel_id}`

    if (data.message_url) {
        url = data.message_url
    }

    if (isChrome()) {
        // @ts-ignore
        notificationOptions["data"] = {
            url: url,
        }
    } else {
        if (data.click_action) {
            // @ts-ignore
            notificationOptions["actions"] = [
                {
                    action: url,
                    title: "View",
                },
            ]
        }
    }

    registration.showNotification(notificationTitle, notificationOptions)
}
