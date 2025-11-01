from langchain_chroma import Chroma
from models.embedding_model import get_embedding_model
from config.settings import settings, VECTOR_DB_PATH
import os

embeddings = get_embedding_model()
def get_vector_db():
    os.makedirs(settings.CHROMA_PATH, exist_ok=True)
    db = Chroma(
        collection_name="test_name", # multiple collections within the same database
        persist_directory=settings.CHROMA_PATH,
        embedding_function=embeddings,
        #collection_name = 'RAG',
    )
    return db


retriever = Chroma(
    collection_name='test_name',
    embedding_function=embeddings,
    persist_directory=VECTOR_DB_PATH
).as_retriever()