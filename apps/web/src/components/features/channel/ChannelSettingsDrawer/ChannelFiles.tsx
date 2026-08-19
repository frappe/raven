import { UserAvatar } from '@components/features/message/UserAvatar'
import { ArrowDownToLine, LayoutGridIcon, ListIcon, SearchIcon } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso, VirtuosoGrid, type VirtuosoGridHandle, type VirtuosoHandle } from 'react-virtuoso'
import { useDebounceValue } from 'usehooks-ts'
import { subscribeToMessageEvents } from '@stores/messages/messageEvents'
import { useSetAtom } from 'jotai'
import FileTypeIcon from '@components/common/FileIcons/FileTypeIcon'
import { useChannelFilesInfinite, type ChannelFile } from '@hooks/useChannelFiles'
import { useChannelMembers, type ChannelMemberData } from '@hooks/useChannelMembers'
import { formatRelativeDate } from '@lib/date'
import { formatFileSize } from '@utils/fileUtils'
import { Skeleton } from '@components/ui/skeleton'
import _ from '@lib/translate'
import ErrorBanner from '@components/ui/error-banner'
import { Input } from '@components/ui/input'
import { TabsButton, TabsButtonItem } from '@components/ui/tab-buttons'
import { attachmentPreviewAtom, getAttachmentKind, type Attachment } from '@utils/attachmentPreview'
import { getFileExtension } from '@lib/file'
import { TAB_SCROLLER } from './tabPanel'
import { InputGroup, InputGroupAddon } from '@components/ui/input-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip'

type FilesView = 'list' | 'grid'

/** Channel file → lightbox attachment (same shape messages produce). */
const toAttachment = (file: ChannelFile): Attachment => ({
    id: file.id,
    fileName: file.title,
    fileUrl: new URL(file.internal_link!, window.location.origin).href,
    kind: getAttachmentKind(file.internal_link!),
    // The filmstrip renders this; without it, it downloads the originals.
    thumbnail: file.file_thumbnail,
    width: file.thumbnail_width,
    height: file.thumbnail_height,
    size: file.file_size,
    owner: file.author,
    creation: file.creation,
})

