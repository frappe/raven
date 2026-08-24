import { useNavigate } from "react-router";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useFrappeDeleteDoc, useSWRConfig } from "frappe-react-sdk";
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
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert";
import { PrefActionRow } from "@components/features/profile/PrefRows";
import _ from "@lib/translate";
import {
  ChannelList,
  ChannelListItem,
} from "@raven/types/common/ChannelListItem";
import { Checkbox } from "@components/ui/checkbox";
import { markChannelRemovalExpected } from "@hooks/useRemovedChannelCleanup";

export interface DeleteChannelButtonProps {
  channel: ChannelListItem;
}

export function DeleteChannelButton({ channel }: DeleteChannelButtonProps) {
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const { deleteDoc, loading, error } = useFrappeDeleteDoc();
  const [allowDelete, setAllowDelete] = useState(false);

  const deleteChannel = async () => {
    return deleteDoc("Raven Channel", channel.name).then(() => {
      // Tell the removed-channel reconciler this removal is OURS before the
      // list patch can reach it — its "no longer available" toast is for
      // bystanders, and the actor gets the "deleted" toast below instead.
      // Navigating before the patch also leaves the dead route immediately.
      markChannelRemovalExpected(channel.name);
      navigate(`/${channel.workspace}`);
      mutate(
        "channel_list",
        (data: { message: ChannelList } | undefined) => {
          if (data) {
            return {
              message: {
                ...data.message,
                channels: data.message.channels.filter(
                  (ch) => ch.name !== channel.name,
                ),
              },
            };
          }
        },
        { revalidate: false },
      );
      toast(_("Channel {0} deleted", [channel.channel_name]));
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <PrefActionRow
          label={_("Delete channel")}
          description={_("Permanently delete this channel and all of its messages")}
          destructive
        />
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{_("Delete this channel?")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-1">
              {error ? <ErrorBanner error={error} /> : null}
              <Alert theme="red">
                <AlertTriangle />
                <AlertTitle>
                  {_("This action is permanent and cannot be undone.")}
                </AlertTitle>
              </Alert>
              <p>
                {_(
                  "When you delete a channel, all messages from this channel will be removed immediately.",
                )}
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  {_(
                    "All messages, including files and images will be removed",
                  )}
                </li>
                <li>
                  {_(
                    "You can archive this channel instead to preserve your messages",
                  )}
                </li>
              </ul>
              <label className="flex items-center gap-2 select-none">
                <Checkbox
                  checked={allowDelete}
                  onCheckedChange={(v) => setAllowDelete(Boolean(v))}
                />
                {_("Yes, I understand, permanently delete this channel")}
              </label>
            </div>
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
            loading={loading}
            loadingText={_("Deleting")}
            disabled={!allowDelete || loading}
            onClick={deleteChannel}
            aria-label={_("Delete this channel?")}
          >
            {_("Delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
