from typing import Any, Dict

from graph.chains.retrieval_grader import retrieval_grader
from graph.state import GraphState

def grade_documents(state: GraphState):
    """
    Determines whether a retrieved document is relevant to the question.
    If any document is not relevant, we will set a flag to run local search

    Args:
        state (dict): The current graph state.

    Returns:
        state: (dict): Filtered out irrelevant documents and updated local_search state.
    """

    print("---CHECK THE DOCUMENT RELEVANCE TO QUESTION---")
    question = state["question"]
    documents = state["documents"]

    filtered_docs = []


    for d in documents:
        score = retrieval_grader.invoke(
            {"question": question, "document": d.page_content},
        )
        grade = score.binary_score
        if grade.lower() == "yes":
            print("---GRADE: DOCUMENT RELEVANT---")
            filtered_docs.append(d)
        else:
            print("---GRADE: DOCUMENT NOT RELEVANT---")

            continue

    return {"documents": filtered_docs}