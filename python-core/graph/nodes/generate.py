from typing import Any, Dict
from graph.chains.generation import generation_chain
from graph.state import GraphState

def generate(state: GraphState) -> Dict[str, Any]:
    print("---GENERATE---")
    question = state["question"]
    documents = state.get("documents", [])
    retries = state.get("generation_retries", 0)

    # Check if we have a special document indicating LLM should use its own knowledge
    use_llm_knowledge = False
    filtered_documents = []
    
    if documents:
        for doc in documents:
            if "general knowledge" in doc.page_content.lower() or "not related to the provided documents" in doc.page_content.lower():
                use_llm_knowledge = True
                # Don't include this document in context - it's just a flag
                continue
            elif "I don't have an answer" in doc.page_content:
                # Skip "no answer" documents
                continue
            else:
                filtered_documents.append(doc)
    
    # If using LLM knowledge, pass empty context so it uses general knowledge
    if use_llm_knowledge:
        # empty context
        context_for_generation = []
    elif filtered_documents:
        #use filtered documents
        context_for_generation = filtered_documents
    else:
        # use original documents
        context_for_generation = documents


    if use_llm_knowledge:
        print("---USING LLM GENERAL KNOWLEDGE (NO DOCUMENT CONTEXT)---")
    
    generation = generation_chain.invoke({
        "context": context_for_generation, "question": question
    })
    
    # Increment retry counter for tracking
    return {
        "documents": documents,  # Keep original documents for grading
        "generation": generation, 
        "question": question,
        "generation_retries": retries + 1
    }