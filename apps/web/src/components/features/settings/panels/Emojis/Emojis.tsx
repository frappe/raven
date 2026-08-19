import { useState, useMemo, useEffect } from 'react'
import { ListView, type ListViewColumnMeta, type SortingState } from '@components/ui/list-view'
import type { ColumnDef } from '@tanstack/react-table'
import { TablePagination } from '@components/ui/table-pagination'
import { useFetchCustomEmojis, useFetchCustomEmojisCount } from '@hooks/fetchers/useFetchCustomEmojis'
import { useSWRConfig } from 'frappe-react-sdk'
import {
    SettingsPanelContent,
    SettingsPanelDescription,
    SettingsPanelHeader,
    SettingsPanelTitle,
} from '@components/ui/settings-dialog'
import { Button } from '@components/ui/button'
import ErrorBanner from '@components/ui/error-banner'
import { Spinner } from '@components/ui/spinner'
import { RavenCustomEmoji } from '@raven/types/RavenMessaging/RavenCustomEmoji'
import { getDateObject } from '@lib/date'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@components/ui/empty'
import { SmilePlus } from 'lucide-react'
import _ from '@lib/translate'
import AddCustomEmojiDialog from './AddEmojiDialog'
import DeleteEmojiDialog from './DeleteEmojiDialog'

const CustomEmojiEmptyState = ({ setOpen }: { setOpen: (open: boolean) => void }) => {
    return (
        <Empty>
            <EmptyMedia>
                <SmilePlus />
            </EmptyMedia>
            <EmptyHeader>
                <EmptyTitle>{_("Emojis")}</EmptyTitle>
                <EmptyDescription>
                    {_("Personalize your chats with custom emojis.")}
                    <br />
                    {_("Upload your own or download from")}{" "}
                    <a href='https://emoji.gg' target='_blank' rel='noreferrer' className='text-ink-blue-link underline'>Emoji.gg</a>.
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                {/* Outline: the panel header already owns the primary Upload button. */}
                <Button size='sm' variant='outline' onClick={() => setOpen(true)}>
                    {_("Upload")}
                </Button>
            </EmptyContent>
        </Empty>
    )
}

