package net.artinazma.expertassistant;

import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

public class PendingDocumentStoreTest {
    @Rule public TemporaryFolder temporary = new TemporaryFolder();
    @Test public void survivesStoreRecreationWithLargeExactSnapshot() throws Exception {
        File directory = temporary.newFolder();
        byte[] bytes = ("{\"title\":\"نمونهٔ فرضی\",\"data\":\"" + new String(new char[2*1024*1024]).replace('\0','x') + "\"}").getBytes(StandardCharsets.UTF_8);
        PendingDocumentStore first = new PendingDocumentStore(directory);
        String token = first.stage(bytes, 3*1024*1024);
        PendingDocumentStore recreated = new PendingDocumentStore(directory);
        assertTrue(token.length() < 100);
        assertArrayEquals(bytes, recreated.read(token, 3*1024*1024));
        recreated.remove(token);
        try { recreated.read(token, 3*1024*1024); fail(); } catch (IOException expected) {}
    }
    @Test public void rejectsInvalidPathsAndBounds() throws Exception {
        PendingDocumentStore store = new PendingDocumentStore(temporary.newFolder());
        for (String token : new String[]{"../outside", "", "../../a", "/tmp/a"}) {
            try { store.read(token, 1024); fail(); } catch (IOException expected) {}
        }
        try { store.stage(new byte[0], 1024); fail(); } catch (IOException expected) {}
        try { store.stage(new byte[1025], 1024); fail(); } catch (IOException expected) {}
        String token = store.stage(new byte[]{0, -1, 1, -128}, 4);
        try { store.read(token, 3); fail(); } catch (IOException expected) {}
        assertArrayEquals(new byte[]{0, -1, 1, -128}, store.read(token, 4));
    }
}
