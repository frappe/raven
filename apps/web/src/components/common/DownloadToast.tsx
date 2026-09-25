import { toast } from "sonner"
import _ from "@lib/translate"
import FileTypeIcon from "@components/common/FileIcons/FileTypeIcon"
import { getFileExtension } from "@lib/file"

/** One truncated line for a file transfer: icon, name, progress when known. */
export const DownloadToast = ({ name, percent }: { name: string; percent?: number }) => (
    <span className="flex min-w-0 items-center gap-2">
        <FileTypeIcon fileType={getFileExtension(name)} size="sm" />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {percent !== undefined && <span className="shrink-0 tabular-nums text-ink-gray-5">{percent}%</span>}
    </span>
)

/** Loading toast for a transfer: same id updates it, `toast.dismiss(id)` ends it. */
export const showDownloadToast = (id: string, name: string, percent?: number, onCancel?: () => void) =>
    toast.loading(<DownloadToast name={name} percent={percent} />, {
        id,
        // With a Cancel it is the only control, and its text edge lands on the toast's own padding line.
        ...(onCancel && { action: { label: _("Cancel"), onClick: onCancel }, closeButton: false, classNames: { actionButton: "!-mr-2" } }),
    })
