import { useAtomValue } from "jotai"
import ChannelMembersDrawer from "./ChannelMembersDrawer/ChannelMembersDrawer"
import ChannelSettingsDrawer from "./ChannelSettingsDrawer/ChannelSettingsDrawer"
import { channelDrawerAtom, type DrawerType } from "@utils/channelAtoms"
import { useCurrentChannelID } from "@hooks/useCurrentChannelID"
import { useChannel } from "@hooks/useChannel"
import { useUser } from "@hooks/useUser"

const SETTINGS_DRAWER_TYPES: DrawerType[] = ["settings", "files", "links", "threads", "pins"]

/**
 * The single owner of the channel drawer's content. Reads `channelDrawerAtom`
 * and renders the matching drawer — members, or the settings tabs (which show
 * the peer's profile instead of channel info inside a DM).
 *
 * ChatContentView decides WHERE this renders (side rail or bottom sheet);
 * this component decides WHAT renders. Pages don't participate at all.
 */
const ChannelContextDrawer = () => {
    const channelID = useCurrentChannelID()
    const drawerType = useAtomValue(channelDrawerAtom(channelID))
    const { dmChannel } = useChannel(channelID)
    const peerUser = useUser(dmChannel?.peer_user_id ?? "")

    if (drawerType === "members") return <ChannelMembersDrawer />
    if (SETTINGS_DRAWER_TYPES.includes(drawerType)) {
        return <ChannelSettingsDrawer peerUser={peerUser ?? undefined} />
    }
    return null
}

export default ChannelContextDrawer
