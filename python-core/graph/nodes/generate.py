from typing import Any, Dict
from graph.chains.generation import generation_chain
from graph.state import GraphState


def generate(state: GraphState) -> Dict[str, Any]:
    print("---GENERATE---")

    question = state["question"]
    documents = state.get("documents", [])
    retries = state.get("generation_retries", 0)

    use_llm_knowledge = False
    filtered_documents = []

    for doc in documents:
        content_lower = doc.page_content.lower()

        if (
            "general knowledge" in content_lower
            or "not related to the provided documents" in content_lower
        ):
            use_llm_knowledge = True
            continue

        if "i don't have an answer" in content_lower:
            continue

        filtered_documents.append(doc)

    if use_llm_knowledge:
        context_for_generation = []
        print("---USING LLM GENERAL KNOWLEDGE (NO DOCUMENT CONTEXT)---")
    elif filtered_documents:
        context_for_generation = filtered_documents
    else:
        context_for_generation = documents

    source_files = []

    if not use_llm_knowledge:
        for doc in context_for_generation:
            if hasattr(doc, "metadata") and "source" in doc.metadata:
                source_files.append(doc.metadata["source"])

        # Remove duplicates while preserving content integrity
        source_files = list(set(source_files))

    generation = generation_chain.invoke(
        {
            "context": context_for_generation,
            "question": question,
        }
    )


    return {
        "documents": documents,              # original docs for grading
        "generation": generation,
        "question": question,
        "generation_retries": retries + 1,
        "sources": source_files,
    }
