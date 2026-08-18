import { cn } from '@lib/utils'
import { ArrowDownToLineIcon, Download, Share2 } from 'lucide-react'
import FileTypeIcon from '../FileIcons/FileTypeIcon'
import { Button } from '@components/ui/button'
import _ from '@lib/translate'

export interface FileItem {
    fileName: string
    fileType: string
    fileSize?: string
    /** Raven Message the file belongs to — lets action delegation target it. */
    messageId?: string
    /** Clicking the pill opens the file (modal viewer or new tab — caller decides). */
    onOpen?: () => void
    onDownload?: () => void
    onShare?: () => void
}

interface FileMessageProps {
    files: FileItem | FileItem[]
    className?: string
}

const FileMessage = ({
    files,
    className
}: FileMessageProps) => {
    const fileArray = Array.isArray(files) ? files : [files]

    const renderFile = (file: FileItem) => (
        // The pill itself is the open affordance; the buttons stop propagation
        <div
            className={cn(
                "rounded-md border border-outline-gray-2 w-fit bg-surface-elevation-1 p-2",
                file.onOpen && "cursor-pointer hover:bg-surface-gray-1 transition-colors w-64",
            )}
            role={file.onOpen ? "button" : undefined}
            onClick={file.onOpen}
        >
            <div className="flex items-center gap-2">
                <div className="shrink-0">
                    <FileTypeIcon fileType={file.fileType} size="lg" />
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="text-sm leading-snug text-ink-gray-8 truncate" title={file.fileName}>
                        {file.fileName}
                    </h4>
                    {file.fileSize && (
                        <p className="text-xs text-ink-gray-4">
                            {file.fileSize}
                        </p>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center ps-1">

                    {file.onDownload && (
                        <Button
                            variant="ghost"
                            size="sm"
                            isIconButton
                            onClick={(event) => {
                                event.stopPropagation()
                                file.onDownload?.()
                            }}
                            title={_('Download')}
                            aria-label={_('Download')}
                        >
                            <ArrowDownToLineIcon />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )

    return (
        // data-media-root: hard-edged media gets extra top spacing under a
        // sender header (see MessageSenderLayout) — inert everywhere else
        <div data-media-root="" className={cn(
            // Single file: one comfortable pill. Multiple: responsive pill grid.
            "flex flex-wrap gap-2",
            // fileArray.length === 1 ? "grid grid-cols-1 max-w-sm gap-2" : "w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2",
            className
        )}>
            {fileArray.map((file, index) => (
                <div key={file.messageId ?? index} data-message-id={file.messageId}>
                    {renderFile(file)}
                </div>
            ))}
        </div>
    )
}

export default FileMessage
