import { useContext } from "react";
import useCurrentRavenUser from "@raven/lib/hooks/useCurrentRavenUser";
import { RavenChannelMember } from "@raven/types/RavenChannelManagement/RavenChannelMember";
import { channelStore } from "@stores/channels/store";
import { channelMembersStore, type MemberMeta } from "@stores/members/store";
import { loadChannelMembers } from "@hooks/useChannelMembers";
import { FrappeConfig, FrappeContext, useFrappeCreateDoc } from "frappe-react-sdk";

export const useJoinChannel = (channelID: string) => {
  const { createDoc, error, loading } = useFrappeCreateDoc();
  const { myProfile } = useCurrentRavenUser();
  const { call } = useContext(FrappeContext) as FrappeConfig;

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

      // Write our membership into the member store right away. The join
      // banner reads that store, and this response already proves we are a
      // member — no need to wait for a refetch.
      //
      // Why it exists: the refetch below can race the join on the server and
      // get the OLD member list back (a cached copy from just before the
      // join saved — see delete_channel_members_cache). When that happened,
      // the banner stayed and a second click errored with "already a member".
      const selfMeta: MemberMeta = { is_admin: 0, channel_member_name: result.name };
      channelMembersStore.upsertMember(result.channel_id, result.user_id, selfMeta);

      // Refresh the full member list too. Add ourselves again once it lands:
      // if the refetch brought back that stale pre-join list, it would
      // silently remove us and the banner would come back.
      loadChannelMembers(call, result.channel_id, true)?.finally(() =>
        channelMembersStore.upsertMember(result.channel_id, result.user_id, selfMeta),
      );
    });
  };
  return { joinChannel, error, loading };
};
