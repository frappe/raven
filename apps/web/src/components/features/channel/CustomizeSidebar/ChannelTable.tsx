import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon"
import { ListView } from "@components/ui/list-view"
import type { ListViewColumnMeta } from "@components/ui/list-view"
import { ColumnDef } from "@tanstack/react-table"
import { ChannelSidebarData, type ChannelHiddenReason } from "@raven/lib/hooks/useGroupedChannels"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import { useMemo } from "react"
import _ from "@lib/translate"
import { EyeOff } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import { ChannelGroupSelect } from "./ChannelGroupSelect"

interface ChannelTable {
  name: string,
  channel_name: string,
  channel_description: string,
  type: "Private" | "Public" | "Open",
  channel_group: string
  /** Set when the user's own sidebar preferences hide this channel — the row
   *  still shows (you can't organize what you can't see) but greyed, with an
   *  explanation on the eye-off icon. */
  hiddenReason?: ChannelHiddenReason
}

const HIDDEN_REASON_TEXT: Record<ChannelHiddenReason, () => string> = {
  not_joined: () => _("Hidden from your sidebar - your preferences only show channels you have joined."),
  no_recent_activity: () => _("Hidden from your sidebar - no activity in the last 30 days."),
}

export const ChannelTable = ({ data }: { data: ChannelSidebarData }) => {

  const tableData = useMemo<ChannelTable[]>(() => {

    const result: ChannelTable[] = []

    // Process grouped channels
    data.groupedChannels.forEach(([groupName, channels]) => {
      channels.forEach(channel => {
        result.push({
          name: channel.name,
          channel_name: channel.channel_name,
          channel_description: channel.channel_description || '',
          type: channel.type,
          channel_group: groupName,
          hiddenReason: channel._hiddenReason
        })
      })
    })

    // Process ungrouped channels
    data.ungroupedChannels.forEach(channel => {
      result.push({
        name: channel.name,
        channel_name: channel.channel_name,
        channel_description: channel.channel_description || '',
        type: channel.type,
        channel_group: '',
        hiddenReason: channel._hiddenReason
      })
    })

    // Alphabetical, NOT the grouped-then-ungrouped order the rows arrive in:
    // that order made assigning a group physically move the row (up into its
    // group's block) under the user's cursor. The table is a worklist you scan
    // by name — grouping is the PREVIEW's job to visualize.
    return result.sort((a, b) => a.channel_name.localeCompare(b.channel_name))
  }, [data])

  const columns: ColumnDef<ChannelTable>[] = useMemo(() => [
    {
      id: 'channel_name',
      header: _('Name'),
      accessorKey: 'channel_name',
      meta: {
        gridWidth: 'minmax(160px,1fr)',
        getTooltipText: (row) => (row as ChannelTable).channel_name,
      } satisfies ListViewColumnMeta,
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className='flex items-center gap-2 min-w-0'>
            <ChannelIcon
              type={r.type || "Public"}
              className={cn("w-4 h-4 shrink-0", r.hiddenReason && "text-ink-gray-4")}
            />
            <span className={cn('font-medium truncate', r.hiddenReason && 'text-ink-gray-4 font-normal')}>{r.channel_name}</span>
            {r.hiddenReason && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <EyeOff className="size-3.5 shrink-0 text-ink-gray-4" aria-label={_("Hidden from sidebar")} />
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  {HIDDEN_REASON_TEXT[r.hiddenReason]()}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    // {
    //   id: 'channel_description',
    //   header: _('Description'),
    //   accessorKey: 'channel_description',
    //   size: 270,
    //   cell: ({ getValue }) => (
    //     <span className='text-sm text-ink-gray-4 line-clamp-1 text-ellipsis'>
    //       {(getValue() as string) || '—'}
    //     </span>
    //   ),
    // },
    {
      id: 'channel_group',
      header: _('Group'),
      accessorKey: 'channel_group',
      meta: {
        // Holds the group Select (w-52 ≈ 208px) — keep a fixed track, don't flex.
        gridWidth: '220px',
        truncate: false,
      } satisfies ListViewColumnMeta,
      cell: ({ row }) => (
        <ChannelGroupSelect channelId={row.original.name} channelGroup={row.original.channel_group} />
      ),
    },
  ], [])

  return (
    <ListView
      className="flex-1 min-h-0 pr-2"
      data={tableData}
      columns={columns}
      getRowId={(row) => row.name}
      scrollAreaClassName="flex-1"
      maxHeight="100%"
      // Rows carry a group Select — same reason the Channels panel bumps its rows.
      rowHeight={44}
      emptyState={
        <Empty>
          <EmptyMedia>
            <ChannelIcon type="Public" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{_("No channels found")}</EmptyTitle>
            <EmptyDescription>{_("Channels in this workspace will show up here.")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  )
}