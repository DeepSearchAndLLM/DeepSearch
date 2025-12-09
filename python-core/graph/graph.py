'''
from langgraph.graph import StateGraph, END
from graph.state import GraphState
from graph.nodes.retrieve import retrieve
from graph.nodes.generate import generate

def build_graph():
    """
    RAG flow
    """
    workflow = StateGraph(GraphState)

    workflow.add_node("retrieve", retrieve)
    workflow.add_node("generate", generate)

    workflow.set_entry_point("retrieve")
    workflow.add_edge("retrieve", "generate")
    workflow.add_edge("generate", END)

    return workflow.compile()

'''

from langgraph.graph import END, StateGraph

from graph.chains.answer_grader import answer_grader
from graph.chains.hallucination_grader import hallucination_grader
from graph.chains.router import RouteQuery, question_chain
from graph.node_const import GENERATE, GRADE_DOCUMENTS, LLM_GENERATE, RETRIEVE
from graph.nodes.generate import generate
from graph.nodes.grade_documents import grade_documents
from graph.nodes.llm_generation import llm_generation
from graph.nodes.retrieve import retrieve
from graph.state import GraphState

from config.settings import Settings

settings = Settings()



def decide_to_generate(state: GraphState):
    print("---ASSESS GRADED DOCUMENTS---")

    if state["llm_generation"]:
        print("---DECISION: NOT ALL DOCUMENTS ARE NOT RELEVANT TO QUESTION, INCLUDE LLM GENERATION---")
        return LLM_GENERATE
    else:
        print("---DECISION: GENERATE---")
        return GENERATE



def grade_generation_grounded_in_documents_and_question(state: GraphState) -> str:
    print("---CHECK HALLUCINATIONS---")
    question = state["question"]
    documents = state["documents"]
    generation = state["generation"]

    # If there are no documents to check, fall back to LLM generation once.
    if not documents:
        print("---NO DOCUMENTS TO CHECK, FALLBACK TO LLM GENERATION---")
        return "not useful"

    score = hallucination_grader.invoke(
        {"documents": documents, "generation": generation}
    )

    if hallucination_grade := score.binary_score:
        print("---DECISION: GENERATION IS GROUNDED IN DOCUMENTS---")
        print("---GRADE GENERATION vs QUESTION---")
        score = answer_grader.invoke({"question": question, "generation": generation})
        if answer_grade := score.binary_score:
            print("---DECISION: GENERATION ADDRESSES QUESTION---")
            return "useful"
        else:
            print("---DECISION: GENERATION DOES NOT ADDRESS QUESTION---")
            return "not useful"
    else:
        print("---DECISION: GENERATION IS NOT GROUNDED IN DOCUMENTS, RE-TRY---")
        return "not supported"


def route_question(state: GraphState) -> str | None:
    print("---ROUTE QUESTION---")
    question = state["question"]
    source: RouteQuery = question_chain.invoke({"question": question})
    if source.datasource == LLM_GENERATE:
        print("---ROUTE QUESTION TO LLM GENERATION---")
        return LLM_GENERATE
    elif source.datasource == "vectorstore":
        print("---ROUTE QUESTION TO RAG---")
        return RETRIEVE
    # Fallback: if router yields an unexpected value, default to RAG to avoid KeyError
    print("---ROUTE QUESTION FALLBACK TO RAG---")
    return RETRIEVE


def build_graph():
    """
    Construct the RAG workflow graph and return the compiled app.
    """
    workflow = StateGraph(GraphState)

    workflow.add_node(RETRIEVE, retrieve)
    workflow.add_node(GRADE_DOCUMENTS, grade_documents)
    workflow.add_node(GENERATE, generate)
    workflow.add_node(LLM_GENERATE, llm_generation)

    workflow.set_conditional_entry_point(
        route_question,
        {
            LLM_GENERATE: LLM_GENERATE,
            RETRIEVE: RETRIEVE,
        },
    )
    workflow.add_edge(RETRIEVE, GRADE_DOCUMENTS)
    workflow.add_conditional_edges(
        GRADE_DOCUMENTS,
        decide_to_generate,
        {
            LLM_GENERATE: LLM_GENERATE,
            GENERATE: GENERATE,
        },
    )

    workflow.add_conditional_edges(
        GENERATE,
        grade_generation_grounded_in_documents_and_question,
        {
            "not supported": GENERATE,
            "useful": END,
            "not useful": LLM_GENERATE,
        },
    )
    workflow.add_edge(LLM_GENERATE, END)
    workflow.add_edge(GENERATE, END)

    app = workflow.compile()
    # Export the graph image for debugging/visualization.
    app.get_graph().draw_mermaid_png(output_file_path="graph.png")
    return app