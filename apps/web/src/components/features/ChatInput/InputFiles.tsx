import { useAtomValue, useSetAtom } from 'jotai'
import { uploadingFilesAtom, uploadedFilesAtom, useAttachFile, useRemoveFile, FileItemType } from './useFileInput'
import { Button } from '@components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip'
import { AlertCircleIcon, Paperclip, Trash2Icon } from 'lucide-react'
import { useCallback, useMemo, useRef } from 'react'
import FileTypeIcon from '@components/common/FileIcons/FileTypeIcon'
import { formatBytes, getFileExtension } from '@raven/lib/utils/operations'
import { ProgressCircle } from '@components/ui/circular-progress'
import { attachmentPreviewAtom, stagedFilesToAttachments, getAttachmentKind } from '@utils/attachmentPreview'
import { useUserCookieData } from '@hooks/useUserCookieData'
import { cn } from '@lib/utils'
import _ from '@lib/translate'
import { useIsMobile } from '@hooks/use-mobile'

type InputFilesProps = {
    channelID: string
}

export const InputFileList = ({ channelID }: InputFilesProps) => {

    const uploadingFiles = useAtomValue(uploadingFilesAtom(channelID))
    const uploadedFiles = useAtomValue(uploadedFilesAtom(channelID))

    const files = useMemo(() => {

        const f: FileItemType[] = [...uploadingFiles]

        uploadedFiles.forEach(file => {
            f.push({
                ...file,
                status: 'uploaded' as const
            })
        })

        return f.sort((a, b) => a.timestamp - b.timestamp)
    }, [uploadingFiles, uploadedFiles])

    const onRemove = useRemoveFile(channelID)
    const setPreview = useSetAtom(attachmentPreviewAtom)
    const { name: currentUser } = useUserCookieData()

    // Open the shared attachment viewer on the clicked file. Only uploaded files have
    // a URL, so the navigable set is those (in display order, so the index matches).
    const onPreview = useCallback((file: FileItemType) => {
        const uploaded = files.filter((f): f is FileItemType & { fileURL: string } => f.status === 'uploaded' && !!f.fileURL)
        const attachments = stagedFilesToAttachments(uploaded, currentUser)
        const index = attachments.findIndex((a) => a.id === file.id)
        if (index === -1) return
        setPreview({ attachments, index, mode: "preview" })
    }, [files, currentUser, setPreview])

    // Nothing staged → render nothing (no empty padded strip inside the composer box).
    if (files.length === 0) return null

    return (
        <div className='flex gap-2 flex-wrap px-2 md:pt-2 pt-0 pb-2 md:pb-0'>
            {files.map((file) => (
                <FileItem key={file.id} file={file} onRemove={onRemove} onPreview={onPreview} />
            ))}
        </div>
    )
}

const FileItem = ({ file, onRemove, onPreview }: { file: FileItemType, onRemove: (file: FileItemType) => void, onPreview: (file: FileItemType) => void }) => {

    const extension = getFileExtension(file.fileName)

    const isMobile = useIsMobile()
    // Uploaded files can be opened in the viewer; uploading/errored can't.
    const canPreview = file.status === 'uploaded'
    // Show the real image for uploaded image files instead of a generic file icon.
    const showImageThumb = canPreview && !!file.fileURL && getAttachmentKind(file.fileURL) === 'image'

    const onRemoveClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        onRemove(file)
    }

    return <div
        className={cn("rounded-md border border-outline-gray-2 md:w-64 w-full", canPreview && "cursor-pointer hover:bg-surface-gray-1")}
        onClick={canPreview ? () => onPreview(file) : undefined}
        role={canPreview ? "button" : undefined}
        title={canPreview ? _("Click to preview") : undefined}
    >
        <div className="flex items-center gap-2 p-2">
            <div className="shrink-0">
                {showImageThumb ? (
                    <img src={file.fileURL} alt={file.fileName} className="size-7 rounded-3 object-contain bg-surface-gray-1 object-center" />
                ) : (
                    <FileTypeIcon fileType={extension} size={isMobile ? "xl" : "lg"} />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="md:text-xs-medium mb-0.5 text-sm-medium text-ink-gray-8 truncate">
                    {file.fileName}
                </h4>
                <p className="md:text-xs text-sm text-ink-gray-5">
                    {formatBytes(file.size)}
                </p>
            </div>
            {/* When the file is being uploaded, show a circular progress bar and when it's uploaded show the delete button */}
            <div className="flex items-center size-9 justify-center">
                {file.status === 'uploading' &&
                    <div className='flex items-center justify-center size-9'>
                        <ProgressCircle value={file.uploadProgress ?? 0} className='text-ink-green-6' />
                    </div>}
                {file.status === 'uploaded' && (
                    <Button
                        variant="ghost"
                        size={isMobile ? "lg" : "sm"}
                        isIconButton
                        onClick={onRemoveClick}
                        title={_("Remove file")}
                    >
                        <Trash2Icon />
                    </Button>
                )}
                {file.status === 'error' && (
                    <Button
                        variant="ghost"
                        size={isMobile ? "lg" : "sm"}
                        isIconButton
                        theme="red"
                        onClick={onRemoveClick}
                        title={_("Error uploading file. Remove and try again.")}
                    >
                        <AlertCircleIcon />
                    </Button>
                )}
            </div>
        </div>
    </div>
}

export const AddFileButton = ({ channelID, onAfterAttach }: { channelID: string; onAfterAttach?: () => void }) => {

    const fileInputRef = useRef<HTMLInputElement>(null)

    const onAddFile = useAttachFile(channelID)

    const onClick = () => {
        fileInputRef.current?.click()
    }

    return <>
        <input type="file" multiple
            ref={fileInputRef}
            onChange={(e) => {
                const files = e.target.files
                if (files) {
                    onAddFile(files)
                }
                // Reset so re-picking the same file fires onChange again.
                e.target.value = ''
                // The file dialog stole focus — hand it back to the composer.
                onAfterAttach?.()
            }} className='hidden' />
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" isIconButton onClick={onClick} type='button' aria-label={_("Attach file")}>
                    <Paperclip />
                </Button>
            </TooltipTrigger>
            <TooltipContent>{_("Attach file")}</TooltipContent>
        </Tooltip>
    </>
}