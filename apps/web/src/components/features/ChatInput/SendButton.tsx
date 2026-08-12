import { Button } from "@components/ui/button"
import { SendHorizontalIcon, SendIcon } from "lucide-react"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"

type SendButtonProps = {
    onSend: () => void
    disabled?: boolean
    /** Send is held while attachments finish uploading — show a spinner. */
    loading?: boolean
}

/** Desktop: a full "Send" button (icon + label). Mobile: an icon-only button. */
const SendButton = ({ onSend, disabled, loading }: SendButtonProps) => {
    const isMobile = useIsMobile()
    return (
        <Button
            size={isMobile ? "lg" : "sm"}
            type="button"
            onClick={onSend}
            // Never steal focus from the editor: if the user is typing (keyboard
            // open), tapping Send keeps it open naturally — no programmatic
            // focus() needed, which couldn't tell whether the keyboard was open
            // and would pop it on file-only sends too.
            onMouseDown={(e) => e.preventDefault()}
            disabled={disabled}
            variant={isMobile ? "solid" : "subtle"}
            loading={loading}
            loadingText={isMobile ? undefined : _("Sending...")}
            isIconButton={isMobile}
            className={isMobile ? "rounded-full" : undefined}
            aria-label={_("Send message")}
        >
            {/* While loading the Button shows its own spinner; don't also render content. */}
            {!loading && (
                <>
                    {isMobile ? <SendHorizontalIcon /> : <SendIcon />}
                    {!isMobile && <span>{_("Send")}</span>}
                </>
            )}
        </Button>
    )
}

export default SendButton
