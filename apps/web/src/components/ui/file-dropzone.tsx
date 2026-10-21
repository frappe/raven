import _ from '@lib/translate'
import { Dispatch, SetStateAction, useCallback } from 'react'
import { Accept, useDropzone } from 'react-dropzone'
import { cn } from '@lib/utils'
import { Button } from './button'
import { Trash2Icon } from 'lucide-react'
import FileTypeIcon from '@components/common/FileIcons/FileTypeIcon'
import { formatBytes, getFileExtension } from '@raven/lib/utils/operations'

type Props = {
    files: File[],
    setFiles?: Dispatch<SetStateAction<File[]>>
    accept?: Accept,
    multiple?: boolean
    onDrop?: (acceptedFiles: File[]) => void,
    onUpdate?: VoidFunction
    className?: string
}

export const FileDropzone = ({ files, setFiles, accept, multiple = true, onDrop, className, onUpdate }: Props) => {

    const onFileDrop = useCallback((acceptedFiles: File[]) => {
        // Do something with the files
        if (multiple) {
            setFiles?.((prev) => [...prev, ...acceptedFiles])
        } else {
            setFiles?.(acceptedFiles)
        }
        onDrop?.(acceptedFiles)
        onUpdate?.()

    }, [setFiles, onDrop, multiple, onUpdate])
    const { getRootProps, getInputProps } = useDropzone({ onDrop: onFileDrop, accept, multiple })
    return (
        <div {...getRootProps()} className={cn('border border-outline-gray-2 border-dashed p-4 rounded bg-surface-gray-1 focus-within:bg-surface-gray-2 hover:bg-surface-gray-2 hover:border-outline-gray-3 focus-within:border-outline-gray-3 focus-within:outline-none', className)}>
            <input {...getInputProps()} />
            {files.length === 0 ? <p className='text-sm text-ink-gray-5 text-center h-8 flex items-center justify-center'>{multiple ? _("Drop some files here, or click to select files") : _("Drop a file here, or click to select a file")}</p> : null}
            <div className='flex flex-col gap-4'>
                {files.map(f => <div key={f.name} className='flex justify-between items-center'>
                    <div className='flex items-center gap-2'>
                        <FileTypeIcon fileType={getFileExtension(f.name)} size="lg" />
                        <div className='flex flex-col gap-0.5'>
                            <span className='text-ink-gray-7 text-sm'>{f.name}</span>
                            <span className='text-ink-gray-5 text-xs'>{formatBytes(f.size)}</span>
                        </div>
                    </div>
                    <Button type='button' variant='ghost' isIconButton
                        className='text-ink-gray-5 hover:text-ink-gray-8 hover:bg-transparent'
                        onClick={(e) => {
                            e.stopPropagation()
                            setFiles?.(files.filter(file => file.name !== f.name))
                            onUpdate?.()
                        }}>
                        <Trash2Icon />
                    </Button>
                </div>)}
            </div>
        </div>
    )
}