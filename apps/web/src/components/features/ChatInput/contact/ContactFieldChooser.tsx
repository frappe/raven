import { SheetRow } from "@components/features/schedule-send/ScheduleSendSheet"
import { DialogDescription, DialogTitle } from "@components/ui/dialog"
import { DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { ResponsiveDialog } from "@components/features/message/actions/dialogs/ResponsiveDialog"
import { useIsMobile } from "@hooks/use-mobile"
import _ from "@lib/translate"

type ContactFieldChooserProps = {
    onClose: () => void
    onChoose: (field: "phone" | "email") => void
}

/** Android asks which kind of detail to pick before opening the contact picker. */
export const ContactFieldChooser = ({ onClose, onChoose }: ContactFieldChooserProps) => {
    const isMobile = useIsMobile()
    const Title = isMobile ? DrawerTitle : DialogTitle
    const Description = isMobile ? DrawerDescription : DialogDescription

    return (
        <ResponsiveDialog open onClose={onClose} bodyClassName="gap-1 p-3 pb-6" dialogClassName="gap-1 sm:max-w-sm">
            <Title className="px-3 pb-1 pt-2 text-lg-medium">{_("Share contact")}</Title>
            <Description className="sr-only">{_("Choose what to share")}</Description>
            <SheetRow className="min-h-11" onClick={() => onChoose("phone")}>{_("Phone")}</SheetRow>
            <SheetRow className="min-h-11" onClick={() => onChoose("email")}>{_("Email")}</SheetRow>
        </ResponsiveDialog>
    )
}
