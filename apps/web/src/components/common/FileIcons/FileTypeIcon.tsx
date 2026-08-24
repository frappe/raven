import { cn } from '@lib/utils'
import { CodeIcon, FileIcon, FileTextIcon, FilmIcon, FolderArchiveIcon, ImageIcon, MusicIcon, PresentationIcon } from 'lucide-react'

interface FileTypeIconProps {
    fileType: string
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
    className?: string
}

const FileTypeIcon = ({
    fileType,
    size = 'md',
    className,
}: FileTypeIconProps) => {

    const roundingClasses = {
        xs: 'rounded-1',
        sm: 'rounded-2',
        md: 'rounded-2',
        lg: 'rounded-3',
        xl: 'rounded-3',
        '2xl': 'rounded-4',
        '3xl': 'rounded-5',
        '4xl': 'rounded-xl'
    }


    const sizeClasses = {
        xs: 'h-4 w-4',
        sm: 'h-5 w-5',
        md: 'h-6 w-6',
        lg: 'h-7 w-7',
        xl: 'h-8 w-8',
        '2xl': 'h-10 w-10',
        '3xl': 'h-11.5 w-11.5',
        '4xl': 'h-20 w-20'
    }

    const iconSizeClasses = {
        xs: 'h-2.5 w-2.5',
        sm: 'h-3.5 w-3.5',
        md: 'h-4 w-4',
        lg: 'h-5 w-5',
        xl: 'h-5 w-5',
        '2xl': 'h-7 w-7',
        '3xl': 'h-8 w-8',
        '4xl': 'h-10 w-10'
    }
    // Special sizing for PowerPoint icon due to different viewBox
    const pptIconSizeClasses = {
        xs: 'h-2.5 w-2.5',
        sm: 'h-3 w-3',
        md: 'h-4 w-4',
        lg: 'h-4.5 w-4.5',
        xl: 'h-5 w-5',
        '2xl': 'h-7 w-7',
        '3xl': 'h-8 w-8',
        '4xl': 'h-10 w-10'
    }

    const containerClass = cn(sizeClasses[size], roundingClasses[size], className)

    const renderIcon = () => {
        switch (fileType.toLowerCase()) {
            case 'pdf':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" data-theme="light" className={"text-white"}>
                        <path d="M7 22.9c.1-.6.5-1 .9-1.4.5-.5 1.1-.8 1.8-1.2.7-.4 1.4-.7 2.1-1 .1 0 .2-.1.2-.2.6-1.2 1.2-2.4 1.7-3.6.3-.7.5-1.4.8-2.1v-.1c-.3-.7-.6-1.5-.7-2.3-.2-.8-.2-1.6-.1-2.4.1-.5.4-.9.8-1.3.1-.1.3-.1.5-.1h.8c.2 0 .4.1.5.3.3.2.5.5.7.8.2.4.2.8.3 1.2 0 1.2-.2 2.3-.4 3.4-.1.4-.2.7-.3 1.1v.1c.6 1.1 1.4 2.1 2.2 3 .1.1.1.1.3.1 1.1-.2 2.2-.2 3.2-.2.6 0 1.3.1 1.9.4.3.2.6.4.8.7.1.2.2.4.2.6v.7c0 .2-.1.4-.3.5-.2.2-.4.5-.8.5-.2 0-.5.1-.7.1-1.6.1-2.9-.4-4.2-1.3-.2-.2-.5-.4-.7-.6-.1 0-.1-.1-.2-.1-.6.1-1.2.2-1.8.4-.8.2-1.6.5-2.4.7-.1 0-.1.1-.2.1-.5.9-1.1 1.8-1.7 2.6-.5.6-1.1 1.2-1.7 1.7-.3.2-.7.4-1.1.5h-.8c-.2 0-.3 0-.5-.1-.5-.2-.9-.6-1-1.1-.1 0-.1-.2-.1-.4zm8.8-7c-.3.8-.7 1.6-1 2.4l2.4-.6c-.5-.6-1-1.3-1.4-1.8zm4.3 2.6c.6.4 1.3.7 2 .9.3.1.5 0 .7-.1.2-.1.3-.4.1-.5 0-.1-.1-.1-.2-.1-.2-.1-.5-.1-.8-.2-.6-.1-1.2-.1-1.8 0zm-9.4 2.8s-.1 0 0 0c-.6.3-1.2.7-1.7 1.1-.3.2-.5.5-.7.8v.2c.1.1.1.1.2.1.3-.2.5-.4.7-.5.6-.5 1-1.1 1.5-1.7zM15 11.2c.1 0 .1 0 0 0 .2-.6.3-1.2.3-1.7 0-.3 0-.6-.1-.9 0-.1-.1-.1-.2-.1s-.1.1-.2.1c-.2.3-.2.6-.2 1 0 .3 0 .5.1.8.2.2.2.5.3.8z" fill="currentColor" />
                    </svg>
                )
            case 'doc':
            case 'docx':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className={cn("text-white")}>
                        <path d="M26 11.4V8.8c0-.4-.3-.8-.8-.8h-7.3V6.2h-1.4c-.2 0-.3.1-.5.1-.7.1-1.4.3-2.1.4-.7.1-1.4.2-2 .4-.7.1-1.4.2-2.2.4-.8.1-1.5.2-2.2.3-.5.1-1 .2-1.4.2H6v15.9c.8.1 1.6.3 2.4.4.8.1 1.7.3 2.5.4.8.1 1.6.3 2.4.4.8.1 1.7.3 2.5.5.3.1.7.1 1 .1h.9V24c0-.1 0-.1.1-.1h7.3c.1 0 .3 0 .4-.1.2 0 .3-.1.3-.3 0-.2.1-.3.1-.5V11.4c.1.1.1.1.1 0zm-11 1.5l-.9 3.9c-.2.7-.3 1.4-.5 2.2 0 .1-.1.1-.1.1-.2.1-.4 0-.6 0h-.6c-.1 0-.1 0-.1-.1-.1-.6-.3-1.3-.4-1.9-.2-.8-.3-1.6-.5-2.4 0 .2-.1.4-.1.6l-.6 3c0 .2-.1.5-.1.7 0 .1 0 .1-.1.1-.4 0-.8-.1-1.2-.1-.1 0-.1 0-.1-.1-.3-1.6-.6-3.2-1-4.9-.1-.3-.1-.7-.2-1v-.1h1.2c.2 1.4.5 2.8.7 4.3 0-.2.1-.4.1-.6.3-1.2.5-2.5.8-3.7 0-.1 0-.1.1-.1h1c.2 0 .2 0 .3.2.3 1.4.6 2.8.9 4.3v.1c.1-.8.3-1.6.4-2.4.1-.7.3-1.5.4-2.2 0 0 0-.1.1-.1.4 0 .8 0 1.3-.1h.1c-.2 0-.3.2-.3.3zm10.3-4.1s0 .1 0 0v14.5h-7.5v-1.8h5.9v-.9H18c-.1 0-.1 0-.1-.1v-.9c0-.1 0-.1.1-.1h5.8v-.9h-5.9v-1.1h5.8v-.9h-5.9v-1h5.8c.1 0 .1 0 .1-.1v-.7c0-.1 0-.1-.1-.1H18c-.1 0-.1 0-.1-.1v-1h5.9v-.9h-5.7c-.1 0-.1 0-.1-.1v-.9c0-.1 0-.1.1-.1h5.7v-.9h-5.9v-1.2h5.8c.1 0 .1 0 .1-.1v-.7c0-.1 0-.1-.1-.1h-5.9V9c0-.1 0-.1.1-.1h7.3c.1-.2.1-.2.1-.1z" fill="currentColor" />
                    </svg>
                )
            case 'xls':
            case 'xlsx':
            case 'csv':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className={cn("text-white")}>
                        <path d="M26 9.3v13.6c0 .1-.1.2-.1.3-.2.3-.5.5-.8.5h-7.7v2c-.3-.1-.7-.1-1-.2-.7-.1-1.5-.3-2.2-.4-.8-.1-1.6-.3-2.4-.4-.8-.1-1.6-.3-2.4-.4-.7-.1-1.5-.3-2.2-.4-.4-.1-.7-.1-1.1-.2V9c.1 0 .3-.1.4-.1.7-.5 1.5-.7 2.3-.8.7-.1 1.4-.3 2-.4.6-.1 1.3-.2 1.9-.4.7-.1 1.5-.3 2.2-.4.8-.1 1.5-.3 2.3-.4h.1v1.9h7.8c.4 0 .8.3.9.7v.2zm-.8-.1h-7.9v1.2H20v1.7h-2.7v.6H20v1.7h-2.7v.6H20v1.7h-2.7v.7h2.8v1.7h-2.8v.6H20v1.7h-2.7v1.2h7.9V9.2zM14.7 20.7s0-.1-.1-.1c-.7-1.4-1.5-2.8-2.2-4.2v-.2c.7-1.4 1.4-2.7 2.2-4.1V12h-.1c-.2 0-.5 0-.7.1-.3 0-.6 0-1 .1-.1 0-.1 0-.1.1-.3.6-.5 1.1-.8 1.7-.2.5-.4.9-.6 1.4-.1-.2-.1-.5-.2-.7-.3-.7-.6-1.5-.9-2.2-.1-.2-.1-.2-.3-.2-.4 0-.8.1-1.2.1h-.4v.1c.1.2.2.5.3.7l1.5 3v.1c-.6 1.2-1.3 2.4-1.9 3.6 0 .1-.1.1-.1.2h.6c.4 0 .7.1 1.1.1.1 0 .1 0 .1-.1.3-.6.6-1.2.9-1.9.1-.3.3-.6.4-.9 0-.1 0-.2.1-.3v.1c.1.2.1.4.2.5.4.8.7 1.6 1.1 2.5.1.1.1.2.3.2.5 0 1 .1 1.5.1.1.3.2.3.3.3z" fill="currentColor" />
                        <path d="M23.9 10.4v1.7h-3.1v-1.7h3.1zm-3.1 11.2v-1.7h3.1v1.7h-3.1zm0-4.7v-1.7h3.1v1.7h-3.1zm3.1-4.1v1.7h-3.1v-1.7h3.1zm0 4.8v1.7h-3.1v-1.7h3.1z" fill="currentColor" />
                    </svg>
                )
            case 'ppt':
            case 'pptx':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 116.03" className={cn("text-white", pptIconSizeClasses[size])}>
                        <g>
                            <path d="M0.38,12.11L69.16,0.09L69.69,0v0.54v114.96v0.53l-0.53-0.09L0.38,104.63L0,104.57v-0.38V12.55v-0.38L0.38,12.11 L0.38,12.11z M76.29,17.01h43.79c0.77,0,1.47,0.32,1.98,0.82c0.51,0.51,0.82,1.21,0.82,1.98v76.75c0,0.78-0.32,1.5-0.84,2.01 s-1.23,0.84-2.01,0.84H76.29h-0.45v-0.45v-9.16v-0.45h0.45h33.62v-6.15H76.29h-0.45v-0.45v-7.17V75.1h0.45h33.62v-6.15H76.29h-0.45 v-0.45v-8.49v-0.88l0.71,0.51c1.32,0.94,2.79,1.68,4.36,2.18c1.52,0.48,3.14,0.74,4.82,0.74c4.38,0,8.34-1.78,11.21-4.64 c2.82-2.82,4.59-6.7,4.64-11H85.83h-0.45v-0.45V30.86c-1.56,0.03-3.06,0.29-4.47,0.74c-1.57,0.5-3.04,1.24-4.36,2.18l-0.71,0.51 v-0.88V17.46v-0.45H76.29L76.29,17.01z M99.26,32.75c-2.76-2.77-6.54-4.52-10.73-4.65v15.48h15.36 C103.79,39.35,102.04,35.53,99.26,32.75L99.26,32.75z M30.91,80.41V63.97v-0.45h0.45h6.22c2.41,0,4.56-0.35,6.45-1.05 c1.87-0.7,3.49-1.75,4.86-3.15c1.37-1.4,2.39-3.04,3.08-4.91c0.69-1.88,1.03-4,1.03-6.37c0-1.61-0.16-3.12-0.48-4.55 c-0.32-1.42-0.79-2.76-1.43-4.01c-0.63-1.25-1.4-2.36-2.29-3.32c-0.89-0.96-1.91-1.78-3.06-2.45c-2.31-1.35-4.97-2.03-7.98-2.03 H22.07v48.75H30.91L30.91,80.41z M37.76,55.2h-6.39h-0.45v-0.45V40.43v-0.45h0.45h6.51l0.01,0c0.95,0.01,1.81,0.21,2.57,0.59 c0.76,0.38,1.41,0.95,1.96,1.71h0c0.54,0.74,0.95,1.6,1.21,2.58c0.27,0.97,0.4,2.05,0.4,3.24c0,1.1-0.13,2.08-0.39,2.94h0 c-0.27,0.88-0.67,1.63-1.21,2.26c-0.54,0.63-1.21,1.11-2,1.43C39.65,55.05,38.76,55.2,37.76,55.2L37.76,55.2z" fill="currentColor" />
                        </g>
                    </svg>
                )
            case 'video':
            case 'mp4':
            case 'mov':
            case 'mkv':
            case 'avi':
            case 'webm':
                return (
                    <FilmIcon className={cn("text-white", iconSizeClasses[size])} />
                )
            case 'audio':
            case 'mp3':
            case 'wav':
            case 'ogg':
            case 'flac':
                return (
                    <MusicIcon className={cn("text-white", iconSizeClasses[size])} />
                )
            case 'image':
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'webp':
                return (
                    <ImageIcon className={cn("text-white", iconSizeClasses[size])} />
                )
            case 'zip':
            case 'rar':
            case '7z':
            case 'tar':
            case 'gz':
                return (
                    <FolderArchiveIcon className={cn("text-white", iconSizeClasses[size])} />
                )
            case 'key':
                return <PresentationIcon className={cn("text-white", iconSizeClasses[size])} />

            case 'txt':
            case 'md':
                return <FileTextIcon className={cn("text-white", iconSizeClasses[size])} />

            case 'py':
            case 'js':
            case 'ts':
            case 'jsx':
            case 'tsx':
            case 'json':
            case 'html':
            case 'css':
            case 'scss':
            case 'sass':
            case 'java':
            case 'c':
            case 'cpp':
            case 'c#':
            case 'c++':
            case 'php':
                return <CodeIcon className={cn("text-white", iconSizeClasses[size])} />

            default:
                return (
                    <FileIcon className={cn("text-white", iconSizeClasses[size])} />
                )
        }
    }

    const getBackgroundColor = () => {
        switch (fileType.toLowerCase()) {
            case 'pdf':
                return 'bg-red-500'
            case 'doc':
            case 'docx':
                return 'bg-[#1A5CBD]'
            case 'xls':
            case 'xlsx':
            case 'csv':
                return 'bg-green-700'
            case 'ppt':
            case 'pptx':
                return 'bg-[#ED6C47]'
            case 'video':
            case 'mp4':
            case 'mov':
            case 'mkv':
            case 'avi':
            case 'webm':
                return 'bg-purple-600'
            case 'audio':
            case 'mp3':
            case 'wav':
            case 'ogg':
            case 'flac':
                return 'bg-purple-600'
            case 'image':
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'webp':
            case 'key':
                return 'bg-blue-600'
            case 'zip':
            case 'rar':
            case '7z':
            case 'tar':
            case 'gz':
                return 'bg-yellow-600'
            default:
                return 'bg-gray-500'
        }
    }

    return (
        <div className={cn("flex items-center justify-center", getBackgroundColor(), containerClass)}>
            {renderIcon()}
        </div>
    )
}

export default FileTypeIcon 