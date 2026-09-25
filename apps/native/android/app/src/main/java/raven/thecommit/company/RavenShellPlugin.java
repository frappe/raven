package raven.thecommit.company;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;

/**
 * Shell plugin for the bundled Raven page (contract: apps/web/src/native/shell.ts):
 * foreground notifications for other saved sites, share-out chooser and share intake.
 */
@CapacitorPlugin(name = "RavenShell")
public class RavenShellPlugin extends Plugin {
    // ---- foreground notifications --------------------------------------------------

    // With the app open the page sees every push: it re-posts the ones for another
    // saved site through here, and leaves this site's to the channel it is watching.
    @PluginMethod
    public void showNotification(PluginCall call) {
        // Own thread: the avatar download must not hold up the plugin thread's other calls.
        new Thread(() -> {
            ConversationNotification.post(getContext(), call.getData());
            call.resolve();
        }).start();
    }

    // Until the page says it is listening, a push is drawn here: the seconds before it loads
    // would otherwise pass with nothing shown.
    // Android draws the site as the conversation's header, so the count decides nothing here.
    @PluginMethod
    public void setSiteCount(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void watchNotifications(PluginCall call) {
        RavenApplication.setPageWatching(Boolean.TRUE.equals(call.getBoolean("watching", false)));
        call.resolve();
    }

    // The canvas behind the page follows the app's own theme; launch and resume read the same mirror.
    @PluginMethod
    public void applyTheme(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            RavenApplication.applyStoredNightMode(getContext());
            call.resolve();
        });
    }

    // ---- sign-in -------------------------------------------------------------------

    @PluginMethod
    public void authorize(PluginCall call) {
        String url = call.getString("url"), redirect = call.getString("redirect");
        if (url == null || redirect == null) {
            call.reject("A sign-in needs a url and a redirect");
            return;
        }
        getActivity().runOnUiThread(() -> AuthorizeSession.start(getActivity(), url, redirect, (callbackUrl) -> {
            JSObject result = new JSObject();
            if (callbackUrl != null) result.put("url", callbackUrl);
            else result.put("cancelled", true);
            call.resolve(result);
        }));
    }

    // ---- share out ----------------------------------------------------------------
    // Own chooser so Raven can be excluded from it (the Share plugin cannot), and no
    // result tracking, so nothing is left "in progress" if the chooser never reports back.
    @PluginMethod
    public void share(PluginCall call) {
        getActivity().startActivity(ShareOut.chooser(getContext(), call.getData()));
        call.resolve();
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
        // Warm share (BridgeActivity also routes the launch intent here): expose it to
        // getShareIntent() and notify the page.
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
        // One share at a time: drop the cached copies of the previous one.
        deleteRecursively(new File(getContext().getCacheDir(), "shared"));
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
        if (!isForeignContent(uri)) uri = null;
        String type = uri != null ? getContext().getContentResolver().getType(uri) : null;
        if (type == null) type = intent.getType();
        String title = index == 0 ? intent.getStringExtra(Intent.EXTRA_SUBJECT) : null;
        // A file's title is its name, not the subject: a screenshot's subject has no extension.
        if (uri != null) title = fileName(uri, type);
        String text = index == 0 ? intent.getStringExtra(Intent.EXTRA_TEXT) : null;
        if (title != null) item.put("title", title);
        if (text != null) item.put("description", text);
        if (uri != null) {
            // The content URI grant ends with this activity, but the stash may be read
            // by a later process (no site saved yet): copy into our own cache.
            Uri copy = copyToCache(uri, title);
            item.put("url", (copy != null ? copy : uri).toString());
        }
        item.put("type", type);
        return item;
    }

    /** The provider's name for the file, with an extension from its MIME type when it has none. */
    private String fileName(Uri uri, String type) {
        String name = displayName(uri);
        if (name == null || name.isEmpty()) name = "shared";
        // A known extension only: a name like "Screenshot 7.30 PM" has a dot but no extension.
        MimeTypeMap map = MimeTypeMap.getSingleton();
        int dot = name.lastIndexOf('.');
        if (dot >= 0 && map.hasExtension(name.substring(dot + 1).toLowerCase(Locale.ROOT))) return name;
        String ext = type != null ? map.getExtensionFromMimeType(type) : null;
        return ext == null ? name : name + "." + ext;
    }

    /** The sender picks the uri: a file uri or our own provider would read this app's private files. */
    private boolean isForeignContent(Uri uri) {
        if (uri == null || !ContentResolver.SCHEME_CONTENT.equals(uri.getScheme())) return false;
        String host = uri.getHost();
        return host != null && !host.startsWith(getContext().getPackageName());
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

    private static void deleteRecursively(File file) {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteRecursively(child);
        //noinspection ResultOfMethodCallIgnored
        file.delete();
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
}
