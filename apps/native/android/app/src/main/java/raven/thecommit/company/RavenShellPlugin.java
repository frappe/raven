package raven.thecommit.company;

import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.webkit.ScriptHandler;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;

/**
 * Shell glue for the remote Raven pages (contract: packages/lib/utils/ravenShell.ts):
 * navigation gate, bridge injection for saved sites, share intents, per-site cookie clearing.
 */
@CapacitorPlugin(name = "RavenShell")
public class RavenShellPlugin extends Plugin {
    private static final String PREFS = "CapacitorStorage";
    private static final String SITES_KEY = "sites";

    private ScriptHandler scriptHandler;

    @Override
    public void load() {
        Bridge bridge = getBridge();
        // Deferred: Bridge installs its own WebViewClient and finishes plugin
        // registration after load() returns.
        bridge.getWebView().post(() -> {
            bridge.setWebViewClient(new GateWebViewClient(bridge));
            registerBridgeScript();
        });
    }

    // ---- navigation gate -------------------------------------------------------

    private class GateWebViewClient extends BridgeWebViewClient {
        GateWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            // Embeds (sub-frames) and non-web schemes keep Capacitor's default policy.
            if (!blocked(request)) return super.shouldOverrideUrlLoading(view, request);
            openExternally(request.getUrl());
            return true;
        }

