from langchain_chroma import Chroma
from models.embedding_model import get_embedding_model
from config.settings import settings

embeddings = get_embedding_model()

db = Chroma(
    collection_name="test_name",
    persist_directory=settings.CHROMA_PATH,
    embedding_function=embeddings,
)

# dokümanlaı çekmeyi sağla
all_docs = db.get(include=["metadatas", "documents"])

print(f"Toplam kayıt: {len(all_docs['documents'])}")

for i, (doc, meta) in enumerate(zip(all_docs["documents"], all_docs["metadatas"])):
    print(f"\n--- {i+1}. Kayıt ---")
    print("Kaynak:", meta.get("source"))
    print("Metin:", doc[:200], "...")
