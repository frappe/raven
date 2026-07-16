import { useState, type DragEvent, type ReactNode } from "react"
import { Upload } from "lucide-react"
import { useAttachFile } from "./useFileInput"
import { focusComposer } from "./composerFocus"
import _ from "@lib/translate"

/** True when the drag carries files (not selected text / an in-app element). */
const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files")

/**
 * Makes the whole chat pane a drop target (Slack-style): drag files anywhere over
 * the channel and an overlay invites you to drop. The overlay renders on top while
 * dragging, so the drop lands on it — not the editor — which is why the editor's
 * FileHandler only needs to handle paste. Dropped files go through the same upload
 * path as the attach button (useAttachFile → size/type validation included).
 */
export const FileDropZone = ({ channelID, children, disabled = false }: { channelID: string; children: ReactNode; disabled?: boolean }) => {
    const onAddFile = useAttachFile(channelID)
    const [isDragging, setIsDragging] = useState(false)

    // IMPORTANT: keep this a single return. There used to be an early-return branch for
    // `disabled` that rendered `children` in a slightly different tree — React saw that as
    // a different element tree and REMOUNTED the whole chat pane every time `disabled`
    // flipped (which happens on every channel open, once membership loads). The remount
    // silently reset ChatStream's scroll and data state. So: one tree, and when disabled
    // the handlers below simply do nothing.
    return (
        <div
            className="relative flex min-h-0 flex-1 flex-col"
            onDragOver={(e) => {
                if (disabled || !isFileDrag(e)) return
                e.preventDefault() // required for the drop event to fire
                if (!isDragging) setIsDragging(true)
            }}
            onDragLeave={(e) => {
                // Hide only when the pointer truly leaves the pane — not while moving
                // between children. relatedTarget is null when the drag leaves the window.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false)
            }}
            onDrop={(e) => {
                if (disabled || !isFileDrag(e)) return
                e.preventDefault()
                setIsDragging(false)
                if (e.dataTransfer.files?.length) {
                    onAddFile(e.dataTransfer.files)
                    // The drag took focus off the editor — hand it back.
                    focusComposer(channelID)
                }
            }}
        >
            {children}
            {isDragging && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-0">
                    {/* pointer-events-none: the inner card must not become a drag target,
                        or moving over it would churn the enter/leave tracking. The wrapper
                        above captures the drop. */}
                    <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-outline-gray-2 bg-surface-base/60 backdrop-blur-xs">
                        <div className="flex size-12 items-center justify-center rounded-full bg-surface-gray-2 text-ink-gray-8">
                            <Upload className="size-6" />
                        </div>
                        <p className="text-sm font-medium text-ink-gray-9">{_("Drop files to upload")}</p>
                    </div>
                </div>
            )}
        </div>
    )
}
