package raven.thecommit.company;

import android.content.Context;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

/** Serves <app origin>/_raven_media_/<folder>/<file>?src=<site url>: the bearer goes only to the session's origin. */
final class RavenMediaHandler {
    static final String PATH = "/_raven_media_/";
    static volatile String origin = "";
    static volatile String token = "";
    private static volatile String mediaRoot;

    static WebResourceResponse handle(Context context, WebResourceRequest request) {
        Uri uri = request.getUrl();
        String path = uri.getPath();
        if (path == null || !path.startsWith(PATH)) return null;
        // Media elements only: as a page, a site file would run on the app's origin with the native bridge.
        if (request.isForMainFrame()) return reject(403, "not a page");
        String[] parts = path.substring(PATH.length()).split("/");
        String src = uri.getQueryParameter("src");
        if (parts.length != 2 || parts[0].isEmpty() || parts[1].isEmpty() || src == null) return reject(400, "bad media path");
        if (origin.isEmpty() || !src.startsWith(origin + "/")) return reject(403, "not the session's site");
        String folder = parts[0], file = parts[1];
        File target = new File(new File(new File(context.getCacheDir(), "media"), folder), file);
        if (!isInsideMedia(context, target)) return reject(400, "bad media path");
        String range = request.getRequestHeaders().get("Range");
        return target.isFile() ? fromDisk(target, range) : fromSite(src, target, range);
    }

    // A complete cached file answers Range itself: video seeking never touches the network.
    private static WebResourceResponse fromDisk(File file, String range) {
        try {
            long length = file.length(), start = 0, end = length - 1;
            if (range != null && range.startsWith("bytes=")) {
                String[] parts = range.substring(6).split("-", 2);
                if (parts[0].isEmpty()) start = Math.max(0, length - Long.parseLong(parts[1]));
                else {
                    start = Long.parseLong(parts[0]);
                    if (parts.length > 1 && !parts[1].isEmpty()) end = Math.min(end, Long.parseLong(parts[1]));
                }
            }
            if (start > end || start >= length) return reject(416, "range not satisfiable");
            Map<String, String> headers = baseHeaders();
            headers.put("Accept-Ranges", "bytes");
            headers.put("Content-Length", String.valueOf(end - start + 1));
            if (range != null) headers.put("Content-Range", "bytes " + start + "-" + end + "/" + length);
            boolean partial = range != null;
            return new WebResourceResponse(inert(mimeOf(file.getName())), null, partial ? 206 : 200, partial ? "Partial Content" : "OK", headers, new RangeStream(new FileInputStream(file), 0, end - start + 1));
        } catch (IOException | NumberFormatException e) {
            return reject(500, "cache read failed");
        }
    }

    // Streams from the site; a full (non-Range) 200 is teed into a part file and renamed when complete.
    private static WebResourceResponse fromSite(String src, File target, String range) {
        try {
            HttpURLConnection connection = (HttpURLConnection) new URL(src).openConnection();
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(30_000);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            if (range != null) connection.setRequestProperty("Range", range);
            int status = connection.getResponseCode();
            if (status >= 400) { connection.disconnect(); return reject(status, "site answered " + status); }
            Map<String, String> headers = baseHeaders();
            for (String name : new String[]{"Content-Length", "Content-Range", "Accept-Ranges", "Cache-Control"}) {
                String value = connection.getHeaderField(name);
                if (value != null) headers.put(name, value);
            }
            String contentType = connection.getContentType();
            String mime = inert(contentType == null ? "application/octet-stream" : contentType.split(";")[0].trim());
            InputStream body = connection.getInputStream();
            if (status == 200 && range == null) body = new TeeStream(body, target);
            // A 206 body already starts at the range's start: those bytes count as skipped.
            if (status == 206) body = new RangeStream(body, rangeStart(connection.getHeaderField("Content-Range")), connection.getContentLengthLong());
            return new WebResourceResponse(mime, null, status, status == 206 ? "Partial Content" : "OK", headers, body);
        } catch (IOException e) {
            return reject(502, "site unreachable");
        }
    }

