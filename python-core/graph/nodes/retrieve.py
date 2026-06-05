# graph/nodes/retrieve.py

from typing import Any, Dict
from graph.state import GraphState
from database.vector_db import vectorstore
from config.settings import settings


def retrieve(state: GraphState) -> Dict[str, Any]:
    print("RETRIEVE FROM VECTOR DATABASE")

    question = state['question']
    print(f"Question: {question}")


    # SIMILARITY SEARCH WITH SCORES
    docs_with_scores = vectorstore.similarity_search_with_score(
        question,
        k=settings.RETRIEVAL_K,
    )

    print(f"Similarity Search Results:")
    print(f"Retrieved: {len(docs_with_scores)} documents")


    seen_sources = set()
    filtered_docs = []

    for i, (doc, distance) in enumerate(docs_with_scores):
        source = doc.metadata.get('source', 'Unknown')

        # Chroma returns cosine distance here; lower values are more similar.
        passed = distance <= settings.RETRIEVAL_MAX_COSINE_DISTANCE
        status = "✓" if passed else "✗"

        print(f"\n   {i + 1}. {status} Distance: {distance:.3f}")
        print(f"File: {source}")

        if passed:
            filtered_docs.append(doc)
            seen_sources.add(source)


    print(f"Total retrieved: {len(docs_with_scores)} chunks")
    print(
        "Passed cosine distance threshold "
        f"(≤{settings.RETRIEVAL_MAX_COSINE_DISTANCE}): {len(filtered_docs)} chunks"
    )
    print(f"Unique files: {len(seen_sources)}")

    if seen_sources:
        print(f"\nSource Files Used:")
        for source in sorted(seen_sources):
            chunk_count = sum(1 for doc in filtered_docs if doc.metadata.get('source') == source)
            print(f"      • {source} ({chunk_count} chunks)")
    else:
        print(f"\nNo documents passed threshold!")

    return {"documents": filtered_docs, "question": question}
