import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useFrappePostCall } from "frappe-react-sdk"
import { toast } from "sonner"
import { CheckIcon, SearchIcon } from "lucide-react"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import { DialogFooter } from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { InputGroup, InputGroupAddon } from "@components/ui/input-group"
import { scoreFilterRow } from "@components/common/filters/filterScore"
import { ChannelOption, getChannelLabel } from "@components/common/filters/ChannelFilter"
import { UserOption, getAmbiguousNames } from "@components/common/filters/UserFilter"
import { ResponsiveDialog, ResponsiveDialogHeader } from "./ResponsiveDialog"
import { useChannels, useDMChannels } from "@stores/channels/useChannelList"
import { useUsers } from "@hooks/useUsers"
import { useWorkspaces } from "@hooks/useWorkspaces"
import { useCreateDM } from "@hooks/useCreateDM"
import { useIsMobile } from "@hooks/use-mobile"
import { errorResponseToast } from "@components/ui/error-banner"
import { cn } from "@lib/utils"
import _ from "@lib/translate"
import type { Message } from "@raven/types/common/Message"
import type { ChannelListItem } from "@raven/types/common/ChannelListItem"
import type { UserData } from "@db"

/**
 * Where a forward is going. A person is NOT pre-resolved to their DM channel: the DM may
 * not exist yet, and creating one just because a row was selected would litter the
 * sidebar with empty conversations. Resolution happens on Forward.
 */
type Recipient =
    | { kind: "channel"; channel: ChannelListItem }
    | { kind: "user"; user: UserData }

/** One virtualized row: a group heading (browse mode only) or a selectable recipient. */
type Row =
    | { kind: "heading"; label: string }
    | { kind: "recipient"; recipient: Recipient; secondary?: string }

/**
 * Stable identity for a recipient across the two doctypes this list mixes. The sigils
 * only have to be unique — nothing scores them (search matches labels, below).
 */
const recipientValue = (recipient: Recipient): string =>
    recipient.kind === "channel" ? `#${recipient.channel.name}` : `@${recipient.user.name}`

/**
 * The recipient list: search on top, channels grouped by workspace, then Direct
 * Messages — every enabled colleague, not just existing DMs (the Forward resolves a
 * person to their DM channel, creating it if needed).
 *
 * NOT cmdk. cmdk filters by scoring the rows it has MOUNTED and reordering them in the
 * DOM, so every candidate must render up front — the exact thing a virtualized list
 * exists to avoid. The list is plain data instead: filtering and ranking happen here
 * with the same scorer the filter comboboxes use (identical ranking behavior), and
 * Virtuoso renders only the visible slice.
 */