const ChannelFiles = ({ channelID }: { channelID: string }) => {
    // Debounced at the INPUT (uncontrolled below): keystrokes render nothing;
    // the tab re-renders once per settled query. The search hooks no longer
    // debounce internally — this is the one debounce.
    const [searchQuery, setSearchQuery] = useDebounceValue('', 200)
    const [view, setView] = useState<FilesView>('grid')
    // Paginated straight from MariaDB (20/page, keyset cursor) — NOT the search
    // index, which lags ~5 min behind uploads. search is a filename match.
    const { results, isLoading, error, hasMore, isLoadingMore, loadMore, mutate } = useChannelFilesInfinite(
        channelID,
        searchQuery,
        20,
    )
    const { members } = useChannelMembers(channelID)

    // One lookup Map instead of members.find() per file per render
    const membersByName = useMemo(() => new Map(members.map((member) => [member.name, member])), [members])

    // Rows without a file URL can't be previewed or rendered — drop them ONCE so
    // list indexes line up with the attachment set the lightbox pages through.
    const files = useMemo(() => results.filter((result) => result.internal_link), [results])
    const attachments = useMemo(() => files.map(toAttachment), [files])

    const setPreview = useSetAtom(attachmentPreviewAtom)
    // Marks lightbox sessions opened from THIS tab, so the sync effects below
    // never touch a viewer some other surface (the stream) opened.
    const sourceKey = `channel-files:${channelID}`

    // The virtualized lists scroll THIS element (customScrollParent), so the
    // tab keeps its scroller — scroll-fade, safe-area padding, and the
    // drawer's positional no-drag stamping all still land on it. State (not
    // a ref) because Virtuoso needs the element itself and must re-render
    // once it exists.
    const [scrollerEl, setScrollerEl] = useState<HTMLDivElement | null>(null)
    const gridRef = useRef<VirtuosoGridHandle>(null)
    const listRef = useRef<VirtuosoHandle>(null)

    // Lightbox → list scroll sync (iOS Photos): paging in the viewer keeps
    // the item's row/tile centered underneath, so closing lands on it.
    // Virtualized lists may not have the target row in the DOM at all, so
    // this goes through scrollToIndex (only the mounted view has a live
    // handle — the other ref is null). Instant on purpose — it happens
    // behind a fullscreen modal; smooth would race under rapid swipes.
    const idToIndex = useMemo(() => new Map(files.map((file, index) => [file.id, index])), [files])
    const idToIndexRef = useRef(idToIndex)
    useEffect(() => { idToIndexRef.current = idToIndex }, [idToIndex])
    const scrollToAttachment = useCallback((attachment: Attachment) => {
        const index = idToIndexRef.current.get(attachment.id)
        if (index === undefined) return
        gridRef.current?.scrollToIndex({ index, align: "center" })
        listRef.current?.scrollToIndex({ index, align: "center" })
    }, [])

    // Stable callback for the atom; the ref keeps it pointing at the current
    // page state without rewriting the atom every fetch.
    const loadMoreRef = useRef(loadMore)
    useEffect(() => { loadMoreRef.current = loadMore }, [loadMore])
    const handleNearEnd = useCallback(() => loadMoreRef.current(), [])

    // Live refresh: a file arriving in (or leaving) this channel refetches the
    // loaded pages. Debounced — a multi-file send lands as a burst of events
    // (one refetch, not five), and the FTS index write can trail the socket
    // event by a beat, which the delay also absorbs.
    const mutateRef = useRef(mutate)
    useEffect(() => { mutateRef.current = mutate }, [mutate])
    const refreshTimer = useRef<number | null>(null)
    const scheduleRefresh = useCallback(() => {
        if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
        refreshTimer.current = window.setTimeout(() => {
            refreshTimer.current = null
            mutateRef.current()
        }, 500)
    }, [])
    useEffect(() => () => {
        if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
    }, [])

    // Message events come through the in-app bus, NOT useFrappeEventListener:
    // the sdk's cleanup removes ALL socket listeners for an event, so a second
    // subscriber here would kill the app-level one when this tab unmounts.
    // useMessagesRealtime (the single socket subscriber) rebroadcasts; events
    // only arrive for joined rooms, and the channel being viewed is joined.
    // Own sends come back over the same broadcast, so our uploads refresh too.
    useEffect(() => {
        return subscribeToMessageEvents((event) => {
            if (event.channelID !== channelID) return
            if (event.kind === 'created') {
                if (event.messageType !== 'File' && event.messageType !== 'Image') return
                scheduleRefresh()
            } else {
                // Only refetch when the deleted message is a file we're showing
                // — index ids carry the doctype prefix, the event id doesn't.
                if (!idToIndexRef.current.has(`Raven Message:${event.messageID}`)) return
                scheduleRefresh()
            }
        })
    }, [channelID, scheduleRefresh])

    // The whole files list is ONE navigable set — open at the clicked file and
    // arrow/swipe through the rest, Drive-style. The callbacks let the viewer
    // drive this tab: scroll sync + load-next-page-near-the-end. Reads the
    // set through a ref so its identity survives page appends — memoized
    // rows/tiles keep their props stable.
    const previewSetRef = useRef({ attachments, hasMore })
    useEffect(() => { previewSetRef.current = { attachments, hasMore } }, [attachments, hasMore])
    const openPreview = useCallback((index: number) => {
        setPreview({
            ...previewSetRef.current,
            index,
            mode: 'view',
            sourceKey,
            onIndexChange: scrollToAttachment,
            onNearEnd: handleNearEnd,
        })
    }, [setPreview, sourceKey, scrollToAttachment, handleNearEnd])

    // The file set changed while our lightbox session is open — a page was
    // appended, or a live refresh added/removed rows. Swap the set in place,
    // and carry the index BY ID: a new file prepending shifts every numeric
    // position, and keeping the number would silently jump the viewer to a
    // different item mid-swipe. Fallback clamp covers the viewed item itself
    // being deleted.
    useEffect(() => {
        setPreview((prev) => {
            if (!prev || prev.sourceKey !== sourceKey) return prev
            if (prev.attachments === attachments && prev.hasMore === hasMore) return prev
            if (attachments.length === 0) return null
            const currentID = prev.attachments[prev.index]?.id
            const remapped = currentID === undefined ? -1 : attachments.findIndex((a) => a.id === currentID)
            const index = remapped !== -1 ? remapped : Math.min(prev.index, attachments.length - 1)
            return { ...prev, attachments, hasMore, index }
        })
    }, [attachments, hasMore, sourceKey, setPreview])

    // Tab switch / channel change unmounts this component while the viewer can
    // stay open: freeze the session — drop our callbacks (they'd be stale) and
    // hasMore (nobody is left to load more). The snapshot keeps working.
    useEffect(() => {
        return () => {
            setPreview((prev) => {
                if (!prev || prev.sourceKey !== sourceKey) return prev
                return { ...prev, sourceKey: undefined, onIndexChange: undefined, onNearEnd: undefined, hasMore: false }
            })
        }
    }, [sourceKey, setPreview])

    return (
        // Flex column: the filter row stays pinned; only the list below scrolls.
        <div className="flex flex-1 min-h-0 flex-col gap-3">
            {/* Search + view toggle */}
            <div className="flex shrink-0 items-center gap-2">
                <InputGroup>
                    <InputGroupAddon>
                        <SearchIcon />
                    </InputGroupAddon>
                    <Input
                        inputSize="sm"
                        placeholder={_("Search...")}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </InputGroup>
                <TabsButton value={view} size="md" onValueChange={(value) => setView(value as FilesView)} aria-label={_("Files view")}>
                    <TabsButtonItem value="grid" iconOnly aria-label={_("Grid view")} title={_("Grid view")}>
                        <LayoutGridIcon />
                    </TabsButtonItem>
                    <TabsButtonItem value="list" iconOnly aria-label={_("List view")} title={_("List view")}>
                        <ListIcon />
                    </TabsButtonItem>
                </TabsButton>
            </div>
            {error && <ErrorBanner error={error} />}
            {/* Files — the tab's one scroller (fade + safe-area padding).
                The virtualized views below scroll it via customScrollParent
                instead of bringing their own scroller. */}
            <div ref={setScrollerEl} className={TAB_SCROLLER}>
                {isLoading ? (view === 'grid' ? <FilesGridSkeleton /> : <FilesListSkeleton />) :
                    files.length === 0 ? <div className="text-p-sm text-ink-gray-4 text-center py-8">{searchQuery ? _("No files found matching your search.") : _("No files shared in this channel yet.")}</div> :
                        scrollerEl && (view === 'grid' ? (
                            <VirtuosoGrid
                                ref={gridRef}
                                customScrollParent={scrollerEl}
                                totalCount={files.length}
                                overscan={200}
                                // Infinite scroll: reaching the last rendered
                                // row asks for the next page (loadMore no-ops
                                // while one is in flight or when done).
                                endReached={loadMore}
                                listClassName="grid grid-cols-3 gap-3"
                                itemClassName="min-w-0"
                                itemContent={(index) => {
                                    const file = files[index]
                                    return (
                                        <FileGridTile
                                            file={file}
                                            member={membersByName.get(file.author)}
                                            index={index}
                                            onOpen={openPreview}
                                        />
                                    )
                                }}
                            />
                        ) : (
                            <Virtuoso
                                ref={listRef}
                                customScrollParent={scrollerEl}
                                data={files}
                                overscan={200}
                                endReached={loadMore}
                                itemContent={(index, file) => (
                                    // Row gap lives INSIDE the item (padding,
                                    // not margin) so Virtuoso measures it.
                                    <div className="pb-2">
                                        <FileListRow
                                            file={file}
                                            member={membersByName.get(file.author)}
                                            index={index}
                                            onOpen={openPreview}
                                        />
                                    </div>
                                )}
                            />
                        ))}
                {/* Next-page placeholder, shaped like one row of the active view. */}
                {isLoadingMore && (view === 'grid' ? <FilesGridSkeleton rows={1} /> : <FilesListSkeleton rows={2} />)}
            </div>
        </div>
    )
}

