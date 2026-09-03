package raven.thecommit.company;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.reflect.Method;
import java.util.Collections;

/**
 * Capacitor 8 registers its document-start bridge script for the app origin only
 * (Bridge.loadWebView). The shell navigates to remote Raven sites, so the same
 * script is registered here for every origin — matching allowNavigation ["*"].
 * Old WebViews without DOCUMENT_START_SCRIPT keep Capacitor's HTML-rewrite path.
 */
@CapacitorPlugin(name = "RemoteBridge")
public class RemoteBridgePlugin extends Plugin {

    @Override
    public void load() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return;
        Bridge bridge = getBridge();
        // Deferred so every plugin is registered before the script is generated.
        bridge.getWebView().post(() -> register(bridge));
    }

    private void register(Bridge bridge) {
        try {
            Method getInjector = Bridge.class.getDeclaredMethod("getJSInjector");
            getInjector.setAccessible(true);
            Object injector = getInjector.invoke(bridge);
            if (injector == null) return;
            // JSInjector is package-private; reach its script through reflection too.
            Method getScript = injector.getClass().getMethod("getScriptString");
            getScript.setAccessible(true);
            String script = (String) getScript.invoke(injector);
            WebViewCompat.addDocumentStartJavaScript(bridge.getWebView(), script, Collections.singleton("*"));
        } catch (Exception e) {
            Logger.error("RemoteBridge: bridge script not registered for remote origins", e);
        }
    }
}
