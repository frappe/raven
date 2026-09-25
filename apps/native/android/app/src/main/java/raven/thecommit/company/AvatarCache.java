package raven.thecommit.company;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import com.getcapacitor.Logger;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.Comparator;

/**
 * Sender avatars for notifications, kept in the media cache (RavenMediaPlugin.trim).
 * The same few people send most messages, so each avatar is downloaded once.
 */
final class AvatarCache {
    static final String FOLDER = "avatars";
    // Hundreds of faces at the size stored below, and small beside the media cache around it.
    private static final long BUDGET_BYTES = 8 * 1024 * 1024;
    // A notification icon is ~64dp; decoding a portrait at full size would cost megabytes.
    private static final int ICON_PX = 256;

    private AvatarCache() {}

    /** The avatar already held, without touching the network; null when it is not cached. */
    static Bitmap cached(Context context, String url) {
        if (url == null || url.isEmpty()) return null;
        File file = new File(folder(context), name(url));
        if (!file.exists()) return null;
        // The file's time is its last use, which is what the trim evicts by.
        file.setLastModified(System.currentTimeMillis());
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(file.getPath(), options);
        options.inSampleSize = sampleSize(options);
        options.inJustDecodeBounds = false;
        return BitmapFactory.decodeFile(file.getPath(), options);
    }

    /** Blocks on the download, then holds it for the next notification from this sender. */
    static Bitmap fetch(Context context, String url) {
        if (url == null || url.isEmpty()) return null;
        byte[] bytes = download(url);
        if (bytes == null) return null;
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        options.inSampleSize = sampleSize(options);
        options.inJustDecodeBounds = false;
        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        // A profile photo straight off a phone is megabytes; the icon needs a few kilobytes of it.
        if (bitmap != null) store(context, new File(folder(context), name(url)), bitmap, bytes);
        return bitmap;
    }

    /** Halvings that keep the image at or above the icon's size; the decoder only does powers of two. */
    private static int sampleSize(BitmapFactory.Options bounds) {
        int size = Math.min(bounds.outWidth, bounds.outHeight);
        int sample = 1;
        while (size / (sample * 2) >= ICON_PX) sample *= 2;
        return sample;
    }

    private static File folder(Context context) {
        File folder = new File(new File(context.getCacheDir(), "media"), FOLDER);
        //noinspection ResultOfMethodCallIgnored
        folder.mkdirs();
        return folder;
    }

    /** One file per avatar url; the name is the url's hash, so it carries no path of its own. */
    private static String name(String url) {
        long hash = 5381;
        for (int i = 0; i < url.length(); i++) hash = ((hash * 33) ^ url.charAt(i)) & 0xffffffffL;
        return Long.toString(hash, 36);
    }

    private static void store(Context context, File file, Bitmap bitmap, byte[] original) {
        ByteArrayOutputStream encoded = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.JPEG, 85, encoded);
        // An avatar already smaller than this encoding of it keeps its own bytes.
        byte[] smaller = encoded.size() < original.length ? encoded.toByteArray() : original;
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(smaller);
        } catch (Exception e) {
            Logger.warn("RavenShell: avatar not cached: " + e.getMessage());
            return;
        }
        evictOldest(file.getParentFile());
    }

    /** Least recently used first, so the faces of people writing now are the last to go. */
    private static void evictOldest(File folder) {
        File[] files = folder == null ? null : folder.listFiles();
        if (files == null) return;
        long total = 0;
        for (File file : files) total += file.length();
        if (total <= BUDGET_BYTES) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        for (File file : files) {
            if (total <= BUDGET_BYTES) return;
            total -= file.length();
            //noinspection ResultOfMethodCallIgnored
            file.delete();
        }
    }

    private static byte[] download(String url) {
        try {
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(3000);
            connection.setReadTimeout(3000);
            try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[16 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
                return out.toByteArray();
            }
        } catch (Exception e) {
            Logger.warn("RavenShell: avatar not loaded: " + e.getMessage());
            return null;
        }
    }
}
