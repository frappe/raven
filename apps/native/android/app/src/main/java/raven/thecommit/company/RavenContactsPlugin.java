package raven.thecommit.company;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.provider.ContactsContract.CommonDataKinds.Email;
import android.provider.ContactsContract.CommonDataKinds.Phone;
import android.provider.ContactsContract.CommonDataKinds.Photo;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import org.json.JSONObject;

/** Contact picker and new-contact screen; the picker grants read access to the one row it returns. */
@CapacitorPlugin(name = "RavenContacts")
public class RavenContactsPlugin extends Plugin {
    // Android has no combined picker: the user chooses phone or email first.
    @PluginMethod
    public void pickContact(PluginCall call) {
        boolean email = "email".equals(call.getString("field"));
        Uri uri = email ? Email.CONTENT_URI : Phone.CONTENT_URI;
        try {
            startActivityForResult(call, new Intent(Intent.ACTION_PICK, uri), "pickResult");
        } catch (Exception e) {
            call.reject("No app can pick a contact");
        }
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.resolve(new JSObject());
            return;
        }
        JSObject ret = new JSObject();
        try {
            JSObject contact = readPicked(call.getString("field"), data.getData());
            if (contact != null) ret.put("contact", contact);
        } catch (Exception e) {
            // A failed read is not a cancel: the web side tells the user to try again.
            call.reject("Could not read the contact");
            return;
        }
        call.resolve(ret);
    }

    private JSObject readPicked(String field, Uri uri) {
        boolean email = "email".equals(field);
        String valueColumn = email ? Email.ADDRESS : Phone.NUMBER;
        String typeColumn = email ? Email.TYPE : Phone.TYPE;
        String labelColumn = email ? Email.LABEL : Phone.LABEL;
        String[] projection = { ContactsContract.Data.DISPLAY_NAME, valueColumn, typeColumn, labelColumn };
        try (Cursor cursor = getContext().getContentResolver().query(uri, projection, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) return null;
            String value = cursor.getString(cursor.getColumnIndexOrThrow(valueColumn));
            if (value == null || value.isEmpty()) return null;
            int type = cursor.getInt(cursor.getColumnIndexOrThrow(typeColumn));
            String customLabel = cursor.getString(cursor.getColumnIndexOrThrow(labelColumn));
            JSObject item = new JSObject();
            item.put("value", value);
            item.put("label", typeLabel(email, type, customLabel));
            JSArray fields = new JSArray();
            fields.put(item);
            JSObject contact = new JSObject();
            contact.put("name", cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.Data.DISPLAY_NAME)));
            contact.put(email ? "emails" : "phones", fields);
            return contact;
        }
    }

    private String typeLabel(boolean email, int type, String customLabel) {
        CharSequence label = email
            ? Email.getTypeLabel(getContext().getResources(), type, customLabel)
            : Phone.getTypeLabel(getContext().getResources(), type, customLabel);
        return label.toString();
    }

    // The insert intent carries every phone and email, plus the photo when the message has one.
    @PluginMethod
    public void saveContact(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_INSERT, ContactsContract.Contacts.CONTENT_URI);
        intent.putExtra(ContactsContract.Intents.Insert.NAME, call.getString("name", ""));
        // Return to Raven after Save instead of staying on the new contact.
        intent.putExtra("finishActivityOnSaveCompleted", true);
        ArrayList<ContentValues> data = new ArrayList<>();
        addAll(data, call.getArray("phones"), false);
        addAll(data, call.getArray("emails"), true);
        addPhoto(data, call.getString("photo"));
        if (!data.isEmpty()) intent.putParcelableArrayListExtra(ContactsContract.Intents.Insert.DATA, data);
        try {
            getActivity().startActivity(intent);
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("Could not open the contact editor");
        }
    }

    private void addAll(ArrayList<ContentValues> data, JSArray fields, boolean email) {
        if (fields == null) return;
        for (int i = 0; i < fields.length(); i++) {
            JSONObject field = fields.optJSONObject(i);
            String value = field == null ? "" : field.optString("value", "");
            if (value.isEmpty()) continue;
            String label = field.optString("label", "");
            int type = email ? emailType(label) : phoneType(label);
            ContentValues row = new ContentValues();
            row.put(ContactsContract.Data.MIMETYPE, email ? Email.CONTENT_ITEM_TYPE : Phone.CONTENT_ITEM_TYPE);
            row.put(email ? Email.ADDRESS : Phone.NUMBER, value);
            row.put(email ? Email.TYPE : Phone.TYPE, type);
            if (type == ContactsContract.CommonDataKinds.BaseTypes.TYPE_CUSTOM) row.put(email ? Email.LABEL : Phone.LABEL, label);
            data.add(row);
        }
    }

    // The server's canonical labels map to Android's own types, so the contacts app shows its translation.
    private int phoneType(String label) {
        switch (label) {
            case "Mobile": return Phone.TYPE_MOBILE;
            case "Home": return Phone.TYPE_HOME;
            case "Work": return Phone.TYPE_WORK;
            case "Main": return Phone.TYPE_MAIN;
            case "", "Other": return Phone.TYPE_OTHER;
            default: return Phone.TYPE_CUSTOM;
        }
    }

    private int emailType(String label) {
        switch (label) {
            case "Home": return Email.TYPE_HOME;
            case "Work": return Email.TYPE_WORK;
            case "", "Other": return Email.TYPE_OTHER;
            default: return Email.TYPE_CUSTOM;
        }
    }

    private void addPhoto(ArrayList<ContentValues> data, String base64) {
        if (base64 == null || base64.isEmpty()) return;
        byte[] bytes;
        try {
            bytes = Base64.decode(base64, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            return;
        }
        ContentValues row = new ContentValues();
        row.put(ContactsContract.Data.MIMETYPE, Photo.CONTENT_ITEM_TYPE);
        row.put(Photo.PHOTO, bytes);
        data.add(row);
    }
}
