from langchain_chroma import Chroma
from models.embedding_model import get_embedding_model
from config.settings import settings
import os


def get_vector_db():
    os.makedirs(settings.CHROMA_PATH, exist_ok=True)
    embeddings = get_embedding_model()
    db = Chroma(
        persist_directory=settings.CHROMA_PATH,
        embedding_function=embeddings,
        #collection_name = 'RAG',
    )
    return db

