package net.artinazma.expertassistant;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.app.Activity;
import android.util.Base64;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;
import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "NativeExport")
public class NativeExportPlugin extends Plugin {
    private final AtomicBoolean savingDocument = new AtomicBoolean(false);
    private static final int MAX_JSON_BYTES = 12 * 1024 * 1024;

    private PendingDocumentStore pendingStore() {
        return new PendingDocumentStore(new File(getContext().getCacheDir(), "pending-document-exports"));
    }

    private boolean stageDocument(PluginCall call, byte[] bytes) {
        try {
            String token = pendingStore().stage(bytes, MAX_JSON_BYTES);
            call.getData().put("payloadToken", token);
            call.getData().remove("json");
            call.getData().remove("html");
            call.getData().remove("base64");
            return true;
        } catch (Exception error) {
            savingDocument.set(false);
            call.reject("Could not prepare document storage.");
            return false;
        }
    }

    private void removePending(PluginCall call) {
        pendingStore().remove(call.getString("payloadToken", ""));
    }

    @PluginMethod
    public void getDocumentCapabilities(PluginCall call) {
        JSObject result = new JSObject();
        result.put("protocol", 1);
        result.put("saveJson", true);
        result.put("savePdf", true);
        result.put("saveHtmlDocument", true);
        result.put("saveCertificate", true);
        call.resolve(result);
    }

