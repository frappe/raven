import { useRef, useState } from "react";
import { Edit } from "lucide-react";
import { useForm } from "react-hook-form";
import { useFrappeUpdateDoc, useSWRConfig } from "frappe-react-sdk";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/ui/dialog";
import {
  DrawerActionBar,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerNested,
  DrawerTrigger,
} from "@components/ui/drawer";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@components/ui/tooltip";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@components/ui/form";
import { Button } from "@components/ui/button";
import ErrorBanner from "@components/ui/error-banner";
import { useIsMobile } from "@hooks/use-mobile";
import { useNoDragWhileScrolled } from "@hooks/useNoDragWhileScrolled";
import _ from "@lib/translate";
import {
  ChannelList,
  ChannelListItem,
} from "@raven/types/common/ChannelListItem";
import { RavenChannel } from "@raven/types/RavenChannelManagement/RavenChannel";
import { ChannelNameInput } from "../CreateChannel/ChannelNameInput";
import { ChannelDescriptionInput } from "../CreateChannel/ChannelDescriptionInput";

/** Lets the submit button live OUTSIDE the <form> (action bar / dialog footer). */
const FORM_ID = "edit-channel-form";

type EditChannelFormValues = Pick<ChannelListItem, "channel_name" | "channel_description">;

/**
 * Edit channel name + description. Dialog on desktop; on mobile a NESTED
 * bottom sheet (it opens from inside the channel-settings sheet) with the
 * iOS-style action bar — the keyboard is up the whole time in this form, so
 * Save must live at the top. Open/close flows through vaul's own
 * trigger/close components, or the parent sheet wouldn't scale back (see
 * AddChannelMembers for the long version).
 */
export const EditChannelDescriptionButton = ({
  channel,
}: {
  channel: ChannelListItem;
}) => {
  const isMobile = useIsMobile();
  const noDragProps = useNoDragWhileScrolled();
  const [open, setOpen] = useState(false);
  const { updateDoc, loading, error, reset: resetCall } = useFrappeUpdateDoc();
  const { mutate } = useSWRConfig();

  const form = useForm<EditChannelFormValues>({
    defaultValues: {
      channel_name: channel.channel_name,
      channel_description: channel.channel_description,
    },
  });

  const handleOpenChange = (next: boolean) => {
    // Fresh values every open (the channel may have changed since last time);
    // stale errors don't survive a close.
    if (next) {
      form.reset({
        channel_name: channel.channel_name,
        channel_description: channel.channel_description,
      });
    } else {
      resetCall();
    }
    setOpen(next);
  };

  // Programmatic close (after save) routed through vaul on mobile — see the
  // hidden DrawerClose below.
  const hiddenCloseRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    if (isMobile) hiddenCloseRef.current?.click();
    else handleOpenChange(false);
  };

  const onSubmit = (data: EditChannelFormValues) => {
    updateDoc("Raven Channel", channel.name, {
      channel_name: data.channel_name,
      channel_description: data.channel_description,
    }).then((result: RavenChannel) => {
      mutate(
        "channel_list",
        (cached: { message: ChannelList } | undefined) => {
          if (cached) {
            return {
              message: {
                ...cached.message,
                channels: cached.message.channels.map((ch) =>
                  ch.name === result.name
                    ? {
                      ...ch,
                      channel_name: result.channel_name,
                      channel_description: result.channel_description,
                    }
                    : ch,
                ),
              },
            };
          }
        },
        { revalidate: false },
      );
      toast.success(_("Channel updated"));
      close();
    }).catch(() => {
      // The banner inside the form shows the error; stays open to retry.
    });
  };

  const trigger = (
    <Button variant="ghost" isIconButton aria-label={_("Edit channel name and description")}>
      <Edit />
    </Button>
  );

  const formBody = (
    <Form {...form}>
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        aria-label={_("Edit channel form")}
      >
        {error ? <ErrorBanner error={error} /> : null}
        <FormField
          control={form.control}
          name="channel_name"
          rules={{
            required: _("Please add a channel name"),
            maxLength: {
              value: 50,
              message: _("Channel name cannot be more than 50 characters."),
            },
            minLength: {
              value: 3,
              message: _("Channel name cannot be less than 3 characters."),
            },
            pattern: {
              value: /^[a-zA-Z0-9][a-zA-Z0-9-]*$/,
              message: _(
                "Channel name can only contain letters, numbers and hyphens.",
              ),
            },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{_("Channel Name")}</FormLabel>
              <FormControl>
                <ChannelNameInput
                  value={field.value}
                  onChange={field.onChange}
                  channelType={channel.type as RavenChannel["type"]}
                  disabled={loading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="channel_description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{_("Channel Description")}</FormLabel>
              <FormControl>
                <ChannelDescriptionInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  disabled={loading}
                />
              </FormControl>
              <p className="text-xs text-ink-gray-4 mt-1">
                {_("This is how people will know what this channel is about.")}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );

  if (isMobile) {
    return (
      <DrawerNested open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <DrawerActionBar
            title={_("Edit channel")}
            leading={
              <DrawerClose asChild>
                <Button variant="ghost" size="md" disabled={loading}>
                  {_("Cancel")}
                </Button>
              </DrawerClose>
            }
            trailing={
              <Button
                variant="ghost"
                size="md"
                className="font-semibold"
                type="submit"
                form={FORM_ID}
                loading={loading}
              >
                {_("Save")}
              </Button>
            }
          />
          <DrawerDescription className="sr-only">
            {_("Update the channel name and description")}
          </DrawerDescription>
          {/* Positional no-drag (see useNoDragWhileScrolled): scrolled form scrolls,
              pull from the top dismisses. */}
          <div {...noDragProps} className="overflow-y-auto px-4 pt-2 pb-4">
            {formBody}
          </div>
          {/* Invisible close target for the programmatic close — see close() */}
          <DrawerClose ref={hiddenCloseRef} className="hidden" tabIndex={-1} aria-hidden="true" />
        </DrawerContent>
      </DrawerNested>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{_("Edit")}</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{_("Edit channel details")}</DialogTitle>
          <DialogDescription className="sr-only">
            {_("Update the channel name and description")}
          </DialogDescription>
        </DialogHeader>
        {formBody}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            {_("Cancel")}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            size="md"
            loading={loading}
            loadingText={_("Saving...")}
          >
            {_("Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
