import { useState } from "react";
import { ArchiveIcon, ArchiveRestoreIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFrappeUpdateDoc, useSWRConfig } from "frappe-react-sdk";
import { Button } from "@components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@components/ui/alert-dialog";
import ErrorBanner from "@components/ui/error-banner";
import { PrefActionRow } from "@components/features/profile/PrefRows";
import _ from "@lib/translate";
import {
  ChannelList,
  ChannelListItem,
} from "@raven/types/common/ChannelListItem";
import { RavenChannel } from "@raven/types/RavenChannelManagement/RavenChannel";
import { channelStore } from "@stores/channels/store";

export interface ArchiveChannelButtonProps {
  channel: ChannelListItem;
}

export function ArchiveChannelButton({ channel }: ArchiveChannelButtonProps) {
  const { mutate } = useSWRConfig();
  const { updateDoc, loading, error } = useFrappeUpdateDoc();
  // Controlled so success can CLOSE the dialog: nothing navigates anymore
  // (the page flips archived/live in place), and an uncontrolled dialog
  // would stay open — re-rendered against the flipped is_archived, i.e. as
  // the opposite prompt. Errors keep it open for the banner.
  const [open, setOpen] = useState(false);

  const toggleArchiveChannel = async () => {
    return updateDoc("Raven Channel", channel.name, {
      is_archived: channel?.is_archived === 0 ? 1 : 0,
    }).then((result: RavenChannel) => {
      // Patch the STORE directly — the SWR patch below only reaches it a
      // flush later (through useChannelListSync's effect), and the page
      // should flip to its archived read-only state immediately.
      channelStore.patchChannel(channel.name, { is_archived: result.is_archived });
      mutate(
        "channel_list",
        (data: { message: ChannelList } | undefined) => {
          if (data) {
            return {
              message: {
                ...data.message,
                channels: data.message.channels.map((ch) =>
                  ch.name === result.name
                    ? { ...ch, is_archived: result.is_archived }
                    : ch,
                ),
              },
            };
          }
        },
        { revalidate: false },
      );
      if (result.is_archived === 1) {
        toast.success(_(`Channel {0} archived`, [channel.channel_name]), {
          icon: <ArchiveIcon className="size-4" />
        });
      } else {
        toast.success(_(`Channel {0} restored`, [channel.channel_name]), {
          icon: <ArchiveRestoreIcon className="size-4" />
        });
      }
      // No navigation: archived channels remain viewable, so the user stays
      // where they are and the page just turns read-only in place (and turns
      // live again on unarchive).
      setOpen(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <PrefActionRow
          label={
            channel.is_archived === 0
              ? _("Archive channel")
              : _("Unarchive channel")
          }
          description={
            channel.is_archived === 0
              ? _("Close the channel to new messages and hide it from your list")
              : _("Restore the channel and allow new messages again")
          }
        />
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {_("{0} this channel?", [
              channel.is_archived === 0 ? _("Archive") : _("Unarchive"),
            ])}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {channel.is_archived === 0 ? (
              <div className="space-y-4 pt-1">
                {error ? <ErrorBanner error={error} /> : null}
                <p>
                  {_("Please understand that when you archive")}{" "}
                  <strong>{channel.channel_name}</strong>:
                </p>
                <ul className="list-inside list-disc space-y-1">
                  <li>{_("It will be removed from your channel list")}</li>
                  <li>
                    {_("No one will be able to send messages to this channel")}
                  </li>
                </ul>
                <p>
                  {_(
                    "You will still be able to find the channel’s contents via search. And you can always unarchive the channel in the future, if you want.",
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="pt-1">
                  {_("Are you sure you want to unarchive ")}
                  <strong>{channel.channel_name}</strong>?
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {_("Cancel")}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="solid"
            theme="red"
            size="md"
            disabled={loading}
            onClick={toggleArchiveChannel}
            aria-label={_("{0} this channel?", [
              channel.is_archived === 0 ? _("Archive") : _("Unarchive"),
            ])}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-ink-gray-8/80 aria-hidden" />
                {channel.is_archived === 0 ? _("Archiving") : _("Unarchiving")}
              </>
            ) : channel.is_archived === 0 ? (
              _("Archive")
            ) : (
              _("Unarchive")
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
