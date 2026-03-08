# database/vector_db.py

from langchain_chroma import Chroma
from models.embedding_model import get_embedding_model
from config.settings import CHROMA_PATH, Settings
import os

embeddings = get_embedding_model()
settings = Settings()


def get_vector_db():
    os.makedirs(CHROMA_PATH, exist_ok=True)

    db = Chroma(
        collection_name="nomic_collection",
        persist_directory=CHROMA_PATH,
        embedding_function=embeddings,
        collection_metadata={"hnsw:space": "cosine"}
    )
    return db


vectorstore = Chroma(
    collection_name="nomic_collection",
    embedding_function=embeddings,
    persist_directory=CHROMA_PATH,
    collection_metadata={"hnsw:space": "cosine"}
)

retriever = vectorstore.as_retriever(
    search_type="similarity_score_threshold",
    search_kwargs={
        "k": 6,
        "score_threshold": 0.2
    }
)