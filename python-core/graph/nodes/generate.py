from typing import Any, Dict
from graph.chains.generation import generation_chain
from graph.state import GraphState, SourceReference


def _build_source_reference(doc) -> SourceReference:
    """
    Builds a rich source reference from a document's metadata.
    Includes page number (PDF), line range (TXT), or paragraph index (DOCX).
    """
    m = doc.metadata
    ref: SourceReference = {
        "file_name": m.get("source", "unknown"),
        "file_path": m.get("file_path"),
        "extension": m.get("extension"),
        "chunk_index": m.get("chunk_index"),
        "total_chunks": m.get("total_chunks"),
        "excerpt": doc.page_content[:150].strip() + "..." if len(doc.page_content) > 150 else doc.page_content.strip(),
    }

    # File-type specific location info
    if "page_number" in m:
        ref["page_number"] = m["page_number"]
    if "line_start" in m:
        ref["line_start"] = m["line_start"]
        ref["line_end"] = m.get("line_end")
    if "paragraph_index" in m:
        ref["paragraph_index"] = m["paragraph_index"]

    return ref


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

    # Build rich source references
    sources = []
    if not use_llm_knowledge:
        seen = set()
        for doc in context_for_generation:
            # Deduplicate by (file_name, chunk_index)
            key = (
                doc.metadata.get("source"),
                doc.metadata.get("chunk_index")
            )
            if key not in seen:
                seen.add(key)
                sources.append(_build_source_reference(doc))

        # Log for debugging
        for ref in sources:
            location = ""
            if "page_number" in ref:
                location = f"page {ref['page_number']}"
            elif "line_start" in ref:
                location = f"lines {ref['line_start']}-{ref['line_end']}"
            elif "paragraph_index" in ref:
                location = f"paragraph {ref['paragraph_index']}"
            print(f"   SOURCE: {ref['file_name']} | chunk {ref['chunk_index']} | {location}")
            print(f"   EXCERPT: {ref['excerpt'][:80]}...")

    generation = generation_chain.invoke(
        {
            "context": context_for_generation,
            "question": question,
        }
    )

    return {
        "documents": documents,
        "generation": generation,
        "question": question,
        "generation_retries": retries + 1,
        "sources": sources,
    }
