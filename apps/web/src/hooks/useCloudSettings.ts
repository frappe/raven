import { closeCloudSettings, isCloudSettingsAvailable, openCloudSettings } from '@frappe-dev/cloud-sdk'
import { useEffect, useState } from 'react'

export const useCloudSettings = () => {
    const [available, setAvailable] = useState(false)
    const [opening, setOpening] = useState(false)

    useEffect(() => {
        let active = true
        const discover = () => isCloudSettingsAvailable().then(
            (value) => { if (active) setAvailable(value) },
            () => { if (active) setAvailable(false) },
        )
        discover()
        window.addEventListener('focus', discover)
        return () => {
            active = false
            window.removeEventListener('focus', discover)
            closeCloudSettings()
        }
    }, [])

    const open = async () => {
        if (opening) return
        setOpening(true)
        try {
            await openCloudSettings({ panels: ['billing', 'domains', 'advanced'], tab: 'billing' })
        } finally {
            setOpening(false)
        }
    }

    return { available, opening, open }
}
