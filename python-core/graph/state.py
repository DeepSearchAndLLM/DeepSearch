from typing import List, TypedDict, Any
from langchain_core.documents import Document

class GraphState(TypedDict, total=False):
    question: str
    documents: List[str]
    generation: str
    meta: Any
    llm_generation: bool
