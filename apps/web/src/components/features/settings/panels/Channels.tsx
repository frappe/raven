import { Hash } from "@components/common/ChannelIcon/ChannelIcon"
import { PlaceholderPanel } from "./PlaceholderPanel"
import _ from "@lib/translate"

/** Workspace → Channels. TODO: browse/manage every channel in the workspace. */
export const Channels = () => (
    <PlaceholderPanel
        title={_("Channels")}
        description={_("Browse and manage every channel in this workspace.")}
        icon={Hash}
        emptyDescription={_("Browse, archive and manage the channels in this workspace.")}
    />
)

export default Channels
