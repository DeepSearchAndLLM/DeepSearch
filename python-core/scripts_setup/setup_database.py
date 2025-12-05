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

    # Klasördeki txt dosyalarını tek tek işle
    for filename in os.listdir(DOCUMENTS_DIR):
        if not filename.endswith(".txt"):
            continue

        file_path = os.path.join(DOCUMENTS_DIR, filename)
        print(f"\n📄 İşleniyor: {filename}")

        # -----------------------------------------
        # 1) DUPLICATE KONTROLÜ
        # -----------------------------------------
        existing = db.get(where={"source": filename})

        if existing and len(existing["ids"]) > 0:
            print(f"⏭️  Atlandı: {filename} zaten veritabanında kayıtlı.")
            continue

        # -----------------------------------------
        # 2) DOSYAYI SADECE TEK BAŞINA YÜKLE
        # -----------------------------------------
        loader = TextLoader(file_path, encoding="utf-8")
        documents = loader.load()  # sadece filename dosyasını yükler

        # -----------------------------------------
        # 3) CHUNK’LARA BÖL (Bu dosya için tek tek)
        # -----------------------------------------
        docs_split = split_documents_tiktoken(documents)

        # Her chunk’a metadata ekle (hangi dosyadan geldiği)
        for doc in docs_split:
            doc.metadata["source"] = filename

        # -----------------------------------------
        # 4) VERİTABANINA EKLE (Sadece bu dosyayı)
        # -----------------------------------------
        db.add_documents(docs_split)

        print(f"✅ Eklendi: {filename} ({len(docs_split)} chunk)")

    print("\n🎉 Tüm dosyalar duplicate kontrolüyle ayrı ayrı işlendi.\n")


if __name__ == "__main__":
    main()
