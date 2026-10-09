package raven.thecommit.company;

import android.app.Activity;
import android.app.Dialog;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * The site's sign-in page in a web view the app owns, for OAuth (contract:
 * apps/web/src/native/auth.ts). A custom tab keeps the site's cookies, which
 * would sign the same account in again with no way to choose another.
 *
 * The session it leaves behind goes with it: the app's requests share this cookie
 * jar, and the site answers a cookie-authenticated POST with a CSRF error.
 */
final class AuthorizeSession {

    /** The redirect the site came back with, or null when the page was closed first. */
    interface Result {
        void onFinished(String callbackUrl);
    }

    static void start(Activity activity, String url, String redirect, Result result) {
        clearCookies();
        WebView web = new WebView(activity);
        WebSettings settings = web.getSettings();
        // The login page is an app: it renders and posts credentials with script.
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // A sign-in page needs the web and nothing else: no files of this device, no whereabouts.
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setGeolocationEnabled(false);
        Dialog dialog = new Dialog(activity, android.R.style.Theme_DeviceDefault_NoActionBar);
        // The redirect is kept, not reported: closing the page is the one place the result is told,
        // and the back button closes it too.
        String[] callback = new String[1];
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String target = request.getUrl().toString();
                if (target.startsWith(redirect)) {
                    callback[0] = target;
                    dialog.dismiss();
                    return true;
                }
                // The site and whoever it signs in with, over the web; a scheme that leaves for
                // another app is refused.
                String scheme = request.getUrl().getScheme();
                return !"https".equals(scheme) && !"http".equals(scheme);
            }
        });
        dialog.setContentView(web, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        dialog.setOnDismissListener(d -> {
            web.destroy();
            clearCookies();
            result.onFinished(callback[0]);
        });
        dialog.show();
        web.loadUrl(url);
    }

    /** Every site's, because the app authenticates with tokens and keeps nothing in a cookie. */
    private static void clearCookies() {
        CookieManager cookies = CookieManager.getInstance();
        cookies.removeAllCookies(null);
        cookies.flush();
    }

    private AuthorizeSession() {}
}
