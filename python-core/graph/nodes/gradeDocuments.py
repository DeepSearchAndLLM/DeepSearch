from typing import Any, Dict

from graph.chains.retrieval_grader import retrieval_grader
from graph.state import GraphState


def _grade_single_doc(doc, question: str, index: int):
    """
    Single document grading.
    """
    score = retrieval_grader.invoke(
        {"question": question, "document": doc.page_content}
    )
    grade = score.binary_score.lower()
    status = "RELEVANT" if grade == "yes" else "NOT RELEVANT"
    print(f"---GRADE [{index + 1}]: DOCUMENT {status}---")

    return doc if grade == "yes" else None


def grade_documents(state: GraphState) -> Dict[str, Any]:
    """
    Grade retrieved documents for relevance.

    Keep this synchronous because the FastAPI endpoint runs in a worker thread.
    Creating a fresh event loop per request with asyncio.run() can leave the
    shared Ollama async client bound to a closed loop on later requests.
    """
    print("---CHECK THE DOCUMENT RELEVANCE TO QUESTION---")

    question = state["question"]
    documents = state["documents"]
    filtered_docs = []

    for i, doc in enumerate(documents):
        graded_doc = _grade_single_doc(doc, question, i)
        if graded_doc is not None:
            filtered_docs.append(graded_doc)

    print(f"---GRADING COMPLETE: {len(filtered_docs)}/{len(documents)} documents passed---")
    return {"documents": filtered_docs}