    @PluginMethod
    public void saveJson(PluginCall call) {
        String json = call.getString("json", "");
        String fileName = call.getString("fileName", "");
        try {
            if (json.isEmpty() || json.length() > MAX_JSON_BYTES || json.getBytes(StandardCharsets.UTF_8).length > MAX_JSON_BYTES
                    || !fileName.matches("[A-Za-z0-9][A-Za-z0-9_.-]{0,90}\\.json")) {
                call.reject("Invalid JSON export.");
                return;
            }
            new JSONObject(json); // JSON object only; never a URL or arbitrary filesystem path.
        } catch (Exception error) {
            call.reject("Invalid JSON export.");
            return;
        }
        if (!savingDocument.compareAndSet(false, true)) {
            call.reject("A document save is already open.");
            return;
        }
        if (!stageDocument(call, json.getBytes(StandardCharsets.UTF_8))) return;
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, fileName);
                startActivityForResult(call, intent, "jsonDocumentChosen");
            } catch (Exception error) {
                savingDocument.set(false);
                removePending(call); call.reject("Could not open document picker.");
            }
        });
    }

    @ActivityCallback
    private void jsonDocumentChosen(PluginCall call, ActivityResult activityResult) {
        finishDocumentSave(call, activityResult, "json");
    }

    @PluginMethod
    public void savePdf(PluginCall call) {
        String encoded = call.getString("base64", "");
        String fileName = call.getString("fileName", "");
        try {
            if (!fileName.matches("[A-Za-z0-9][A-Za-z0-9_.-]{0,90}\\.pdf") || encoded.length() > 6990508) throw new IllegalArgumentException();
            validatePdf(Base64.decode(encoded, Base64.DEFAULT));
        } catch (Exception error) { call.reject("Invalid PDF export."); return; }
        if (!savingDocument.compareAndSet(false, true)) { call.reject("A document save is already open."); return; }
        if (!stageDocument(call, Base64.decode(encoded, Base64.DEFAULT))) return;
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/pdf");
                intent.putExtra(Intent.EXTRA_TITLE, fileName);
                startActivityForResult(call, intent, "pdfDocumentChosen");
            } catch (Exception error) { savingDocument.set(false); removePending(call); call.reject("Could not open document picker."); }
        });
    }

    private static void validatePdf(byte[] bytes) {
        if (bytes.length < 5 || bytes.length > 5 * 1024 * 1024 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F' || bytes[4] != '-') throw new IllegalArgumentException();
    }

    @ActivityCallback
    private void pdfDocumentChosen(PluginCall call, ActivityResult activityResult) {
        finishDocumentSave(call, activityResult, "pdf");
    }

    @PluginMethod
    public void saveHtmlDocument(PluginCall call) {
        String html = call.getString("html", "");
        String fileName = call.getString("fileName", "");
        if (html.trim().isEmpty() || html.length() > MAX_JSON_BYTES || html.getBytes(StandardCharsets.UTF_8).length > MAX_JSON_BYTES || !fileName.matches("[A-Za-z0-9][A-Za-z0-9_.-]{0,90}\\.html")) {
            call.reject("Invalid HTML document."); return;
        }
        if (!savingDocument.compareAndSet(false, true)) { call.reject("A document save is already open."); return; }
        if (!stageDocument(call, html.getBytes(StandardCharsets.UTF_8))) return;
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("text/html");
                intent.putExtra(Intent.EXTRA_TITLE, fileName);
                startActivityForResult(call, intent, "htmlDocumentChosen");
            } catch (Exception error) { savingDocument.set(false); removePending(call); call.reject("Could not open document picker."); }
        });
    }

    @ActivityCallback
    private void htmlDocumentChosen(PluginCall call, ActivityResult activityResult) {
        finishDocumentSave(call, activityResult, "html");
    }

    @PluginMethod
    public void saveCertificate(PluginCall call) {
        String encoded = call.getString("base64", "");
        String fileName = call.getString("fileName", "");
        String mime = call.getString("mime", "");
        try {
            if (fileName.trim().isEmpty() || fileName.length() > 200 || encoded.isEmpty() || encoded.length() > 1398104 || encoded.length() % 4 != 0 || !encoded.matches("[A-Za-z0-9+/]*={0,2}")) throw new IllegalArgumentException();
            for (int i = 0; i < fileName.length(); i++) {
                char c = fileName.charAt(i);
                if (c == '/' || c == '\\' || c < 32) throw new IllegalArgumentException();
            }
            validateCertificate(Base64.decode(encoded, Base64.DEFAULT), mime);
        } catch (Exception error) { call.reject("Invalid certificate file."); return; }
        if (!savingDocument.compareAndSet(false, true)) { call.reject("A document save is already open."); return; }
        if (!stageDocument(call, Base64.decode(encoded, Base64.DEFAULT))) return;
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(mime);
                intent.putExtra(Intent.EXTRA_TITLE, fileName);
                startActivityForResult(call, intent, "certificateDocumentChosen");
            } catch (Exception error) { savingDocument.set(false); removePending(call); call.reject("Could not open document picker."); }
        });
    }

    private static void validateCertificate(byte[] bytes, String mime) {
        int[] signature;
        if ("application/pdf".equals(mime)) signature = new int[]{37, 80, 68, 70, 45};
        else if ("image/png".equals(mime)) signature = new int[]{137, 80, 78, 71, 13, 10, 26, 10};
        else if ("image/jpeg".equals(mime)) signature = new int[]{255, 216, 255};
        else throw new IllegalArgumentException();
        if (bytes.length < signature.length || bytes.length > 1024 * 1024) throw new IllegalArgumentException();
        for (int i = 0; i < signature.length; i++) if ((bytes[i] & 255) != signature[i]) throw new IllegalArgumentException();
    }

    @ActivityCallback
    private void certificateDocumentChosen(PluginCall call, ActivityResult activityResult) {
        finishDocumentSave(call, activityResult, "certificate");
    }

    private void finishDocumentSave(PluginCall call, ActivityResult activityResult, String format) {
        if (call == null) { savingDocument.set(false); return; }
        savingDocument.set(true); // A restored callback starts in a newly created plugin instance.
        if (activityResult.getResultCode() != Activity.RESULT_OK) {
            savingDocument.set(false);
            removePending(call);
            JSObject result = new JSObject(); result.put("status", "cancelled"); call.resolve(result);
            return;
        }
        Uri uri = activityResult.getData() == null ? null : activityResult.getData().getData();
        if (uri == null || !"content".equals(uri.getScheme())) {
            savingDocument.set(false); removePending(call); call.reject("No document destination returned."); return;
        }
        getBridge().execute(() -> {
            try {
                byte[] bytes = pendingStore().read(call.getString("payloadToken", ""), MAX_JSON_BYTES);
                if ("pdf".equals(format)) validatePdf(bytes);
                else if ("certificate".equals(format)) validateCertificate(bytes, call.getString("mime", ""));
                else if (bytes.length == 0 || bytes.length > MAX_JSON_BYTES) throw new IllegalArgumentException();
                try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (stream == null) throw new IllegalStateException();
                    stream.write(bytes);
                    stream.flush();
                }
                JSObject result = new JSObject(); result.put("status", "saved"); result.put("uri", uri.toString()); call.resolve(result);
            } catch (Exception error) {
                call.reject("Could not save document.");
            } finally {
                removePending(call);
                savingDocument.set(false);
            }
        });
    }

    @PluginMethod
    public void saveHtml(PluginCall call) {
        String html = call.getString("html", "");
        String fileName = sanitizeFileName(call.getString("fileName", "artinazma-chat.html"));

        if (html.isEmpty()) {
            call.reject("Empty export content.");
            return;
        }

        try {
            Uri uri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, "text/html");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    call.reject("Could not create download file.");
                    return;
                }
                try (OutputStream stream = resolver.openOutputStream(uri)) {
                    if (stream == null) {
                        call.reject("Could not open download file.");
                        return;
                    }
                    stream.write(html.getBytes(StandardCharsets.UTF_8));
                }
            } else {
                File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloads.exists() && !downloads.mkdirs()) {
                    call.reject("Could not access Downloads folder.");
                    return;
                }
                File file = new File(downloads, fileName);
                try (FileOutputStream stream = new FileOutputStream(file)) {
                    stream.write(html.getBytes(StandardCharsets.UTF_8));
                }
                uri = Uri.fromFile(file);
            }

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not save export file.", error);
        }
    }

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html", "");
        String jobName = sanitizeFileName(call.getString("fileName", "artinazma-chat")).replace(".html", "");

        if (html.isEmpty()) {
            call.reject("Empty export content.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = new WebView(getContext());
                webView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        try {
                            PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                            printManager.print(
                                    jobName,
                                    adapter,
                                    new PrintAttributes.Builder()
                                            .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                            .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                            .build()
                            );
                            call.resolve();
                        } catch (Exception error) {
                            call.reject("Could not open print dialog.", error);
                        }
                    }
                });
                webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception error) {
                call.reject("Could not prepare print view.", error);
            }
        });
    }

    @PluginMethod
    public void shareHtml(PluginCall call) {
        String html = call.getString("html", "");
        String fileName = sanitizeFileName(call.getString("fileName", "artinazma-chat.html"));

        if (html.isEmpty()) {
            call.reject("Empty export content.");
            return;
        }

        try {
            File file = new File(getContext().getCacheDir(), fileName);
            try (FileOutputStream stream = new FileOutputStream(file)) {
                stream.write(html.getBytes(StandardCharsets.UTF_8));
            }

            Uri uri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    file
            );

            android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_SEND);
            intent.setType("text/html");
            intent.putExtra(android.content.Intent.EXTRA_STREAM, uri);
            intent.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(android.content.Intent.createChooser(intent, "Share export"));
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not share export file.", error);
        }
    }

    private String sanitizeFileName(String value) {
        String clean = value == null ? "artinazma-chat.html" : value;
        clean = clean.replaceAll("[\\\\/:*?\"<>|]+", "-").replaceAll("\\s+", "-");
        if (!clean.endsWith(".html")) {
            clean = clean + ".html";
        }
        return clean.length() > 96 ? clean.substring(0, 91) + ".html" : clean;
    }
}
