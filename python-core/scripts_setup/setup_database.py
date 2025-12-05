# import sys
# import os

# # ==========================================
# # python-core klasörünü PYTHONPATH'e ekle
# # ==========================================
# BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# sys.path.append(BASE_DIR)

# from database.vector_db import get_vector_db
# from utils.document_processor import load_documents, split_documents_tiktoken
# from config.settings import DOCUMENTS_DIR

# def main():
#     db = get_vector_db()
#     documents = load_documents(DOCUMENTS_DIR)
#     docs_split = split_documents_tiktoken(documents, chunk_size=250, chunk_overlap=0) #split documents
#     db.add_documents(docs_split)
#     #db.persist()

# if __name__ == "__main__":
#     main()


import sys
import os

# ==========================================
# PYTHONPATH ayarı
# ==========================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from database.vector_db import get_vector_db
from utils.document_processor import (
    load_documents_for_file,
    split_documents_tiktoken
)
from config.settings import DOCUMENTS_DIR


def main():
    db = get_vector_db()

    # DOCUMENTS_DIR içindeki tüm dosyaları tek tek işle
    for filename in os.listdir(DOCUMENTS_DIR):

        # Yalnızca desteklenen dosya türleri
        if not (
            filename.endswith(".txt")
            or filename.endswith(".pdf")
            or filename.endswith(".docx")
            or filename.endswith(".xlsx")
        ):
            continue

        file_path = os.path.join(DOCUMENTS_DIR, filename)
        print(f"\n📄 İşleniyor: {filename}")

        # -----------------------------------------
        # 1) DUPLICATE KONTROLÜ (asla silinmez)
        # -----------------------------------------
        existing = db.get(where={"source": filename})
        if existing and len(existing["ids"]) > 0:
            print(f"⏭️  Atlandı: {filename} zaten veritabanında kayıtlı.")
            continue

        # -----------------------------------------
        # 2) DOSYAYI YÜKLE (txt/pdf/docx/xlsx)
        # -----------------------------------------
        documents = load_documents_for_file(file_path)
        if not documents:
            print(f"⚠️ Dosya okunamadı veya boş: {filename}")
            continue

        # -----------------------------------------
        # 3) CHUNK’LAMA (dosya bazlı)
        # -----------------------------------------
        docs_split = split_documents_tiktoken(documents)

        # Her chunk’a metadata ekle
        for doc in docs_split:
            doc.metadata["source"] = filename

        # -----------------------------------------
        # 4) VERİTABANINA EKLE
        # -----------------------------------------
        db.add_documents(docs_split)

        print(f"✅ Eklendi: {filename} ({len(docs_split)} chunk)")

    print("\n🎉 Tüm dosyalar duplicate kontrolüyle ayrı ayrı işlendi.\n")


if __name__ == "__main__":
    main()
