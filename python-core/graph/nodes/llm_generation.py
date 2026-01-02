from typing import Any, Dict
from config.settings import Settings
from langchain_ollama import ChatOllama

settings = Settings()

llm = ChatOllama(
    model=settings.LLM_MODEL,
    base_url=settings.OLLAMA_HOST,
    temperature=0,
)

from graph.state import GraphState


def llm_generation(state: GraphState) -> Dict[str, Any]:
    print("---LLM GENERATION---")
    question = state["question"]
    documents = state["documents"]

    # Normalize documents to strings (handles LangChain Document or plain text)
    context_parts = []
    for doc in documents:
        if hasattr(doc, "page_content"):
            context_parts.append(doc.page_content)
        else:
            context_parts.append(str(doc))
    context = "\n\n".join(context_parts)

    prompt = f"""Answer the question using the context information below.


Important: Your answer should be NO MORE THAN 3 SENTENCES. Keep your response short and to the point.
Context:
{context}

Question: {question}

Answer:"""

    response = llm.invoke(prompt)
    generation = response.content

    return {"documents": documents, "question": question, "generation": generation}