const RecipientList = ({
    selected,
    onSelect,
    sourceChannelID,
}: {
    selected: Recipient | null
    onSelect: (recipient: Recipient) => void
    /** The channel the message lives in — hidden from the list: forwarding a message
     *  to where it already is helps nobody. For a DM source, the PERSON is hidden
     *  (their row is that DM's stand-in here). */
    sourceChannelID?: string
}) => {
    const { channels: allChannels } = useChannels()
    const { dmChannels } = useDMChannels()
    const users = useUsers()
    const { workspaces } = useWorkspaces()
    const isMobile = useIsMobile()
    const [search, setSearch] = useState("")
    const virtuosoRef = useRef<VirtuosoHandle>(null)

    // A new search re-ranks the whole list, but Virtuoso keeps the old scroll offset —
    // so after scrolling deep and typing, the BEST match sat above the fold. Jump back
    // to the top whenever the query changes (same fix as the command palette).
    useEffect(() => {
        virtuosoRef.current?.scrollTo({ top: 0 })
    }, [search])

    // Only channels that can actually RECEIVE a post — archived is blocked client-side
    // only, so an unfiltered list would let a forward succeed into a channel the product
    // says is read-only (mirrors useCanInteractInChannel's exact condition) — and never
    // the channel the message is already in.
    const channels = useMemo(
        () =>
            allChannels.filter(
                (channel) =>
                    channel.name !== sourceChannelID &&
                    !channel.is_archived &&
                    (channel.type === "Open" || Boolean(channel.member_id)),
            ),
        [allChannels, sourceChannelID],
    )

    // A DM source has no row in `channels` — its stand-in here is the PEER's user row,
    // so that's what gets hidden. (A thread source matches neither list and hides
    // nothing: forwarding a thread reply to the parent channel is legitimate.)
    const sourcePeer = useMemo(
        () => dmChannels.find((dm) => dm.name === sourceChannelID)?.peer_user_id,
        [dmChannels, sourceChannelID],
    )

    const workspaceNames = useMemo(
        () => new Map(workspaces.map((workspace) => [workspace.name, workspace.workspace_name])),
        [workspaces],
    )

    // Bots stay — a bot DM is a real destination. Deactivated accounts go: forwarding
    // into a dead account's DM helps nobody.
    const people = useMemo(
        () => users.filter((user) => user.enabled && user.name !== sourcePeer),
        [users, sourcePeer],
    )
    const ambiguousNames = useMemo(() => getAmbiguousNames(people), [people])

    const rows = useMemo<Row[]>(() => {
        const needle = search.trim()

        // Browsing: grouped by workspace, then Direct Messages — headings are rows too,
        // so one flat array feeds the virtualizer.
        if (!needle) {
            const out: Row[] = []
            const groups = new Map<string, ChannelListItem[]>()
            for (const channel of channels) {
                const key = channel.workspace ?? ""
                const list = groups.get(key)
                if (list) list.push(channel)
                else groups.set(key, [channel])
            }
            for (const [workspaceID, workspaceChannels] of groups) {
                out.push({ kind: "heading", label: workspaceNames.get(workspaceID) ?? workspaceID })
                for (const channel of workspaceChannels) out.push({ kind: "recipient", recipient: { kind: "channel", channel } })
            }
            if (people.length > 0) {
                out.push({ kind: "heading", label: _("Direct Messages") })
                for (const user of people) out.push({ kind: "recipient", recipient: { kind: "user", user } })
            }
            return out
        }

        // Searching: one flat ranking across both kinds (same scorer as the filter
        // comboboxes, so "general" here ranks like "general" there), no headings —
        // channel rows carry their workspace (two channels can share a name across
        // workspaces), and person rows carry their id only when another account shares
        // the same full name. The avatar already says "person"; a "Direct Message" tag
        // would just repeat it.
        const scored: { row: Row; score: number }[] = []
        for (const channel of channels) {
            const score = scoreFilterRow(channel.name, needle, [getChannelLabel(channel)])
            if (score > 0) {
                scored.push({
                    score,
                    row: {
                        kind: "recipient",
                        recipient: { kind: "channel", channel },
                        secondary: channel.workspace ? (workspaceNames.get(channel.workspace) ?? channel.workspace) : undefined,
                    },
                })
            }
        }
        for (const user of people) {
            const name = user.full_name ?? user.name
            const score = scoreFilterRow(user.name, needle, [name])
            if (score > 0) {
                scored.push({
                    score,
                    row: {
                        kind: "recipient",
                        recipient: { kind: "user", user },
                        secondary: ambiguousNames.has(name) ? user.name : undefined,
                    },
                })
            }
        }
        return scored.sort((a, b) => b.score - a.score).map((entry) => entry.row)
    }, [search, channels, people, workspaceNames, ambiguousNames])

    const selectedValue = selected ? recipientValue(selected) : null

    return (
        <div className="flex min-h-0 flex-col gap-3">
            {/* The standard InputGroup search — same anatomy as AddChannelMembers.
                Desktop autofocus; mobile skips it so the keyboard doesn't bury the
                list (same rule as every picker). */}
            <InputGroup size="md" variant="outline" className="shrink-0">
                <InputGroupAddon>
                    <SearchIcon className="pointer-events-none h-4 w-4 text-ink-gray-4" />
                </InputGroupAddon>
                <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={_("Search channels and people")}
                    autoFocus={!isMobile}
                />
            </InputGroup>

            {/* Virtualized: a directory-sized org makes channels + every user a long
                list, and only the visible slice needs to exist. The height goes through
                `style`, NOT a class: Virtuoso puts height:100% inline on its root, which
                beats any class — and 100% of this content-sized dialog is zero, so an
                h-96 utility renders an empty list. Capped for short phones. */}
            <Virtuoso
                ref={virtuosoRef}
                data={rows}
                style={{ height: "min(24rem, 55dvh)" }}
                computeItemKey={(_index, row) =>
                    row.kind === "heading" ? `heading:${row.label}` : recipientValue(row.recipient)
                }
                itemContent={(_index, row) =>
                    row.kind === "heading" ? (
                        <p className="flex items-end px-2 py-1 text-sm-medium text-ink-gray-4">{row.label}</p>
                    ) : (
                        <RecipientRow
                            row={row}
                            selected={selectedValue === recipientValue(row.recipient)}
                            onSelect={onSelect}
                        />
                    )
                }
                components={{
                    EmptyPlaceholder: () => (
                        <p className="flex h-24 items-center justify-center text-base text-ink-gray-4">
                            {_("No channels or people found.")}
                        </p>
                    ),
                }}
            />
        </div>
    )
}

const RecipientRow = ({
    row,
    selected,
    onSelect,
}: {
    row: Extract<Row, { kind: "recipient" }>
    selected: boolean
    onSelect: (recipient: Recipient) => void
}) => {
    const { recipient, secondary } = row
    return (
        // The filter comboboxes' row geometry (taller on mobile for touch), with the
        // trailing check marking the selection the Forward button will act on.
        <button
            type="button"
            onClick={() => onSelect(recipient)}
            aria-pressed={selected}
            className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded px-2 text-lg py-2 md:text-base",
                selected ? "bg-surface-gray-2" : "hover:bg-surface-gray-1",
            )}
        >
            {recipient.kind === "channel" ? (
                <ChannelOption channel={recipient.channel} workspaceName={secondary} />
            ) : (
                <UserOption user={recipient.user} secondary={secondary} />
            )}
            {selected && <CheckIcon className="size-4 shrink-0 text-ink-gray-7" />}
        </button>
    )
}

