import { useAtomValue } from "jotai"
import { formatStatusUntil } from "@lib/statusExpiry"
import { fromServerDatetime } from "@lib/timeUtils"
import { timeFormatAtom } from "@utils/preferences"

/** A status end time as "Until 3:30 PM" / "Until Fri" / "Until 3 Dec", in the viewer's time format. */
export const useStatusUntilLabel = (endsAt: string | null | undefined): string | null => {
    const timeFormat = useAtomValue(timeFormatAtom)
    return endsAt ? formatStatusUntil(fromServerDatetime(endsAt), timeFormat) : null
}

export const StatusUntil = ({ endsAt, className }: { endsAt: string | null | undefined; className?: string }) => {
    const label = useStatusUntilLabel(endsAt)
    return label && <span className={className}>{label}</span>
}
