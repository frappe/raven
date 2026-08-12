import { useState } from "react";
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
} from "@components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import ErrorBanner from "@components/ui/error-banner";
import { PrefRow } from "@components/features/profile/PrefRows";
import _ from "@lib/translate";
import {
  ChannelList,
  ChannelListItem,
} from "@raven/types/common/ChannelListItem";
import { RavenChannel } from "@raven/types/RavenChannelManagement/RavenChannel";
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon";

const CHANNEL_TYPES: RavenChannel["type"][] = ["Public", "Private", "Open"];

const TYPE_LABELS: Record<RavenChannel["type"], string> = {
  Public: _("Public"),
  Private: _("Private"),
  Open: _("Open"),
};

/**
 * "Channel type" as a VALUE row (select), not three "Change to…" action rows:
 * the setting is one value with three states, so show the current state and
 * let picking a new one ask for confirmation. The select stays on the current
 * type until the change is confirmed — cancelling just snaps back.
 */
export function ChannelTypeSelect({ channel }: { channel: ChannelListItem }) {
  const [pendingType, setPendingType] = useState<RavenChannel["type"] | null>(null);
  const { mutate } = useSWRConfig();
  const { updateDoc, loading, error, reset } = useFrappeUpdateDoc();

  const closeDialog = () => {
    setPendingType(null);
    reset();
  };

  const changeChannelType = () => {
    if (!pendingType) return;
    updateDoc("Raven Channel", channel.name, {
      type: pendingType,
    }).then((result: RavenChannel) => {
      mutate(
        "channel_list",
        (data: { message: ChannelList } | undefined) => {
          if (data) {
            return {
              message: {
                ...data.message,
                channels: data.message.channels.map((ch) =>
                  ch.name === result.name ? { ...ch, type: result.type } : ch,
                ),
              },
            };
          }
        },
        { revalidate: false },
      );
      toast.success(_("Channel changed to {0}", [pendingType.toLowerCase()]));
      closeDialog();
    }).catch(() => {
      // The banner inside the dialog shows the error; it stays open to retry.
    });
  };

  return (
    <>
      <PrefRow
        label={_("Channel type")}
        description={_("Who can find and join this channel")}
        control={
          <Select
            value={channel.type}
            onValueChange={(next) => {
              if (next !== channel.type) setPendingType(next as RavenChannel["type"]);
            }}
          >
            <SelectTrigger aria-label={_("Channel type")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNEL_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="py-2.5">
                  <ChannelIcon type={type} className="size-4" />
                  {TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <AlertDialog open={pendingType !== null} onOpenChange={(open) => !open && closeDialog()}>
        <AlertDialogContent className="sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {_("Change to a {0} channel?", [(pendingType ?? "").toLowerCase()])}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-1">
                {error ? <ErrorBanner error={error} /> : null}
                {pendingType === "Public" && (
                  <>
                    <p>
                      {_("Please understand that when you make")}{" "}
                      <strong>{channel.channel_name}</strong>{" "}
                      {_("a public channel:")}
                    </p>
                    <ul className="list-inside list-disc space-y-1">
                      <li>
                        {_(
                          "Anyone from your organisation can join this channel and view its message history.",
                        )}
                      </li>
                      <li>
                        {_(
                          "If you make this channel private, it will be visible to anyone who has joined the channel up until that point.",
                        )}
                      </li>
                    </ul>
                  </>
                )}
                {pendingType === "Private" && (
                  <>
                    <p>
                      {_("Please understand that when you make")}{" "}
                      <strong>{channel.channel_name}</strong>{" "}
                      {_("a private channel:")}
                    </p>
                    <ul className="list-inside list-disc space-y-1">
                      <li>
                        {_(
                          `No changes will be made to the channel's history or members`,
                        )}
                      </li>
                      <li>
                        {_(
                          "All files shared in this channel will become private and will be accessible only to the channel members",
                        )}
                      </li>
                    </ul>
                  </>
                )}
                {pendingType === "Open" && (
                  <>
                    <p>
                      {_("Please understand that when you make")}{" "}
                      <strong>{channel.channel_name}</strong>{" "}
                      {_("a open channel:")}
                    </p>
                    <ul className="list-inside list-disc space-y-1">
                      <li>
                        {_(
                          "Everyone from your organisation will become a channel member and will be able to view its message history.",
                        )}
                      </li>
                      <li>
                        {_(
                          "If you later intend to make this private you will have to manually remove members that should not have access to this channel.",
                        )}
                      </li>
                    </ul>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>{_("Cancel")}</AlertDialogCancel>
            <Button
              type="button"
              size="md"
              onClick={changeChannelType}
              loading={loading}
              loadingText={_("Saving...")}
            >
              {_("Change to {0}", [(pendingType ?? "").toLowerCase()])}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
