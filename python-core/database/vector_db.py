from langchain_chroma import Chroma
from models.embedding_model import get_embedding_model
from config.settings import CHROMA_PATH
import os

embeddings = get_embedding_model()

def get_vector_db():
    os.makedirs(CHROMA_PATH, exist_ok=True)
    db = Chroma(
        collection_name="test_name",
        persist_directory=CHROMA_PATH,
        embedding_function=embeddings,
    )
    return db

retriever = Chroma(
    collection_name="test_name",
    embedding_function=embeddings,
    persist_directory=CHROMA_PATH
).as_retriever()
