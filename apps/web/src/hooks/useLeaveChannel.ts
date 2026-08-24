import { channelStore } from "@stores/channels/store";
import { useFrappePostCall } from "frappe-react-sdk";

export const useLeaveChannel = (channelID: string) => {
  const { call, loading, error } = useFrappePostCall(
    "raven.api.raven_channel.leave_channel",
  );

  const leaveChannel = async () => {
    return call({ channel_id: channelID }).then(() => {
      // Store, not the SWR cache — see useJoinChannel for why. `leave_channel` deletes
      // the member doc, whose on_trash publishes `channel_list_updated` to this user,
      // so a refetch reconciles right after this optimistic patch.
      channelStore.patchChannel(channelID, { member_id: "" });
    });
  };

  return { leaveChannel, loading, error };
};
