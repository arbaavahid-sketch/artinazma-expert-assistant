import json
from pathlib import Path

STORAGE_PATH = Path("storage/knowledge_vectors.json")
BACKUP_PATH = Path("storage/knowledge_vectors_before_repair.json")
REPAIRED_PATH = Path("storage/knowledge_vectors_repaired.json")


def main():
    if not STORAGE_PATH.exists():
        print("knowledge_vectors.json not found.")
        return

    raw = STORAGE_PATH.read_text(encoding="utf-8", errors="ignore")

    BACKUP_PATH.write_text(raw, encoding="utf-8")
    print(f"Backup saved to: {BACKUP_PATH}")

    decoder = json.JSONDecoder()

    text = raw.strip()

    if not text.startswith("["):
        print("File does not start with JSON array.")
        return

    index = 1
    items = []
    total_length = len(text)

    while index < total_length:
        while index < total_length and text[index] in " \r\n\t,":
            index += 1

        if index < total_length and text[index] == "]":
            break

        try:
            item, next_index = decoder.raw_decode(text, index)
            items.append(item)
            index = next_index

            if len(items) % 1000 == 0:
                print(f"Recovered {len(items)} chunks...")

        except json.JSONDecodeError as e:
            print("Stopped at corrupted part.")
            print(f"Recovered chunks: {len(items)}")
            print(f"Error: {e}")
            break

    REPAIRED_PATH.write_text(
        json.dumps(items, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    STORAGE_PATH.write_text(
        json.dumps(items, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print("Repair finished.")
    print(f"Recovered chunks: {len(items)}")
    print(f"Repaired file saved to: {REPAIRED_PATH}")
    print("Main knowledge_vectors.json replaced with repaired version.")


if __name__ == "__main__":
    main()