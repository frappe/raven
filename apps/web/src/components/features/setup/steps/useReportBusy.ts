import { useEffect } from "react"

/** Tells the page whether a save or upload is in flight, so Back can wait for it. */
export const useReportBusy = (busy: boolean, onBusyChange: (busy: boolean) => void) => {
    useEffect(() => {
        onBusyChange(busy)
    }, [busy]) // eslint-disable-line react-hooks/exhaustive-deps
}
