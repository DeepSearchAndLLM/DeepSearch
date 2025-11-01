from typing import Any, Dict

from graph.state import GraphState
from database.vector_db import retriever

def retrieve(state: GraphState) -> Dict[str, Any]:
    print("---RETRIEVE---")
    question = state['question']

    documents = retriever.invoke(question)

    print(len(documents))
    return{"documents": documents, "question": question}

