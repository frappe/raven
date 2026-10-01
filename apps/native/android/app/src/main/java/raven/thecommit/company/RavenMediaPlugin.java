package raven.thecommit.company;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Session for the media handler, and the media/ cache trim (contract: apps/web/src/native/media.ts). */
@CapacitorPlugin(name = "RavenMedia")
public class RavenMediaPlugin extends Plugin {
    @PluginMethod
    public void setSession(PluginCall call) {
        RavenMediaHandler.origin = call.getString("origin", "");
        RavenMediaHandler.token = call.getString("token", "");
        call.resolve();
    }

    // Nothing goes while the folder fits the budget. Over it, folders outside keep go first (oldest
    // first), then keep from its end: keep is newest message first.
    @PluginMethod
    public void trim(PluginCall call) {
        JSArray keepArray = call.getArray("keep", new JSArray());
        // getLong only accepts a JSON long; a budget that fits an int would read as missing.
        Object rawBudget = call.getData().opt("budgetBytes");
        long budget = rawBudget instanceof Number ? ((Number) rawBudget).longValue() : Long.MAX_VALUE;
        List<String> keep = new ArrayList<>();
        // Folder names are base-36 hashes; anything else would be a path outside the cache.
        try {
            for (int i = 0; i < keepArray.length(); i++) if (keepArray.getString(i).matches("[a-z0-9]+")) keep.add(keepArray.getString(i));
        } catch (Exception ignored) { }
        File media = new File(getContext().getCacheDir(), "media");
        File[] folders = media.listFiles();
        if (folders == null) { call.resolve(); return; }
        Set<String> kept = new HashSet<>(keep);
        long total = 0;
        List<File> others = new ArrayList<>();
        for (File folder : folders) {
            total += size(folder);
            // Notification avatars go last of all, however old: they are small and re-read constantly.
            if (!kept.contains(folder.getName()) && !AvatarCache.FOLDER.equals(folder.getName())) others.add(folder);
        }
        others.sort((a, b) -> Long.compare(a.lastModified(), b.lastModified()));
        for (File folder : others) {
            if (total <= budget) break;
            total -= size(folder);
            delete(folder);
        }
        for (int i = keep.size() - 1; i >= 0 && total > budget; i--) {
            File folder = new File(media, keep.get(i));
            total -= size(folder);
            delete(folder);
        }
        // The faces are reached only after every other cached file has been deleted.
        File avatars = new File(media, AvatarCache.FOLDER);
        if (total > budget) delete(avatars);
        call.resolve();
    }

    private static long size(File file) {
        if (!file.isDirectory()) return file.length();
        long total = 0;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) total += size(child);
        return total;
    }

    private static void delete(File file) {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) delete(child);
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }
}
