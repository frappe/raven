package raven.thecommit.company;

import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RavenShellPlugin.class);
        // A share only ever arrives as a fresh launch or onNewIntent. A recreated
        // activity (process death, Recents) gets the task's root SEND intent again;
        // drop it, or the share the user already sent replays.
        Intent launch = getIntent();
        boolean fromHistory = launch != null && (launch.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0;
        if (RavenShellPlugin.isShare(launch) && (savedInstanceState != null || fromHistory)) setIntent(new Intent());
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Theme changed in-app: uiMode is in configChanges, so AppCompat delivers the
        // switch through onConfigurationChanged instead of recreating the activity
        // (a recreate reloads the WebView from the shell URL and loses the page).
        RavenApplication.applyStoredNightMode(this);
        paintCanvas();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // AppCompat's synthetic night-mode change reaches the activity but not the
        // view tree; forward it so the WebView re-resolves prefers-color-scheme.
        getBridge().getWebView().dispatchConfigurationChanged(newConfig);
        paintCanvas();
    }

    // Theme-aware canvas behind the page, from a day/night resource.
    private void paintCanvas() {
        int background = getResources().getColor(R.color.shell_background, getTheme());
        getBridge().getWebView().setBackgroundColor(background);
        getWindow().getDecorView().setBackgroundColor(background);
    }
}
