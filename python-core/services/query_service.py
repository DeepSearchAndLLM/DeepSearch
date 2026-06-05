from typing import Any

from database.vector_db import vectorstore
from graph.nodes.generate import generate
from graph.nodes.gradeDocuments import grade_documents
from config.settings import settings

NO_ANSWER_MESSAGE = (
    "Bu soruya izin verilen dokumanlarda dayali net bir cevap bulamadim."
)


def _build_filter(allowed_sources: list[str]) -> dict[str, Any] | None:
    unique_sources = sorted({source for source in allowed_sources if source})
    if not unique_sources:
        return None

    return {"source": {"$in": unique_sources}}


def answer_question_with_scoped_documents(
    question: str,
    allowed_sources: list[str],
    max_results: int = settings.RETRIEVAL_K,
) -> dict[str, Any]:
    normalized_question = question.strip()
    scoped_filter = _build_filter(allowed_sources)

    if not normalized_question or scoped_filter is None:
        return {
            "answer": NO_ANSWER_MESSAGE,
            "sources": [],
            "retrievedCount": 0,
            "usedSourceCount": 0,
        }

    docs_with_scores = vectorstore.similarity_search_with_score(
        normalized_question,
        k=max_results,
        filter=scoped_filter,
    )

    retrieved_documents = [doc for doc, _score in docs_with_scores]
    if not retrieved_documents:
        return {
            "answer": NO_ANSWER_MESSAGE,
            "sources": [],
            "retrievedCount": 0,
            "usedSourceCount": 0,
        }

    graded_state = grade_documents(
        {
            "question": normalized_question,
            "documents": retrieved_documents,
        }
    )
    relevant_documents = graded_state.get("documents", [])

    if not relevant_documents:
        return {
            "answer": NO_ANSWER_MESSAGE,
            "sources": [],
            "retrievedCount": len(retrieved_documents),
            "usedSourceCount": 0,
        }

    generated_state = generate(
        {
            "question": normalized_question,
            "documents": relevant_documents,
            "generation_retries": 0,
        }
    )

    return {
        "answer": generated_state.get("generation", NO_ANSWER_MESSAGE),
        "sources": generated_state.get("sources", []),
        "retrievedCount": len(retrieved_documents),
        "usedSourceCount": len(generated_state.get("sources", [])),
    }
