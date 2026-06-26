package net.artinazma.expertassistant;

import android.content.ContentResolver;
import android.content.ContentValues;
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

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeExport")
public class NativeExportPlugin extends Plugin {

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
