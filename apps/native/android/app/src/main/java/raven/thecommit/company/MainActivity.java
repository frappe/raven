package raven.thecommit.company;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RemoteBridgePlugin.class);
        super.onCreate(savedInstanceState);

    }

    @Override
    public void onResume() {
        super.onResume();
        // Theme changed in-app? AppCompat won't recreate an already-resumed
        // activity on setDefaultNightMode, so force it when the mode changed.
        if (RavenApplication.applyStoredNightMode(this)) recreate();

        // Theme-aware canvas behind the page, from a day/night resource.
        // A theme switch recreates the activity, so this re-resolves on its own.
        int background = getResources().getColor(R.color.shell_background, getTheme());
        getBridge().getWebView().setBackgroundColor(background);
        getWindow().getDecorView().setBackgroundColor(background);
    }
}
