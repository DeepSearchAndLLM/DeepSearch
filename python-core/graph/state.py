from typing import List, TypedDict, Any
from langchain_core.documents import Document

class GraphState(TypedDict, total=False):
    question: str
    documents: List[Document]
    generation: str
    #local_search: bool
    generation_retries: int
    #local_search_attempted: bool
    sources: list[str]
    meta: Any
    llm_generation: bool
