package raven.thecommit.company;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.service.notification.StatusBarNotification;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;
import com.getcapacitor.JSObject;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;

/**
 * A message notification: chat-style, with the sender's face per message and a conversation's
 * messages stacked, or, for a workspace with a logo, the standard layout with the logo on the right.
 * Posted by the notification service, and by the page for a push from another saved site.
 */
final class ConversationNotification {
    private ConversationNotification() {}

    // Runs on the notification service's thread; the avatar download blocks it, never the alert.
    static void post(Context context, JSObject options) {
        String tag = options.getString("tag");
        int id = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        // A workspace logo needs the standard layout: the conversation one has no picture on the right.
        String logoUrl = options.getString("logo");
        boolean branded = logoUrl != null && !logoUrl.isEmpty();
        String url = branded ? logoUrl : options.getString("image");
        // Only the conversation layout stacks earlier messages; the standard one replaces them.
        List<NotificationCompat.MessagingStyle.Message> history = branded ? Collections.emptyList() : history(manager, tag);
        Bitmap picture = AvatarCache.cached(context, url);
        show(context, manager, options, tag, id, history, picture, branded, false);
        // A picture that has to be fetched arrives after the notification, and updates it in place.
        if (picture != null || url == null || url.isEmpty()) return;
        Bitmap fetched = AvatarCache.fetch(context, url);
        if (fetched != null) show(context, manager, options, tag, id, history, fetched, branded, true);
    }

    private static void show(
        Context context,
        NotificationManager manager,
        JSObject options,
        String tag,
        int id,
        List<NotificationCompat.MessagingStyle.Message> history,
        Bitmap picture,
        boolean branded,
        boolean update
    ) {
        String title = options.getString("title", "");
        String body = options.getString("body", "");
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, RavenApplication.MESSAGES_CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher_foreground);
        if (branded) {
            builder.setContentTitle(title)
                .setContentText(body)
                .setSubText(options.getString("site"))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body));
            if (picture != null) builder.setLargeIcon(picture);
        } else {
            // MessagingStyle needs a named device user; only the senders' messages are shown.
            NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(new Person.Builder().setName("You").build())
                .setConversationTitle(options.getString("site"))
                .setGroupConversation(true);
            for (NotificationCompat.MessagingStyle.Message message : history) style.addMessage(message);
            Person.Builder sender = new Person.Builder().setName(title);
            Bitmap round = circle(picture);
            if (round != null) sender.setIcon(IconCompat.createWithBitmap(round));
            style.addMessage(body, System.currentTimeMillis(), sender.build());
            builder.setStyle(style);
        }
        builder.setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            // The face arriving must not sound a second time for the same message.
            .setOnlyAlertOnce(update)
            .setContentIntent(tapIntent(context, id, options.getJSObject("data")));
        Notification notification = builder.build();
        // (tag, 0) is the identity FCM posts under, so a tagged post replaces the
        // background entry for the same conversation as well as an earlier re-post.
        manager.notify(tag, tag != null ? 0 : id, notification);
    }

    // Same extras as an FCM tap, so the messaging plugin reports notificationActionPerformed.
    private static PendingIntent tapIntent(Context context, int id, JSObject data) {
        Intent tap = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        tap.putExtra("google.message_id", "raven-" + id);
        if (data != null) {
            for (Iterator<String> keys = data.keys(); keys.hasNext();) {
                String key = keys.next();
                tap.putExtra(key, data.getString(key));
            }
        }
        return PendingIntent.getActivity(context, id, tap, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** The messages already in the tray for this tag, so a new one stacks on them. */
    private static List<NotificationCompat.MessagingStyle.Message> history(NotificationManager manager, String tag) {
        if (tag != null) {
            for (StatusBarNotification shown : manager.getActiveNotifications()) {
                if (!tag.equals(shown.getTag())) continue;
                NotificationCompat.MessagingStyle style = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(shown.getNotification());
                if (style != null) return style.getMessages();
            }
        }
        return Collections.emptyList();
    }

    private static Bitmap circle(Bitmap source) {
        if (source == null) return null;
        int size = Math.min(source.getWidth(), source.getHeight());
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(source, (size - source.getWidth()) / 2f, (size - source.getHeight()) / 2f, paint);
        return out;
    }

}
