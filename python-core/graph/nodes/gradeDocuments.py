import asyncio
from typing import Any, Dict

from graph.chains.retrieval_grader import retrieval_grader
from graph.state import GraphState


async def _grade_single_doc(doc, question: str, index: int):
    """
    Single document grading - runs concurrently.
    """
    score = await retrieval_grader.ainvoke(
        {"question": question, "document": doc.page_content}
    )
    grade = score.binary_score.lower()
    status = "RELEVANT" if grade == "yes" else "NOT RELEVANT"
    print(f"---GRADE [{index + 1}]: DOCUMENT {status}---")

    return doc if grade == "yes" else None


def grade_documents(state: GraphState) -> Dict[str, Any]:
    """
    All LLM calls fire simultaneously instead of sequentially using asyncio.gather().
    """
    print("---CHECK THE DOCUMENT RELEVANCE TO QUESTION (PARALLEL)---")

    question = state["question"]
    documents = state["documents"]

    async def run_parallel():
        tasks = [
            _grade_single_doc(doc, question, i)
            for i, doc in enumerate(documents)
        ]
        results = await asyncio.gather(*tasks)
        return [doc for doc in results if doc is not None]

    # We use get_event_loop instead of asyncio.run()
    # because LangGraph may already be running in an async context
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If LangGraph is in an async context, nest_asyncio is required
            import nest_asyncio
            nest_asyncio.apply()
            filtered_docs = loop.run_until_complete(run_parallel())
        else:
            filtered_docs = loop.run_until_complete(run_parallel())
    except RuntimeError:
        filtered_docs = asyncio.run(run_parallel())

    print(f"---GRADING COMPLETE: {len(filtered_docs)}/{len(documents)} documents passed---")
    return {"documents": filtered_docs}
