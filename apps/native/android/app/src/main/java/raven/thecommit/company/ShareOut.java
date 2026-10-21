package raven.thecommit.company;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import java.io.File;

/** Builds the share-out chooser for a cached file, sent as a content stream. */
final class ShareOut {
    private ShareOut() {}

    static Intent chooser(Context context, JSObject options) {
        Intent send = new Intent(Intent.ACTION_SEND);
        String uri = options.getString("uri", "");
        Uri content = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", new File(Uri.parse(uri).getPath()));
        String type = options.getString("type");
        if (type == null) type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(MimeTypeMap.getFileExtensionFromUrl(uri).toLowerCase());
        send.setType(type != null ? type : "application/octet-stream");
        send.putExtra(Intent.EXTRA_STREAM, content);
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        send.putExtra(Intent.EXTRA_SUBJECT, options.getString("title", ""));
        Intent chooser = Intent.createChooser(send, options.getString("title", ""));
        // Sharing into Raven itself relaunches this singleTask activity over the chooser.
        chooser.putExtra(Intent.EXTRA_EXCLUDE_COMPONENTS, new ComponentName[] { new ComponentName(context, MainActivity.class) });
        return chooser;
    }
}