    private static WebResourceResponse reject(int status, String reason) {
        return new WebResourceResponse("text/plain", "utf-8", status, "Error", new HashMap<>(), new ByteArrayInputStream(reason.getBytes()));
    }

    /** First byte of "bytes <start>-<end>/<total>"; 0 when the header is missing or malformed. */
    private static long rangeStart(String contentRange) {
        try {
            return Long.parseLong(contentRange.substring(contentRange.indexOf(' ') + 1, contentRange.indexOf('-')).trim());
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private static Map<String, String> baseHeaders() {
        Map<String, String> headers = new HashMap<>();
        headers.put("X-Content-Type-Options", "nosniff");
        return headers;
    }

    /** A site file never renders as a document here, whatever type the site reports. */
    private static String inert(String mime) {
        String type = mime.toLowerCase();
        return type.equals("text/html") || type.equals("application/xhtml+xml") ? "text/plain" : mime;
    }

    private static boolean isInsideMedia(Context context, File file) {
        try {
            if (mediaRoot == null) mediaRoot = new File(context.getCacheDir(), "media").getCanonicalPath() + File.separator;
            return file.getCanonicalPath().startsWith(mediaRoot);
        } catch (IOException e) {
            return false;
        }
    }

    private static String mimeOf(String name) {
        String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "";
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime == null ? "application/octet-stream" : mime;
    }

    // The WebView applies the request's Range to the stream it is given: it skips to the start, never stops at the end.
    // `before` bytes are skipped without being read; at most `length` are read (all of them when negative).
    private static final class RangeStream extends InputStream {
        private final InputStream in;
        private long before, length;
        RangeStream(InputStream in, long before, long length) { this.in = in; this.before = before; this.length = length < 0 ? Long.MAX_VALUE : length; }
        @Override public long skip(long n) throws IOException {
            if (before <= 0) return in.skip(n);
            long skipped = Math.min(n, before);
            before -= skipped;
            return skipped;
        }
        // The WebView checks the range against this, so it spans the whole resource.
        @Override public int available() throws IOException { return (int) Math.min(Integer.MAX_VALUE, before + Math.max(length == Long.MAX_VALUE ? 0 : length, in.available())); }
        @Override public int read() throws IOException { if (length <= 0) return -1; int b = in.read(); if (b >= 0) length--; return b; }
        @Override public int read(byte[] buffer, int off, int len) throws IOException {
            if (length <= 0) return -1;
            int read = in.read(buffer, off, (int) Math.min(len, length));
            if (read > 0) length -= read;
            return read;
        }
        @Override public void close() throws IOException { in.close(); }
    }

    /** Copies what the WebView reads into a part file; only a stream read to its end becomes the file. */
    private static final class TeeStream extends InputStream {
        private final InputStream in;
        private final File target, part;
        private final OutputStream out;
        private boolean complete;
        TeeStream(InputStream in, File target) throws IOException {
            this.in = in;
            this.target = target;
            // Own part file per stream: two requests for one file never write into each other.
            this.part = new File(target.getPath() + "." + System.nanoTime() + ".part");
            //noinspection ResultOfMethodCallIgnored
            target.getParentFile().mkdirs();
            this.out = new FileOutputStream(part);
        }
        @Override public int read() throws IOException { int b = in.read(); if (b >= 0) out.write(b); else complete = true; return b; }
        @Override public int read(byte[] buffer, int off, int len) throws IOException {
            int read = in.read(buffer, off, len);
            if (read > 0) out.write(buffer, off, read); else complete = true;
            return read;
        }
        @Override public void close() throws IOException {
            in.close();
            out.close();
            //noinspection ResultOfMethodCallIgnored
            if (!complete || !part.renameTo(target)) part.delete();
        }
    }
}
