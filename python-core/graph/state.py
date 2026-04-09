from typing import List, TypedDict, Any
from langchain_core.documents import Document


class SourceReference(TypedDict, total=False):
    """Represents a single source chunk used in generation."""
    file_name: str
    file_path: str
    extension: str
    chunk_index: int
    total_chunks: int
    page_number: int      # page number for pdf
    line_start: int       # begining line for txt
    line_end: int         # finish line for txt
    paragraph_index: int  # paragraph number for doxc
    excerpt: str          # preview chunk (first 150 character)


class GraphState(TypedDict, total=False):
    question: str
    documents: List[Document]
    generation: str
    generation_retries: int
    sources: List[SourceReference]  # full reference
    meta: Any
    llm_generation: bool