export const Emojis = () => {
    const { mutate: globalMutate } = useSWRConfig()

    const [sorting, setSorting] = useState<SortingState>([])
    const [pageIndex, setPageIndex] = useState(0)
    const [pageSize, setPageSize] = useState(20)
    const [open, setOpen] = useState(false)

    // The server fetch takes a single {field, order}; ListView holds TanStack sorting.
    const fetchSort = useMemo(() => {
        const active = sorting[0]
        return active ? { field: active.id, order: active.desc ? ('desc' as const) : ('asc' as const) } : undefined
    }, [sorting])

    // Fetch data with current page settings
    const { data, isLoading, error, mutate } = useFetchCustomEmojis(
        fetchSort,
        { pageIndex, pageSize, totalCount: 0 }
    )
    const { count, mutate: mutateCount } = useFetchCustomEmojisCount()

    // Deleting the last row of the last page leaves pageIndex past the end —
    // the list then showed "No emojis found" with a phantom "Page 3 of 2".
    // Clamp back onto the last real page whenever the count shrinks.
    useEffect(() => {
        if (count === undefined) return
        const lastPage = Math.max(0, Math.ceil(count / pageSize) - 1)
        if (pageIndex > lastPage) setPageIndex(lastPage)
    }, [count, pageSize, pageIndex])

    const onAddEmoji = (refresh: boolean = false) => {
        if (refresh) {
            mutate()
            mutateCount()
            globalMutate('custom-emojis')
        }
        setOpen(false)
    }

    const onDeleteEmoji = () => {
        mutate()
        mutateCount()
        globalMutate('custom-emojis')
    }

    // Define columns inside component so we can pass onDeleteEmoji
    const columns: ColumnDef<RavenCustomEmoji>[] = useMemo(() => [
        {
            id: 'name',
            accessorKey: 'emoji_name',
            header: _('Name'),
            meta: {
                gridWidth: 'minmax(180px,1.5fr)',
                getTooltipText: (row) => `:${(row as RavenCustomEmoji).emoji_name}:`,
            } satisfies ListViewColumnMeta,
            cell: ({ row }) => (
                <div className='flex items-center gap-2 min-w-0'>
                    <img
                        src={row.original.image}
                        alt={row.original.emoji_name}
                        className='w-8 h-8 rounded-md object-contain object-center shrink-0'
                    />
                    <span className='font-medium truncate'>:{row.original.emoji_name}:</span>
                </div>
            )
        },
        {
            id: 'keywords',
            accessorKey: 'keywords',
            header: _('Keywords'),
            enableSorting: false,
            meta: { gridWidth: 'minmax(120px,1fr)' } satisfies ListViewColumnMeta,
            cell: ({ row }) => (
                <span className='text-ink-gray-4 truncate'>
                    {row.original.keywords || '—'}
                </span>
            )
        },
        {
            id: 'owner',
            accessorKey: 'owner',
            header: _('Uploaded By'),
            enableSorting: false,
            meta: { gridWidth: 'minmax(140px,1fr)' } satisfies ListViewColumnMeta,
            cell: ({ row }) => <span className='truncate'>{row.original.owner}</span>,
        },
        {
            id: 'creation',
            accessorKey: 'creation',
            header: _('Added'),
            meta: { gridWidth: 'minmax(120px,1fr)', tabularNums: true } satisfies ListViewColumnMeta,
            cell: ({ row }) => (
                <span>{getDateObject(row.original.creation).format("MMM Do, YYYY")}</span>
            )
        },
        {
            id: 'actions',
            header: '',
            size: 50,
            enableSorting: false,
            enableResizing: false,
            meta: { truncate: false, truncateTooltip: false } satisfies ListViewColumnMeta,
            cell: ({ row }) => (
                <DeleteEmojiDialog
                    emojiId={row.original.name}
                    emojiName={row.original.emoji_name}
                    onDelete={onDeleteEmoji}
                />
            )
        }
    ], [onDeleteEmoji])

    return (
        <>
            <SettingsPanelHeader
                actions={
                    <Button size="sm" onClick={() => setOpen(true)}>
                        {_("Upload")}
                    </Button>
                }
            >
                <SettingsPanelTitle>{_("Emojis")}</SettingsPanelTitle>
                <SettingsPanelDescription>
                    {_("Add custom emojis to use for your reactions. PNG, SVG and GIFs supported.")}
                    <br />
                    {_("Need help finding one? Download from")}{" "}
                    <a href="https://emoji.gg" target="_blank" rel="noreferrer" className="text-ink-blue-link underline">
                        Emoji.gg
                    </a>
                    .
                </SettingsPanelDescription>
            </SettingsPanelHeader>
            <SettingsPanelContent className="min-h-0">
                {error && <ErrorBanner error={error} />}
                {!isLoading && count === 0 ? (
                    <CustomEmojiEmptyState setOpen={setOpen} />
                ) : (
                    <>
                        {isLoading ? (
                            <div className="flex flex-1 items-center justify-center">
                                <Spinner />
                            </div>
                        ) : (
                            <ListView
                                className="flex-1 min-h-0"
                                scrollAreaClassName="flex-1"
                                maxHeight="100%"
                                data={data ?? []}
                                columns={columns}
                                getRowId={(row) => row.name}
                                sorting={sorting}
                                onSortingChange={(updater) => {
                                    // New sort re-orders the whole set — jump back to the first page.
                                    setSorting(updater)
                                    setPageIndex(0)
                                }}
                                rowHeight={44}
                                emptyState={
                                    <Empty>
                                        <EmptyMedia>
                                            <SmilePlus />
                                        </EmptyMedia>
                                        <EmptyHeader>
                                            <EmptyTitle>{_("No emojis found")}</EmptyTitle>
                                            <EmptyDescription>{_("Try a different search term.")}</EmptyDescription>
                                        </EmptyHeader>
                                    </Empty>
                                }
                            />
                        )}
                        <TablePagination
                            pageIndex={pageIndex}
                            pageSize={pageSize}
                            totalCount={count}
                            onPageChange={setPageIndex}
                            onPageSizeChange={(size) => {
                                setPageSize(size)
                                setPageIndex(0)
                            }}
                        />
                    </>
                )}
                <AddCustomEmojiDialog open={open} onClose={onAddEmoji} />
            </SettingsPanelContent>
        </>
    )
}

export default Emojis
