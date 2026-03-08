# graph/nodes/retrieve.py

from typing import Any, Dict
from graph.state import GraphState
from database.vector_db import vectorstore, retriever
from config.settings import Settings

settings = Settings()


def retrieve(state: GraphState) -> Dict[str, Any]:
    print("RETRIEVE FROM VECTOR DATABASE")

    question = state['question']
    print(f"Question: {question}")


    # SIMILARITY SEARCH WITH SCORES
    docs_with_scores = vectorstore.similarity_search_with_score(
        question,
        k=6
    )

    print(f"Similarity Search Results:")
    print(f"Retrieved: {len(docs_with_scores)} documents")


    seen_sources = set()
    filtered_docs = []

    for i, (doc, score) in enumerate(docs_with_scores):
        source = doc.metadata.get('source', 'Unknown')

        # Threshold control
        passed = score >= 0.2
        status = "✓" if passed else "✗"

        print(f"\n   {i + 1}. {status} Score: {score:.3f}")
        print(f"File: {source}")

        if passed:
            filtered_docs.append(doc)
            seen_sources.add(source)


    print(f"Total retrieved: {len(docs_with_scores)} chunks")
    print(f"Passed threshold (≥0.2): {len(filtered_docs)} chunks")
    print(f"Unique files: {len(seen_sources)}")

    if seen_sources:
        print(f"\nSource Files Used:")
        for source in sorted(seen_sources):
            chunk_count = sum(1 for doc in filtered_docs if doc.metadata.get('source') == source)
            print(f"      • {source} ({chunk_count} chunks)")
    else:
        print(f"\nNo documents passed threshold!")

    return {"documents": filtered_docs, "question": question}

