from typing import Any, Dict
from graph.chains.generation import generation_chain
from graph.state import GraphState

def generate(state: GraphState) -> Dict[str, Any]:
    print("---GENERATE---")
    question = state["question"]
    document = state["documents"]

    generation = generation_chain.invoke({"context": document, "question": question})
    return {"documents": document, "generation": generation, "question": question}