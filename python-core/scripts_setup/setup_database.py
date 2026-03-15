# scripts_setup/setup_database.py

import sys
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from database.vector_db import get_vector_db
from utils.document_processor import (
    load_documents_for_file,
    split_documents_tiktoken,
    add_chunk_metadata
)
from config.settings import DOCUMENTS_DIR


def main():
    db = get_vector_db()

    for filename in os.listdir(DOCUMENTS_DIR):
        if not (
            filename.endswith(".txt")
            or filename.endswith(".pdf")
            or filename.endswith(".docx")
        ):
            continue

        file_path = os.path.join(DOCUMENTS_DIR, filename)
        print(f"\nprocessing: {filename}")

        # Duplicate control
        existing = db.get(where={"source": filename})
        if existing and len(existing["ids"]) > 0:
            print(f"skipped: {filename} already exists")
            continue

        documents = load_documents_for_file(file_path)
        if not documents:
            print(f"document could not be read or empty: {filename}")
            continue

        docs_split = split_documents_tiktoken(documents, chunk_size=600, chunk_overlap=80)
        docs_split = add_chunk_metadata(docs_split, file_path)
        db.add_documents(docs_split)

        print(f"added: {filename} ({len(docs_split)} chunks)")

        if docs_split:
            print(f"metadata sample (first chunk):")
            m = docs_split[0].metadata
            print(f"      - Source:      {m.get('source')}")
            print(f"      - Chunk index: {m.get('chunk_index')}")
            print(f"      - Total chunks:{m.get('total_chunks')}")
            # Page/line info depends on file type
            if "page_number" in m:
                print(f"      - Page number: {m.get('page_number')}")
            if "line_start" in m:
                print(f"      - Lines:       {m.get('line_start')} → {m.get('line_end')}")
            if "paragraph_index" in m:
                print(f"      - Paragraph:   {m.get('paragraph_index')}")

    print("\nfinished\n")


if __name__ == "__main__":
    main()
