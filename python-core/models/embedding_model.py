from langchain_huggingface import HuggingFaceEmbeddings
from config.settings import settings

def get_embedding_model():
    return HuggingFaceEmbeddings(
        model_name=settings.EMBEDDING_MODEL,
        encode_kwargs={'normalize_embeddings': True}
    )

