import sys
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from database.vector_db import get_vector_db
from utils.document_processor import split_documents_tiktoken
from langchain_community.document_loaders import TextLoader
from config.settings import DOCUMENTS_DIR


def main():
    db = get_vector_db()

    # Klasördeki dosyaları tek tek işle
    for filename in os.listdir(DOCUMENTS_DIR):
        if not filename.endswith(".txt"):
            continue

        file_path = os.path.join(DOCUMENTS_DIR, filename)
        print(f"📄 İşleniyor: {filename}")

        # Sadece bu dosyayı yükle
        loader = TextLoader(file_path, encoding="utf-8")
        documents = loader.load()

        # Chunk'la
        docs_split = split_documents_tiktoken(documents)

        #DB'ye ekle
        db.add_documents(docs_split)

        print(f"Veritabanına eklendi: {filename}")

    print("Tüm dosyalar ayrı ayrı veritabanına eklendi.")


if __name__ == "__main__":
    main()
