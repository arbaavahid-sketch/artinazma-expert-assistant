import os
from knowledge_service import add_file_to_knowledge_base, knowledge_file_exists

FOLDER_PATH = "knowledge_files/astm"
CATEGORY = "ASTM Standards"

def main():
    if not os.path.exists(FOLDER_PATH):
        print(f"Folder not found: {FOLDER_PATH}")
        return

    files = [
        file_name
        for file_name in os.listdir(FOLDER_PATH)
        if file_name.lower().endswith(".pdf")
    ]

    

    if not files:
        print("No PDF files found.")
        return

    print(f"Found {len(files)} PDF files.")

    for index, file_name in enumerate(files, start=1):
        file_path = os.path.join(FOLDER_PATH, file_name)

        if knowledge_file_exists(file_name):
            print(f"Skipped duplicate: {file_name}")
            continue

        title = os.path.splitext(file_name)[0]

        print(f"[{index}/{len(files)}] Importing: {file_name}")

        try:
            result = add_file_to_knowledge_base(
                file_path=file_path,
                title=title,
                category=CATEGORY
            )

            print("Result:", result)

        except Exception as e:
            print(f"Error importing {file_name}: {e}")

    print("Bulk import finished.")

if __name__ == "__main__":
    main()