import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser";
import { RavenUser } from "@raven/types/Raven/RavenUser";
import { DMChannelListItem } from "@raven/types/common/ChannelListItem";
import { FrappeContext, FrappeConfig } from "frappe-react-sdk";
import { useContext, useMemo, useSyncExternalStore } from "react";
import { channelStore } from "@stores/channels/store";
import { useChannelById } from "@stores/channels/useChannelList";

export function useChannel(channelID: string) {
  const { call } = useContext(FrappeContext) as FrappeConfig
  const { myProfile, mutate: mutateUser } = useCurrentRavenUser()

  // One per-channel subscription instead of scanning the whole list — re-renders
  // only when THIS channel changes.
  const found = useChannelById(channelID)
  const isLoading = !useSyncExternalStore(channelStore.subscribe, channelStore.isLoaded)

  const channel = found && !found.is_direct_message ? found : undefined
  const dmChannel =
    found && found.is_direct_message ? (found as DMChannelListItem) : undefined

  const toggleStarChannel = async () => {
    return call
      .post("raven.api.raven_channel.toggle_pinned_channel", {
        channel_id: channelID,
      })
      .then((res: { message: RavenUser }) => {
        if (res.message) {
          mutateUser({ message: res.message }, { revalidate: false })
        }
      })
  }

  const isStarred = useMemo(() => {
    if (myProfile) {
      return myProfile.pinned_channels
        ?.map((pin) => pin.channel_id)
        .includes(channelID)
    } else {
      return false
    }
  }, [channelID, myProfile])

  return {
    channel,
    dmChannel,
    toggleStarChannel,
    isStarred,
    isLoading,
  }
}
