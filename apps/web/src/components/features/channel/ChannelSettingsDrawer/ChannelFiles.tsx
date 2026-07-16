import { UserAvatar } from '@components/features/message/UserAvatar'
import { ArrowDownToLine, LayoutGridIcon, ListIcon, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSetAtom } from 'jotai'
import FileTypeIcon from '@components/common/FileIcons/FileTypeIcon'
import { useSqliteSearch, type SearchResult } from '@hooks/useSqliteSearch'
import { useChannelMembers, type ChannelMemberData } from '@hooks/useChannelMembers'
import { formatRelativeDate } from '@lib/date'
import { formatFileSize } from '@utils/fileUtils'
import { MessageListSkeleton } from '@components/features/dm-channel/DirectMessagePageSkeleton'
import _ from '@lib/translate'
import ErrorBanner from '@components/ui/error-banner'
import { Input } from '@components/ui/input'
import { TabsButton, TabsButtonItem } from '@components/ui/tab-buttons'
import { attachmentPreviewAtom, getAttachmentKind, type Attachment } from '@utils/attachmentPreview'
import { getFileExtension } from '@lib/file'

type FilesView = 'list' | 'grid'

/** Search-result file → lightbox attachment (same shape messages produce). */
const toAttachment = (file: SearchResult): Attachment => ({
    id: file.id,
    fileName: file.title,
    fileUrl: new URL(file.internal_link!, window.location.origin).href,
    kind: getAttachmentKind(file.internal_link!),
    size: file.file_size,
    owner: file.author,
    creation: file.creation,
})

const ChannelFiles = ({ channelID }: { channelID: string }) => {
    const [searchQuery, setSearchQuery] = useState('')
    const [view, setView] = useState<FilesView>('list')
    const { results, isLoading, error } = useSqliteSearch(searchQuery, { channel_id: channelID, message_type: ["File", "Image"] }, 100, (r) => r.title)
    const { members } = useChannelMembers(channelID)

    // One lookup Map instead of members.find() per file per render
    const membersByName = useMemo(() => new Map(members.map((member) => [member.name, member])), [members])

    // Rows without a file URL can't be previewed or rendered — drop them ONCE so
    // list indexes line up with the attachment set the lightbox pages through.
    const files = useMemo(() => results.filter((result) => result.internal_link), [results])
    const attachments = useMemo(() => files.map(toAttachment), [files])

    const setPreview = useSetAtom(attachmentPreviewAtom)
    // The whole files list is ONE navigable set — open at the clicked file and
    // arrow/swipe through the rest, Drive-style.
    const openPreview = (index: number) => setPreview({ attachments, index, mode: 'view' })

    return (
        <div className="px-1 space-y-2">
            {/* Search + view toggle */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ink-gray-4" />
                    <Input
                        placeholder={_("Search files...")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-8 text-sm"
                    />
                </div>
                <TabsButton value={view} onValueChange={(value) => setView(value as FilesView)} aria-label={_("Files view")}>
                    <TabsButtonItem value="list" iconOnly aria-label={_("List view")} title={_("List view")}>
                        <ListIcon />
                    </TabsButtonItem>
                    <TabsButtonItem value="grid" iconOnly aria-label={_("Grid view")} title={_("Grid view")}>
                        <LayoutGridIcon />
                    </TabsButtonItem>
                </TabsButton>
            </div>
            {error && <ErrorBanner error={error} />}
            {/* Files */}
            <div>
                {isLoading ? <MessageListSkeleton /> :
                    files.length === 0 ? <div className="text-sm text-ink-gray-4 text-center py-8">{searchQuery ? _("No files found matching your search.") : _("No files shared in this channel yet.")}</div> :
                        view === 'grid' ? (
                            <FilesGrid files={files} onOpen={openPreview} />
                        ) : (
                            <div className="space-y-2 pb-1">
                                {files.map((file, index) => (
                                    <FileListRow
                                        key={file.id}
                                        file={file}
                                        member={membersByName.get(file.author)}
                                        onOpen={() => openPreview(index)}
                                    />
                                ))}
                            </div>
                        )}
            </div>
        </div>
    )
}

const FileListRow = ({ file, member, onOpen }: {
    file: SearchResult
    member?: ChannelMemberData
    onOpen: () => void
}) => {
    return (
        <button
            type="button"
            onClick={onOpen}
            className="group p-3 border border-outline-gray-2/70 rounded-lg hover:bg-surface-gray-2/50 transition-colors cursor-pointer w-full text-left"
            aria-label={_("Preview {0}", [file.title])}>
            <div className="flex gap-3 min-w-0">
                <div className="shrink-0 mt-0.5">
                    {file.message_type === 'Image' && file.internal_link ? (
                        <div className="relative">
                            <img
                                src={file.internal_link}
                                alt={file.title}
                                loading="lazy"
                                className="h-8 w-8 object-cover rounded-md border border-outline-gray-2/40"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 rounded-md" />
                        </div>
                    ) : (
                        <FileTypeIcon fileType={file.file_type || "File"} size="lg" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                        <h3 className="text-sm font-medium text-ink-gray-8 truncate flex-1 min-w-0 pr-2">
                            {file.title}
                        </h3>
                        {/* Download is its own control — don't let it open the preview */}
                        <a
                            href={file.internal_link}
                            download
                            onClick={(event) => event.stopPropagation()}
                            aria-label={_("Download {0}", [file.title])}
                        >
                            <ArrowDownToLine className="h-3 w-3 text-ink-gray-4 opacity-0 group-hover:opacity-100 hover:text-ink-gray-8 transition-opacity duration-200 shrink-0 mt-0.5" />
                        </a>
                    </div>

                    <div className="flex items-center gap-2 text-2xs text-ink-gray-4/70">
                        {file.file_size ? <span>{formatFileSize(file.file_size)}</span> : <span>0 B</span>}
                        <span>•</span>
                        <span className="uppercase">{file.file_type}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-ink-gray-4/80 mt-2 ml-11">
                {member && <><UserAvatar
                    user={member}
                    size="xs"
                    showStatusIndicator={false}
                />
                    <span>{member.full_name}</span>
                    <span>•</span></>}
                <span>{formatRelativeDate(file.creation)}</span>
            </div>
        </button>
    )
}

/** Square-tile grid: images show their picture, everything else its type icon. */
const FilesGrid = ({ files, onOpen }: { files: SearchResult[], onOpen: (index: number) => void }) => {
    return (
        <div className="grid grid-cols-3 gap-2 pb-1">
            {files.map((file, index) => (
                <button
                    key={file.id}
                    type="button"
                    onClick={() => onOpen(index)}
                    title={file.title}
                    aria-label={_("Preview {0}", [file.title])}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-gray-1 transition-colors hover:border-outline-gray-3"
                >
                    {file.message_type === 'Image' ? (
                        <img
                            src={file.internal_link}
                            alt={file.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2">
                            <FileTypeIcon fileType={file.file_type || getFileExtension(file.title) || "File"} size="xl" />
                            <span className="line-clamp-2 w-full break-all text-center text-2xs text-ink-gray-6">
                                {file.title}
                            </span>
                        </div>
                    )}
                    {/* Image tiles get a filename scrim on hover (desktop) */}
                    {file.message_type === 'Image' && (
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 hidden truncate bg-gradient-to-t from-black-700 to-transparent px-1.5 pb-1 pt-4 text-left text-2xs text-white opacity-0 transition-opacity group-hover:opacity-100 md:block">
                            {file.title}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}

export default ChannelFiles
