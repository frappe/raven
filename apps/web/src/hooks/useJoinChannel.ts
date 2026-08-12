import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser";
import { RavenChannelMember } from "@raven/types/RavenChannelManagement/RavenChannelMember";
import { channelStore } from "@stores/channels/store";
import { useFrappeCreateDoc } from "frappe-react-sdk";

export const useJoinChannel = (channelID: string) => {
  const { createDoc, error, loading } = useFrappeCreateDoc();
  const { myProfile } = useCurrentRavenUser();

  const joinChannel = async () => {
    return createDoc("Raven Channel Member", {
      channel_id: channelID,
      user_id: myProfile?.name ?? "",
    }).then((result: RavenChannelMember) => {
      // Patch the store directly — consumers read the store, not SWR. This used to
      // hand-edit the `channel_list` SWR cache and depend on useChannelListSync's
      // effect to forward it, which only worked while that hook stayed mounted and
      // silently no-opped when the cache was still cold (the updater fell through and
      // returned undefined, which with `revalidate: false` left the cache empty).
      // The server also publishes `channel_list_updated` to this user, so a real
      // refetch reconciles the store against the truth right after this patch.
      channelStore.patchChannel(result.channel_id, { member_id: result.name });
    });
  };
  return { joinChannel, error, loading };
};