/** Memoized: rows re-render only when their own file/member changes (page
 *  appends and atom writes re-render the parent, not every row). `onOpen` is
 *  a stable parent callback taking the row's index, so memo actually holds. */
const FileListRow = memo(({ file, member, index, onOpen }: {
    file: ChannelFile
    member?: ChannelMemberData
    index: number
    onOpen: (index: number) => void
}) => {
    return (
        // div + role="button" (same as LinkPreviewCard): the row holds a real
        // <a> for download, and an anchor inside a <button> is invalid HTML.
        <div
            data-file-id={file.id}
            className="group flex w-full cursor-pointer items-center gap-2 rounded-md border border-outline-gray-1 p-1.5 transition-colors hover:bg-surface-gray-1 outline-none"
            tabIndex={0}
            role="button"
            onClick={() => onOpen(index)}
            // target check: Enter on the download link bubbles here — only
            // open the preview when the ROW itself has focus.
            onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(index) }
            }}
            aria-label={_("Preview {0}", [file.title])}
        >
            {file.message_type === 'Image' && file.internal_link ? (
                // Stored thumbnail, not the original — this is a 56px box.
                // alt is empty on purpose: the row already announces the file
                // name, so a non-empty alt would read it twice.
                <img
                    src={file.file_thumbnail || file.internal_link}
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-md border border-outline-gray-1 object-cover"
                />
            ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                    <FileTypeIcon fileType={getFileExtension(file.title) || "File"} size="lg" />
                </div>
            )}

            <div className="min-w-0 flex-1 gap-1 flex flex-col">
                <div className="truncate text-sm-medium leading-4 text-ink-gray-8">{file.title}</div>
                {member && (
                    <div className="flex items-center gap-1.5 text-xs text-ink-gray-5">
                        <span className="truncate text-ink-gray-6 text-xs leading-snug">{member.full_name}</span>
                        <span>·</span>
                        <span className="shrink-0">{formatRelativeDate(file.creation)}</span>
                        <span>·</span>
                        <span className="shrink-0">{formatFileSize(file.file_size ?? 0)}</span>
                    </div>
                )}
            </div>

            {/* Download is its own control — don't let it open the preview.
                Hover-revealed on desktop, always visible on mobile (no hover
                there). */}
            <a
                href={file.internal_link}
                download
                onClick={(event) => event.stopPropagation()}
                aria-label={_("Download {0}", [file.title])}
                className="shrink-0 rounded p-1.5 text-ink-gray-4 transition-opacity hover:text-ink-gray-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
                <ArrowDownToLine className="h-4 w-4" />
            </a>
        </div>
    )
})
FileListRow.displayName = 'FileListRow'

