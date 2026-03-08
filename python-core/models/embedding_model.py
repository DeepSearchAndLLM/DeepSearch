from langchain_huggingface import HuggingFaceEmbeddings
from config.settings import settings
from langchain_ollama import OllamaEmbeddings

def get_embedding_model():
    return OllamaEmbeddings(
        model=settings.EMBEDDING_MODEL,
        base_url="http://localhost:11434"
    )

