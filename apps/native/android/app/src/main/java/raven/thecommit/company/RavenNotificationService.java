package raven.thecommit.company;

import com.getcapacitor.JSObject;
import com.google.firebase.messaging.RemoteMessage;
import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService;
import java.util.Map;

/**
 * Draws the chat-style notification for a push the site sent without a title, which
 * Android hands to the app instead of drawing itself (raven/notification.py).
 * While the page is listening it decides what to show, so nothing is drawn here.
 */
public class RavenNotificationService extends MessagingService {

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        Map<String, String> data = message.getData();
        String title = data.get("push_title");
        if (title == null || title.isEmpty() || RavenApplication.pageHandlesNotifications()) return;
        JSObject options = new JSObject();
        options.put("title", title);
        options.put("body", data.get("push_body"));
        options.put("site", data.get("sitename"));
        options.put("image", data.get("image"));
        // With a workspace logo the notification leads with it; without one, with the sender's face.
        options.put("logo", data.get("workspace_image"));
        options.put("tag", data.get("tag"));
        JSObject payload = new JSObject();
        for (Map.Entry<String, String> entry : data.entrySet()) payload.put(entry.getKey(), entry.getValue());
        options.put("data", payload);
        ConversationNotification.post(this, options);
    }

}
