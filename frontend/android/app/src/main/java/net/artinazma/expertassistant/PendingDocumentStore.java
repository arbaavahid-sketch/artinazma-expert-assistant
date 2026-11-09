package net.artinazma.expertassistant;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.UUID;

/** Private, temporary export snapshots. Only the opaque token enters Activity saved state. */
final class PendingDocumentStore {
    private final File directory;
    PendingDocumentStore(File directory) { this.directory = directory; }

    String stage(byte[] bytes, int limit) throws IOException {
        if (bytes.length == 0 || bytes.length > limit) throw new IOException("Invalid pending document size");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Pending storage unavailable");
        File[] oldFiles = directory.listFiles();
        if (oldFiles != null) for (File old : oldFiles) {
            if (validToken(old.getName()) && old.isFile() && System.currentTimeMillis() - old.lastModified() > 86400000L) old.delete();
        }
        String token = UUID.randomUUID().toString();
        File file = target(token);
        try (FileOutputStream stream = new FileOutputStream(file)) {
            stream.write(bytes);
            stream.getFD().sync();
        } catch (IOException error) { file.delete(); throw error; }
        return token;
    }

    byte[] read(String token, int limit) throws IOException {
        File file = target(token);
        long length = file.length();
        if (!file.isFile() || length < 1 || length > limit) throw new IOException("Pending document unavailable");
        byte[] bytes = new byte[(int) length];
        try (FileInputStream stream = new FileInputStream(file)) {
            int offset = 0;
            while (offset < bytes.length) {
                int count = stream.read(bytes, offset, bytes.length - offset);
                if (count < 0) throw new IOException("Incomplete pending document");
                offset += count;
            }
            if (stream.read() != -1) throw new IOException("Pending document changed");
        }
        return bytes;
    }

    void remove(String token) {
        if (validToken(token)) new File(directory, token).delete();
    }
    private File target(String token) throws IOException {
        if (!validToken(token)) throw new IOException("Invalid pending document token");
        return new File(directory, token);
    }
    private static boolean validToken(String token) {
        return token != null && token.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    }
}
