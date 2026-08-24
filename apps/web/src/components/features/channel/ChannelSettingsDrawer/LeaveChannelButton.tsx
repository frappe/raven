import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import _ from "@lib/translate";
import {
  ChannelList,
  ChannelListItem,
} from "@raven/types/common/ChannelListItem";
import { ChannelIcon } from "@components/common/ChannelIcon/ChannelIcon";
import { PrefActionRow } from "@components/features/profile/PrefRows";
import { useLeaveChannel } from "@hooks/useLeaveChannel";

export interface LeaveChannelButtonProps {
  channel: ChannelListItem;
  disabled?: boolean;
}

export function LeaveChannelButton({ channel }: LeaveChannelButtonProps) {
  const navigate = useNavigate();
  const { leaveChannel, loading, error } = useLeaveChannel(channel.name);

  const handleLeaveChannel = () => {
    leaveChannel().then(() => {
      toast(_("You have left the channel"));
      navigate(`/${channel.workspace}`);
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <PrefActionRow
          label={_("Leave channel")}
          description={
            channel.type === "Private"
              ? _("You'll need an invite to rejoin this channel")
              : _("You can rejoin this channel at any time")
          }
          destructive
        />
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            <span className="inline-flex items-center gap-1">
              <span>{_("Leave")}</span>
              <ChannelIcon
                type={channel.type}
                className="w-4 h-4 translate-y-px"
              />
              <span>{channel.channel_name}?</span>
            </span>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-1">
              {error ? <ErrorBanner error={error} /> : null}
              {channel.type === "Private" ? (
                <p>
                  {_(
                    "When you leave this channel, you’ll no longer be able to see any of its messages. To rejoin, you’ll need to be invited.",
                  )}
                </p>
              ) : (
                <p>
                  {_(
                    "When you leave this channel, you’ll no longer be able to send anymore messages, you will have to rejoin the channel to continue participation.",
                  )}
                </p>
              )}
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
            disabled={loading}
            onClick={handleLeaveChannel}
            aria-label={_("Leave {0}?", [channel.channel_name])}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-ink-gray-8/80 aria-hidden" />
                {_("Leaving")}
              </>
            ) : (
              _("Leave")
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
