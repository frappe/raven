package raven.thecommit.company;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** File download with progress and cancel; the Filesystem plugin's downloadFile has neither. */
@CapacitorPlugin(name = "RavenDownload")
public class RavenDownloadPlugin extends Plugin {
    // Live connections by download id; cancel disconnects, which fails the read at once even when stalled.
    private final Map<String, HttpURLConnection> connections = new ConcurrentHashMap<>();

    // download({ id, url, name, headers }) writes cache/media/<folder>/<file> and resolves { path } when complete.
    // The page names the file but never the location; only http(s) sources are fetched.
    @PluginMethod
    public void download(PluginCall call) {
        String id = call.getString("id", "");
        String name = call.getString("name", "");
        URL url;
        try { url = new URL(call.getString("url", "")); } catch (Exception e) { call.reject("bad url"); return; }
        // name is <folder>/<file>: one level, no traversal.
        if (!name.matches("[^/\\\\.][^/\\\\]*/[^/\\\\.][^/\\\\]*") || !url.getProtocol().matches("https?")) {
            call.reject("bad name or url");
            return;
        }
        File target = new File(new File(getContext().getCacheDir(), "media"), name);
        File part = new File(target.getPath() + ".part");
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(15_000);
                connection.setReadTimeout(30_000);
                connections.put(id, connection);
                JSObject headers = call.getObject("headers", new JSObject());
                for (Iterator<String> keys = headers.keys(); keys.hasNext(); ) {
                    String key = keys.next();
                    connection.setRequestProperty(key, headers.getString(key));
                }
                if (connection.getResponseCode() != 200) throw new Exception("HTTP " + connection.getResponseCode());
                long total = connection.getContentLengthLong(), done = 0, reportedAt = 0;
                target.getParentFile().mkdirs();
                try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(part)) {
                    byte[] buffer = new byte[64 * 1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        done += read;
                        // At most ten events a second keeps the bridge quiet on fast links.
                        long now = System.currentTimeMillis();
                        if (now - reportedAt >= 100 || done == total) { reportedAt = now; progress(id, done, total); }
                    }
                }
                if (!part.renameTo(target)) throw new Exception("rename failed");
                JSObject ret = new JSObject();
                ret.put("path", target.getPath());
                call.resolve(ret);
            } catch (Exception e) {
                //noinspection ResultOfMethodCallIgnored
                part.delete();
                call.reject(connections.containsKey(id) ? (e.getMessage() == null ? "download failed" : e.getMessage()) : "cancelled");
            } finally {
                connections.remove(id);
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        HttpURLConnection connection = connections.remove(call.getString("id", ""));
        if (connection != null) new Thread(connection::disconnect).start();
        call.resolve();
    }

    private void progress(String id, long bytes, long total) {
        JSObject event = new JSObject();
        event.put("id", id);
        event.put("bytes", bytes);
        event.put("total", total);
        notifyListeners("progress", event);
    }
}
