package raven.thecommit.company;

import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.ScriptHandler;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.util.Collections;
import java.util.Locale;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private ScriptHandler insetScript;
    private Insets lastBars;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RavenShellPlugin.class);
        registerPlugin(RavenSocketPlugin.class);
        registerPlugin(RavenDownloadPlugin.class);
        registerPlugin(RavenMediaPlugin.class);
        // A share or notification tap only ever arrives as a fresh launch or onNewIntent.
        // A recreated activity (process death, Recents) gets the task's root intent
        // again; drop it, or the share or tap the user already acted on replays.
        Intent launch = getIntent();
        boolean fromHistory = launch != null && (launch.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0;
        boolean replayable = RavenShellPlugin.isShare(launch) || (launch != null && launch.hasExtra("google.message_id"));
        if (replayable && (savedInstanceState != null || fromHistory)) setIntent(new Intent());
        super.onCreate(savedInstanceState);
        serveMediaProxy();
        publishSystemBarInsets();
    }

    // Media proxy requests are answered here; everything else keeps Capacitor's client.
    private void serveMediaProxy() {
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse media = RavenMediaHandler.handle(getApplicationContext(), request);
                return media != null ? media : super.shouldInterceptRequest(view, request);
            }
        });
    }

    // Edge-to-edge: the page draws under the bars and pads itself with --inset-* (index.css).
    private void publishSystemBarInsets() {
        View host = (View) getBridge().getWebView().getParent();
        int bars = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
        ViewCompat.setOnApplyWindowInsetsListener(host, (v, insets) -> {
            Insets bar = insets.getInsets(bars);
            WindowInsetsCompat consumed = new WindowInsetsCompat.Builder(insets).setInsets(bars, Insets.NONE).build();
            // Insets dispatch for the keyboard too; rewriting root variables restyles the whole page.
            if (bar.equals(lastBars)) return consumed;
            lastBars = bar;
            float density = getResources().getDisplayMetrics().density;
            String script = String.format(Locale.ROOT,
                "document.documentElement.style.cssText+=';--inset-top:%.1fpx;--inset-bottom:%.1fpx;--inset-left:%.1fpx;--inset-right:%.1fpx;'",
                bar.top / density, bar.bottom / density, bar.left / density, bar.right / density);
            WebView webView = getBridge().getWebView();
            // A document-start script carries the values across reloads; the live page is set directly.
            if (insetScript != null) insetScript.remove();
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                String origin = getBridge().getScheme() + "://" + getBridge().getHost();
                insetScript = WebViewCompat.addDocumentStartJavaScript(webView, script, Collections.singleton(origin));
            }
            webView.evaluateJavascript(script, null);
            return consumed;
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        // Theme changed in-app: uiMode is in configChanges, so AppCompat delivers the switch through
        // onConfigurationChanged. A recreated activity would reload the WebView and lose the page.
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

    // Theme-aware canvas behind the page and the transparent system bars. Set on the window:
    // PhoneWindow repaints over one set on the decor view, showing AppCompat's #303030.
    // The WebView stays transparent: Chromium paints its base white while a navigation commits.
    private void paintCanvas() {
        int background = getResources().getColor(R.color.shell_background, getTheme());
        getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
        getWindow().setBackgroundDrawable(new ColorDrawable(background));
    }
}