/**
 * Forward a message to ONE channel or person: pick a row, then Forward. The recipient
 * is resolved to a channel id BEFORE the API call — a person becomes their DM channel,
 * created if needed — rather than handing the backend a `type: "User"` receiver. The
 * backend supports that and creates the DM itself, but it returns only "messages
 * forwarded", so the client would have no id to offer a "View" link to.
 *
 * Nothing is applied to the destination's message store: you're almost never looking at
 * the channel you forwarded into, and where you are, the `message_created` realtime
 * event delivers the copy on the same path as any other incoming message.
 *
 * Mounted once by MessageActionDialogs and driven by messageDialogAtom; stays mounted
 * (open toggles) so it animates closed, with `message` held from the last target so the
 * body doesn't flash empty mid-animation. The LIST resets itself: the shell unmounts
 * its content when closed, so every open starts with a fresh search and scroll.
 */
export const ForwardMessageDialog = ({
    open,
    message,
    onClose,
}: {
    open: boolean
    message: Message | null
    onClose: () => void
}) => {
    const navigate = useNavigate()
    const { createDM } = useCreateDM()
    const { call: forwardMessage } = useFrappePostCall("raven.api.raven_message.forward_message")

    const [recipient, setRecipient] = useState<Recipient | null>(null)
    const [sending, setSending] = useState(false)

    // Clear the picked recipient whenever the dialog (re)opens. It stays mounted for
    // the close animation, so this can't live in useState initialisation — without it
    // the next forward opens pre-filled with the last one's destination.
    useEffect(() => {
        if (!open) return
        setRecipient(null)
        setSending(false)
    }, [open, message?.name])

    const onForward = async () => {
        if (!message || !recipient || sending) return
        setSending(true)

        // A person resolves to their DM channel — existing ones cost no API call.
        const destination =
            recipient.kind === "channel"
                ? recipient.channel.name
                : await createDM(recipient.user.name, { navigate: false })

        // createDM already toasted its own failure; keep the dialog open so Forward can
        // be retried with the recipient still picked.
        if (!destination) {
            setSending(false)
            return
        }

        const target =
            recipient.kind === "channel"
                ? `/${encodeURIComponent(recipient.channel.workspace ?? "")}/${encodeURIComponent(destination)}`
                : `/dm-channel/${encodeURIComponent(destination)}`

        forwardMessage({
            message_receivers: [{ type: "Channel", name: destination }],
            // The server builds the copy from the message id — including every
            // member when the message is part of a batch (an album + caption).
            message_id: message.name,
        })
            .then(() => {
                onClose()
                toast.success(_("Message forwarded"), {
                    action: { label: _("View"), onClick: () => navigate(target) },
                })
            })
            .catch((error) => {
                errorResponseToast(_("Could not forward message"), error)
            })
            .finally(() => setSending(false))
    }

    return (
        // Desktop dialog, mobile bottom sheet — the same shell as the attach and
        // run-action dialogs.
        <ResponsiveDialog open={open} onClose={onClose}>
            <ResponsiveDialogHeader
                title={_("Forward message")}
                // A batch member forwards its whole album — say so, since the dialog
                // was opened from just one of its attachments.
                description={
                    message?.message_batch_id
                        ? _("All attachments sent together will be forwarded.")
                        : _("Choose where to forward this message.")
                }
            />

            <RecipientList selected={recipient} onSelect={setRecipient} sourceChannelID={message?.channel_id} />

            {/* Mobile: stacked, primary on TOP — the thumb finds Forward first and
                Cancel can't be fat-fingered on the way to it. DOM keeps Cancel first
                for the desktop row (Cancel left of Forward), so the mobile order flips
                via order-first. */}
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" size="md" onClick={onClose} disabled={sending}>
                    {_("Cancel")}
                </Button>
                {/* The button names the destination — "Forward to #general", "Forward to
                    Sarah" — so the confirmation reads as the whole sentence of what's
                    about to happen. First name only for people: the row above already
                    showed the full name, and the button has limited width.
                    min-w-0 + truncate so a long channel name shortens instead of
                    stretching the footer. */}
                <Button
                    variant="solid"
                    size="md"
                    onClick={onForward}
                    disabled={!recipient}
                    loading={sending}
                    loadingText={_("Forwarding")}
                    className="min-w-0 max-sm:order-first"
                >
                    <span className="truncate">
                        {recipient
                            ? _("Forward to {0}", [
                                recipient.kind === "channel"
                                    ? `#${recipient.channel.channel_name ?? recipient.channel.name}`
                                    : recipient.user.first_name || recipient.user.full_name || recipient.user.name,
                            ])
                            : _("Forward")}
                    </span>
                </Button>
            </DialogFooter>
        </ResponsiveDialog>
    )
}
