import { useState } from "react"
import { X } from "lucide-react"
import logo from "@raven/public/raven_logo.svg"
import { Button } from "@components/ui/button"
import _ from "@lib/translate"
import { dismissApp, offersApp, openInApp } from "@utils/openInApp"

/** On a phone browser: offers to open this site's links in the Raven app from now on. Laid out like Safari's Smart App Banner. */
export const OpenInAppBar = () => {
    const [shown, setShown] = useState(offersApp)
    if (!shown) return null
    return (
        <div className="flex shrink-0 items-center gap-3 border-b border-outline-gray-1 bg-surface-white py-2.5 ps-3 pe-2">
            <img src={logo} alt="" className="size-10 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-ink-gray-9">{_("Raven Mobile")}</p>
                <p className="truncate text-sm text-ink-gray-6">{_("Open source chat for teams")}</p>
            </div>
            <Button size="md" onClick={() => { setShown(false); openInApp({ orStore: true }) }}>{_("Open")}</Button>
            <Button variant="ghost" size="md" isIconButton aria-label={_("Close")} onClick={() => { setShown(false); dismissApp() }}>
                <X />
            </Button>
        </div>
    )
}
