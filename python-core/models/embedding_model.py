from langchain_core.embeddings import Embeddings
from langchain_ollama import OllamaEmbeddings

from config.settings import settings


NOMIC_QUERY_PREFIX = "search_query: "
NOMIC_DOCUMENT_PREFIX = "search_document: "
PREFIXED_INDEX_VERSION = "search_prefixed_v1"


class TaskPrefixedEmbeddings(Embeddings):
    """Apply the query/document prefixes expected by retrieval embedding models."""

    def __init__(
        self,
        wrapped: Embeddings,
        query_prefix: str,
        document_prefix: str,
    ):
        self.wrapped = wrapped
        self.query_prefix = query_prefix
        self.document_prefix = document_prefix

    @staticmethod
    def _add_prefix(text: str, prefix: str) -> str:
        return text if text.startswith(prefix) else f"{prefix}{text}"

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        prefixed = [
            self._add_prefix(text, self.document_prefix)
            for text in texts
        ]
        return self.wrapped.embed_documents(prefixed)

    def embed_query(self, text: str) -> list[float]:
        return self.wrapped.embed_query(
            self._add_prefix(text, self.query_prefix)
        )


def uses_nomic_task_prefixes() -> bool:
    model_name = settings.EMBEDDING_MODEL.split(":", maxsplit=1)[0]
    return model_name == "nomic-embed-text"


def get_embedding_collection_name(base_name: str) -> str:
    if uses_nomic_task_prefixes():
        return f"{base_name}_{PREFIXED_INDEX_VERSION}"
    return base_name


def get_embedding_model():
    embeddings = OllamaEmbeddings(
        model=settings.EMBEDDING_MODEL,
        base_url=settings.OLLAMA_HOST,
    )

    if uses_nomic_task_prefixes():
        return TaskPrefixedEmbeddings(
            embeddings,
            query_prefix=NOMIC_QUERY_PREFIX,
            document_prefix=NOMIC_DOCUMENT_PREFIX,
        )

    return embeddings
