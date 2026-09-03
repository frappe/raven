package raven.thecommit.company;

import android.app.Application;
import android.content.Context;
import androidx.appcompat.app.AppCompatDelegate;

// Applies the in-app theme choice (mirrored into Capacitor Preferences by the
// web app) before any activity attaches — set later, AppCompat has already
// resolved day/night for the activity and a cold start stays on system theme.
public class RavenApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        applyStoredNightMode(this);
    }

    /** Also called on every resume; returns true when the mode actually changed. */
    static boolean applyStoredNightMode(Context context) {
        String theme = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).getString("appTheme", null);
        int mode = "dark".equals(theme) ? AppCompatDelegate.MODE_NIGHT_YES
                : "light".equals(theme) ? AppCompatDelegate.MODE_NIGHT_NO
                : AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM;
        if (AppCompatDelegate.getDefaultNightMode() == mode) return false;
        AppCompatDelegate.setDefaultNightMode(mode);
        return true;
    }
}
