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
