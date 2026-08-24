import { UserAvatar } from "../UserAvatar"
import FileMessage from "@components/common/FileMessage/FileMessage"

interface FileItem {
    fileName: string
    fileType: string
    fileSize: string
    onDownload?: () => void
    onView?: () => void
    onShare?: () => void
}

interface FileMessageProps {
    user: {
        name: string
        full_name: string
        user_image: string
        type: "User" | "Bot"
    }
    files: FileItem | FileItem[]
    time: string
    message?: string
}

const FileMessageRenderer = ({ user, files, time, message }: FileMessageProps) => {
    const fileArray = Array.isArray(files) ? files : [files]

    const processedFiles = fileArray.map(file => ({
        ...file,
        onDownload: file.onDownload || (() => {
            console.log(`Downloading ${file.fileName}`)
            // Add your download logic here
        }),
        onView: file.onView || (() => {
            console.log(`Viewing ${file.fileName}`)
            // Add your view logic here
        }),
        onShare: file.onShare || (() => {
            console.log(`Sharing ${file.fileName}`)
            // Add your share logic here
        })
    }))

    return (
        <div className="flex items-start gap-3">
            <UserAvatar
                user={user}
                size="md"
            />

            <div className="flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="font-medium text-sm">{user?.full_name || user?.name || "User"}</span>
                    <span className="text-xs font-regular text-ink-gray-4/90">{time}</span>
                </div>

                {message && (
                    <div className="text-sm text-ink-gray-8 mb-2">{message}</div>
                )}

                <FileMessage
                    files={processedFiles}
                />
            </div>
        </div>
    )
}

export default FileMessageRenderer 