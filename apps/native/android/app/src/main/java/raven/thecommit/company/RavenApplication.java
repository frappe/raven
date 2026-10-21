package raven.thecommit.company;

import android.app.Activity;
import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatDelegate;

// Applies the in-app theme choice (mirrored into Capacitor Preferences by the
// web app) before any activity attaches — set later, AppCompat has already
// resolved day/night for the activity and a cold start stays on system theme.
public class RavenApplication extends Application {
    // Shared by FCM (manifest default_notification_channel_id) and RavenShell.showNotification.
    static final String MESSAGES_CHANNEL = "raven_messages";
    // Counted on the main thread by the callbacks below; read on the notification service's thread.
    private static volatile int visibleActivities = 0;

    // Set by the page once its notification listeners are up, and cleared when it stops listening.
    private static volatile boolean pageWatching = false;

    static void setPageWatching(boolean watching) {
        pageWatching = watching;
    }

    /** Whether the page is on screen and listening: it, not the tray, shows what arrives then. */
    static boolean pageHandlesNotifications() {
        return visibleActivities > 0 && pageWatching;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        applyStoredNightMode(this);
        registerActivityLifecycleCallbacks(new ActivityLifecycleCallbacks() {
            @Override
            public void onActivityStarted(Activity activity) {
                visibleActivities++;
            }

            @Override
            public void onActivityStopped(Activity activity) {
                visibleActivities--;
            }

            @Override
            public void onActivityCreated(Activity activity, Bundle state) {}

            @Override
            public void onActivityResumed(Activity activity) {}

            @Override
            public void onActivityPaused(Activity activity) {}

            @Override
            public void onActivitySaveInstanceState(Activity activity, Bundle state) {}

            @Override
            public void onActivityDestroyed(Activity activity) {}
        });
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(NotificationManager.class).createNotificationChannel(
                new NotificationChannel(MESSAGES_CHANNEL, getString(R.string.messages_channel), NotificationManager.IMPORTANCE_HIGH));
        }
    }

    static void applyStoredNightMode(Context context) {
        String theme = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).getString("appTheme", null);
        int mode = "dark".equals(theme) ? AppCompatDelegate.MODE_NIGHT_YES
                : "light".equals(theme) ? AppCompatDelegate.MODE_NIGHT_NO
                : AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM;
        if (AppCompatDelegate.getDefaultNightMode() != mode) AppCompatDelegate.setDefaultNightMode(mode);
    }
}
