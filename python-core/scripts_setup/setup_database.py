# database/setup_database.py

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
                or filename.endswith(".xlsx")
        ):
            continue

        file_path = os.path.join(DOCUMENTS_DIR, filename)
        print(f"\nprocessing: {filename}")

        # duplicate control
        existing = db.get(where={"source": filename})
        if existing and len(existing["ids"]) > 0:
            print(f"skipped: {filename} already exists")
            continue

        documents = load_documents_for_file(file_path)
        if not documents:
            print(f"document could not be read or empty: {filename}")
            continue

        # chunking / change if needed
        docs_split = split_documents_tiktoken(documents, chunk_size=250, chunk_overlap=20)

        docs_split = add_chunk_metadata(docs_split, file_path)
        db.add_documents(docs_split)

        print(f"added: {filename} ({len(docs_split)} chunk)")

        if docs_split:
            print(f"metadata:")
            print(f"      - Source: {docs_split[0].metadata.get('source')}")
            print(f"      - Chunk index: {docs_split[0].metadata.get('chunk_index')}")
            print(f"      - Total chunks: {docs_split[0].metadata.get('total_chunks')}")
            print(f"      - File size: {docs_split[0].metadata.get('file_size')} bytes")
            print(f"      - Upload date: {docs_split[0].metadata.get('upload_date')}")

    print("\nfinished\n")


if __name__ == "__main__":
    main()