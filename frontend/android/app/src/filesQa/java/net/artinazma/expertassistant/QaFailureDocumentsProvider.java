package net.artinazma.expertassistant;

import android.database.Cursor;
import android.database.MatrixCursor;
import android.os.CancellationSignal;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.ProxyFileDescriptorCallback;
import android.os.storage.StorageManager;
import android.system.ErrnoException;
import android.system.OsConstants;
import android.util.Log;
import java.io.IOException;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract.Document;
import android.provider.DocumentsContract.Root;
import android.provider.DocumentsProvider;
import java.io.FileNotFoundException;
import java.util.HashMap;
import java.util.Map;

/** QA variant only: exercises SAF write rejection without reading or writing any file. */
public class QaFailureDocumentsProvider extends DocumentsProvider {
    private static final String ROOT_ID = "qa-failure-root";
    private static final String[] ROOT_IDS = {ROOT_ID, "qa-disk-full", "qa-partial-write"};
    private static final String[] TITLES = {"Artin QA - write failure", "Artin QA - disk full", "Artin QA - partial write"};
    private static final String FILE_ID = "qa-failed-file";
    private static final String[] ROOT_COLUMNS = {Root.COLUMN_ROOT_ID, Root.COLUMN_DOCUMENT_ID,
        Root.COLUMN_TITLE, Root.COLUMN_SUMMARY, Root.COLUMN_FLAGS, Root.COLUMN_MIME_TYPES, Root.COLUMN_ICON};
    private static final String[] DOCUMENT_COLUMNS = {Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME,
        Document.COLUMN_MIME_TYPE, Document.COLUMN_FLAGS, Document.COLUMN_SIZE, Document.COLUMN_LAST_MODIFIED};
    private volatile String fileName = "synthetic-qa-file.json";
    private volatile String fileMime = "application/json";

    @Override public boolean onCreate() { return true; }

    private static void addRow(MatrixCursor cursor, Map<String, Object> values) {
        MatrixCursor.RowBuilder row = cursor.newRow();
        for (String column : cursor.getColumnNames()) row.add(values.get(column));
    }

    @Override public Cursor queryRoots(String[] projection) {
        MatrixCursor cursor = new MatrixCursor(projection == null ? ROOT_COLUMNS : projection);
        for (int i = 0; i < ROOT_IDS.length; i++) {
        Map<String, Object> values = new HashMap<>();
        values.put(Root.COLUMN_ROOT_ID, ROOT_IDS[i]);
        values.put(Root.COLUMN_DOCUMENT_ID, ROOT_IDS[i]);
        values.put(Root.COLUMN_TITLE, TITLES[i]);
        values.put(Root.COLUMN_SUMMARY, "Test only: rejects writes; stores no data");
        values.put(Root.COLUMN_FLAGS, Root.FLAG_SUPPORTS_CREATE | Root.FLAG_LOCAL_ONLY);
        values.put(Root.COLUMN_MIME_TYPES, "*/*");
        values.put(Root.COLUMN_ICON, android.R.drawable.stat_notify_error);
        addRow(cursor, values);
        }
        return cursor;
    }

    @Override public Cursor queryDocument(String documentId, String[] projection) throws FileNotFoundException {
        boolean root = java.util.Arrays.asList(ROOT_IDS).contains(documentId);
        if (!root && !documentId.startsWith(FILE_ID + ":")) throw new FileNotFoundException();
        MatrixCursor cursor = new MatrixCursor(projection == null ? DOCUMENT_COLUMNS : projection);
        Map<String, Object> values = new HashMap<>();
        values.put(Document.COLUMN_DOCUMENT_ID, documentId);
        values.put(Document.COLUMN_DISPLAY_NAME, root ? "Artin QA - write failure" : fileName);
        values.put(Document.COLUMN_MIME_TYPE, root ? Document.MIME_TYPE_DIR : fileMime);
        values.put(Document.COLUMN_FLAGS, root ? Document.FLAG_DIR_SUPPORTS_CREATE : Document.FLAG_SUPPORTS_WRITE);
        values.put(Document.COLUMN_SIZE, 0L);
        values.put(Document.COLUMN_LAST_MODIFIED, 0L);
        addRow(cursor, values);
        return cursor;
    }

    @Override public Cursor queryChildDocuments(String parentId, String[] projection, String sortOrder) throws FileNotFoundException {
        if (!java.util.Arrays.asList(ROOT_IDS).contains(parentId)) throw new FileNotFoundException();
        return new MatrixCursor(projection == null ? DOCUMENT_COLUMNS : projection);
    }

    @Override public String createDocument(String parentId, String mimeType, String displayName) throws FileNotFoundException {
        if (!java.util.Arrays.asList(ROOT_IDS).contains(parentId)) throw new FileNotFoundException();
        fileName = displayName;
        fileMime = mimeType;
        return FILE_ID + ":" + parentId;
    }

    @Override public boolean isChildDocument(String parentId, String documentId) {
        return java.util.Arrays.asList(ROOT_IDS).contains(parentId) && (FILE_ID + ":" + parentId).equals(documentId);
    }

    @Override public ParcelFileDescriptor openDocument(String documentId, String mode, CancellationSignal signal) throws FileNotFoundException {
        if (documentId.equals(FILE_ID + ":" + ROOT_ID)) throw new FileNotFoundException("Intentional QA open rejection");
        if (Build.VERSION.SDK_INT < 26 || (!documentId.equals(FILE_ID + ":qa-disk-full") && !documentId.equals(FILE_ID + ":qa-partial-write"))) throw new FileNotFoundException();
        final boolean full = documentId.endsWith("qa-disk-full");
        HandlerThread worker = new HandlerThread("artin-qa-fault-io");
        worker.start();
        try {
            StorageManager manager = getContext().getSystemService(StorageManager.class);
            return manager.openProxyFileDescriptor(ParcelFileDescriptor.MODE_WRITE_ONLY, new ProxyFileDescriptorCallback() {
                @Override public long onGetSize() { return 0; }
                @Override public int onWrite(long offset, int size, byte[] data) throws ErrnoException {
                    if (full) {
                        Log.i("ArtinQaFault", "ENOSPC simulated at write");
                        throw new ErrnoException("qa-write", OsConstants.ENOSPC);
                    }
                    if (offset == 0) {
                        int accepted = Math.min(8, size);
                        Log.i("ArtinQaFault", "Partial write accepted bytes=" + accepted);
                        return accepted;
                    }
                    Log.i("ArtinQaFault", "EIO simulated after partial write offset=" + offset);
                    throw new ErrnoException("qa-write", OsConstants.EIO);
                }
                @Override public void onRelease() { worker.quitSafely(); }
            }, new Handler(worker.getLooper()));
        } catch (IOException | RuntimeException error) {
            worker.quitSafely();
            FileNotFoundException failure = new FileNotFoundException("QA proxy could not open");
            failure.initCause(error);
            throw failure;
        }
    }
}