        // shouldOverrideUrlLoading is never called for POSTs (a form on a saved site
        // can target any origin), so the same gate runs on the response path too.
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (!blocked(request)) return super.shouldInterceptRequest(view, request);
            openExternally(request.getUrl());
            return new WebResourceResponse("text/plain", "utf-8", 403, "Blocked",
                Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        }
    }

    private boolean blocked(WebResourceRequest request) {
        Uri url = request.getUrl();
        String scheme = url.getScheme();
        boolean web = "http".equals(scheme) || "https".equals(scheme);
        return web && request.isForMainFrame() && !allowedOrigins().contains(origin(url));
    }

    private void openExternally(Uri url) {
        // Called from WebView threads as well; the launch itself is thread-agnostic.
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException ignored) {
            // No browser: dropping the navigation is still safer than loading it here.
        }
    }

    private static String origin(Uri url) {
        String origin = url.getScheme() + "://" + url.getHost();
        return url.getPort() == -1 ? origin : origin + ":" + url.getPort();
    }

    /** Saved sites, as written by apps/native/src/sites.ts through @capacitor/preferences. */
    private Set<String> siteOrigins() {
        Set<String> origins = new HashSet<>();
        String json = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(SITES_KEY, null);
        if (json == null) return origins;
        try {
            JSONArray sites = new JSONArray(json);
            for (int i = 0; i < sites.length(); i++) {
                Uri site = Uri.parse(sites.getJSONObject(i).optString("url", ""));
                if (site.getScheme() != null && site.getHost() != null) origins.add(origin(site));
            }
        } catch (Exception e) {
            Logger.error("RavenShell: unreadable site list", e);
        }
        return origins;
    }

    private Set<String> allowedOrigins() {
        Set<String> origins = siteOrigins();
        origins.add(origin(Uri.parse(getBridge().getLocalUrl())));
        String server = getBridge().getServerUrl();
        if (server != null) origins.add(origin(Uri.parse(server)));
        return origins;
    }

    // ---- bridge on the saved sites --------------------------------------------

    private void registerBridgeScript() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return;
        if (scriptHandler != null) {
            scriptHandler.remove();
            scriptHandler = null;
        }
        // The shell origin is covered by Capacitor's own registration; listing it
        // again would run the bridge script twice there.
        Set<String> origins = siteOrigins();
        if (origins.isEmpty()) return;
        try {
            Bridge bridge = getBridge();
            Method getInjector = Bridge.class.getDeclaredMethod("getJSInjector");
            getInjector.setAccessible(true);
            Object injector = getInjector.invoke(bridge);
            if (injector == null) return;
            // JSInjector is package-private; reach its script through reflection too.
            Method getScript = injector.getClass().getMethod("getScriptString");
            getScript.setAccessible(true);
            String script = (String) getScript.invoke(injector);
            scriptHandler = WebViewCompat.addDocumentStartJavaScript(bridge.getWebView(), script, origins);
        } catch (Exception e) {
            Logger.error("RavenShell: bridge script not registered for the saved sites", e);
        }
    }

    @PluginMethod
    public void syncAllowedOrigins(PluginCall call) {
        getBridge().getWebView().post(() -> {
            registerBridgeScript();
            call.resolve();
        });
    }

    // ---- share intents ----------------------------------------------------------

    static boolean isShare(Intent intent) {
        if (intent == null || intent.getType() == null) return false;
        String action = intent.getAction();
        return Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (!isShare(intent)) return;
        // Warm share: make it readable through getShareIntent() and notify the page.
        getActivity().setIntent(intent);
        notifyListeners("shareReceived", new JSObject(), true);
    }

    @PluginMethod
    public void getShareIntent(PluginCall call) {
        Intent intent = getActivity().getIntent();
        JSObject ret = new JSObject();
        if (isShare(intent)) ret.put("intent", readShare(intent));
        call.resolve(ret);
    }

    @PluginMethod
    public void clearShareIntent(PluginCall call) {
        getActivity().setIntent(new Intent());
        call.resolve();
    }

    private JSObject readShare(Intent intent) {
        JSObject first = readItem(intent, 0);
        JSArray more = new JSArray();
        ClipData clip = intent.getClipData();
        if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction()) && clip != null) {
            for (int i = 1; i < clip.getItemCount(); i++) more.put(readItem(intent, i));
        }
        first.put("additionalItems", more);
        return first;
    }

    /** Same shape as send-intent on iOS: text in description, a file as a file uri in url. */
    @SuppressWarnings("deprecation")
    private JSObject readItem(Intent intent, int index) {
        JSObject item = new JSObject();
        ClipData clip = intent.getClipData();
        Uri uri = clip != null && index < clip.getItemCount() ? clip.getItemAt(index).getUri() : null;
        if (uri == null && index == 0) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        String title = index == 0 ? intent.getStringExtra(Intent.EXTRA_SUBJECT) : null;
        if (title == null && uri != null) title = displayName(uri);
        String text = index == 0 ? intent.getStringExtra(Intent.EXTRA_TEXT) : null;
        if (title != null) item.put("title", title);
        if (text != null) item.put("description", text);
        if (uri != null) {
            // The content URI grant ends with this activity, but the stash may be read
            // by a later process (no site saved yet): copy into our own cache.
            Uri copy = copyToCache(uri, title != null ? title : "shared");
            item.put("url", (copy != null ? copy : uri).toString());
        }
        item.put("type", intent.getType());
        return item;
    }

    private Uri copyToCache(Uri uri, String name) {
        File dir = new File(getContext().getCacheDir(), "shared/" + System.nanoTime());
        if (!dir.mkdirs()) return null;
        File file = new File(dir, name.replace('/', '_'));
        try (InputStream in = getContext().getContentResolver().openInputStream(uri);
             OutputStream out = new FileOutputStream(file)) {
            if (in == null) return null;
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            return Uri.fromFile(file);
        } catch (Exception e) {
            Logger.error("RavenShell: could not copy shared file", e);
            return null;
        }
    }

    private String displayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (column >= 0) return cursor.getString(column);
            }
        } catch (Exception ignored) {
            // Not every provider answers; the path segment below is good enough.
        }
        return uri.getLastPathSegment();
    }

    // ---- cookies ------------------------------------------------------------------

    @PluginMethod
    public void clearSiteCookies(PluginCall call) {
        String url = call.getString("url");
        String host = url == null ? null : Uri.parse(url).getHost();
        if (host == null) {
            call.reject("url required");
            return;
        }
        CookieManager cookies = CookieManager.getInstance();
        String header = cookies.getCookie(url);
        if (header != null) {
            for (String pair : header.split(";")) {
                String name = pair.trim().split("=", 2)[0];
                if (name.isEmpty()) continue;
                // A cookie's identity includes its Domain: expire the host-only form
                // and every parent-domain form a proxy might have set.
                cookies.setCookie(url, name + "=; Max-Age=0; Path=/");
                for (String domain = host; domain.indexOf('.') != -1; domain = domain.substring(domain.indexOf('.') + 1)) {
                    cookies.setCookie(url, name + "=; Max-Age=0; Path=/; Domain=" + domain);
                }
            }
        }
        cookies.flush();
        call.resolve();
    }
}