/** Finder-style grid tile: square thumbnail, then name and size below. Every
 *  tile has the same anatomy, so names are always visible — including image
 *  tiles on mobile, where the old hover scrim never showed. Memoized for the
 *  same reason as FileListRow. */
const FileGridTile = memo(({ file, member, index, onOpen }: {
    file: ChannelFile
    member?: ChannelMemberData
    index: number
    onOpen: (index: number) => void
}) => {
    return (
        <button
            type="button"
            data-file-id={file.id}
            onClick={() => onOpen(index)}
            title={file.title}
            aria-label={_("Preview {0}", [file.title])}
            // outline-none kills the boxy default focus ring around the whole
            // tile+caption (it shows when the closing lightbox restores focus
            // here); keyboard users still get an indicator — the thumbnail
            // border below picks up focus-visible.
            className="group flex w-full min-w-0 flex-col gap-1 text-left outline-none"
        >
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-outline-gray-1 bg-surface-gray-1 transition-colors group-hover:border-outline-gray-3 group-focus-visible:border-outline-gray-4">
                {file.message_type === 'Image' ? (
                    // Stored thumbnail, not the original — tiles are ~110px.
                    // alt is empty on purpose: the button already announces the
                    // file name, so a non-empty alt would read it twice.
                    <img
                        src={file.file_thumbnail || file.internal_link}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <FileTypeIcon fileType={getFileExtension(file.title) || "File"} size="xl" />
                    </div>
                )}
                {/* Who shared it — badge in the thumbnail corner, Drive-style.
                    The ring separates it from photo pixels underneath. Missing
                    member (author left the channel) just means no badge.
                    Hovering the badge names the sharer and the share date; a
                    click still bubbles to the tile and opens the preview. */}
                {member && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="absolute -bottom-0.5 right-1">
                                <UserAvatar
                                    user={member}
                                    size="xs"
                                    showStatusIndicator={false}
                                    avatarClassName="ring ring-surface-base"
                                />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <span className="block">{member.full_name}</span>
                            <span className="block">{_("Shared {0}", [formatRelativeDate(file.creation)])}</span>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
            <div className="flex min-w-0 flex-col px-0.5">
                <span className="truncate text-xs-medium leading-relaxed text-ink-gray-8">{file.title}</span>
                <span className="truncate text-2xs text-ink-gray-4">
                    {formatFileSize(file.file_size ?? 0)}
                </span>
            </div>
        </button>
    )
})
FileGridTile.displayName = 'FileGridTile'

/* Loading placeholders shaped like the view they stand in for, so the swap
   from skeleton to content doesn't reflow the tab. Caption/text widths vary
   by index to read as real content instead of a uniform block. `rows` trims
   them down for the load-more placeholder under an already-full list. */

const GRID_SKELETON_WIDTHS = ['w-full', 'w-3/4', 'w-5/6', 'w-2/3', 'w-full', 'w-4/5', 'w-full', 'w-3/4', 'w-2/3']

const FilesGridSkeleton = ({ rows }: { rows?: number }) => (
    <div className="grid grid-cols-3 gap-3 pb-1" aria-hidden="true">
        {GRID_SKELETON_WIDTHS.slice(0, rows ? rows * 3 : undefined).map((width, index) => (
            <div key={index} className="flex min-w-0 flex-col gap-1">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <div className="flex flex-col gap-1 px-0.5 py-0.5">
                    <Skeleton className={`h-3 ${width}`} />
                    <Skeleton className="h-2.5 w-1/3" />
                </div>
            </div>
        ))}
    </div>
)

const LIST_SKELETON_WIDTHS = ['w-2/5', 'w-3/5', 'w-1/3', 'w-1/2', 'w-2/5']

const FilesListSkeleton = ({ rows }: { rows?: number }) => (
    <div className="space-y-2 pb-1" aria-hidden="true">
        {LIST_SKELETON_WIDTHS.slice(0, rows).map((width, index) => (
            <div key={index} className="flex items-center gap-2 rounded-md border border-outline-gray-1 p-1.5">
                <Skeleton className="h-14 w-14 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className={`h-3.5 ${width}`} />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                </div>
            </div>
        ))}
    </div>
)

export default ChannelFiles
