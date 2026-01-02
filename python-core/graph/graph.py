from langgraph.graph import END, StateGraph

from graph.chains.answer_grader import answer_grader
from graph.chains.hallucination_grader import hallucination_grader
from graph.chains.router import question_chain, RouteQuery
from graph.nodes.generate import generate
from graph.nodes.gradeDocuments import grade_documents
from graph.nodes.retrieve import retrieve
from graph.nodes.fallback_to_llm import fallback_to_llm
from graph.state import GraphState

# Node constants
RETRIEVE = "retrieve"
GRADE_DOCUMENTS = "grade_documents"
GENERATE = "generate"

FALLBACK_TO_LLM = "fallback_to_llm"


def route_question(state: GraphState) -> str:
    """
    Router: Routes the question to either vectorstore or direct LLM.
    """
    print("---ROUTE QUESTION---")
    question = state["question"]

    try:
        source: RouteQuery = question_chain.invoke({"question": question})

        if source.datasource == "vectorstore":
            print("---ROUTE → VECTORSTORE (RAG)---")
            return RETRIEVE
        else:  # local_search
            print("---ROUTE → LLM KNOWLEDGE---")
            return FALLBACK_TO_LLM
    except Exception as e:
        print(f"Router error: {e}, defaulting to RETRIEVE")
        return RETRIEVE


def decide_after_grading(state: GraphState) -> str:
    """
    After grading: Are there any relevant documents?
    """
    print("---DECIDE AFTER GRADING---")
    documents = state.get("documents", [])

    if not documents or len(documents) == 0:
        print("---DECISION: NO RELEVANT DOCUMENTS → FALLBACK TO LLM---")
        return FALLBACK_TO_LLM
    else:
        print(f"---DECISION: {len(documents)} RELEVANT DOCUMENTS → GENERATE---")
        return GENERATE


def decide_after_generation(state: GraphState) -> str:
    """
    After generation: Hallucination and quality control.

    Flow:
    1. Is there hallucination? → Re-generate (max 2 times)
    2. Does it answer the question? → END or Fallback
    """

    print("QUALITY CONTROL: CHECKING GENERATION")

    question = state["question"]
    documents = state.get("documents", [])
    generation = state.get("generation", "")
    retries = state.get("generation_retries", 0)

    MAX_RETRIES = 2


    # 1. Check for LLM Knowledge Flag
    is_llm_knowledge = _has_llm_knowledge_flag(documents)

    if is_llm_knowledge:
        print("→ Mode: LLM KNOWLEDGE (skip hallucination check)")
        return _check_answer_quality(question, generation, retries, MAX_RETRIES)


    # 2. If Documents are Empty
    if not documents or len(documents) == 0:
        print("No documents available")
        return _check_answer_quality(question, generation, retries, MAX_RETRIES)

    # 3. Normal RAG: Hallucination Check
    print("→ Mode: RAG (checking hallucination)")

    hallucination_score = hallucination_grader.invoke({
        "documents": documents,
        "generation": generation
    })

    if not hallucination_score.binary_score:
        # Hallucination detected!
        if retries >= MAX_RETRIES:
            print(f"HALLUCINATION + MAX RETRIES ({MAX_RETRIES}) → END")
            return END  # Accept it (even if it's a bad answer)
        else:
            print(f"HALLUCINATION DETECTED → RE-GENERATE ({retries + 1}/{MAX_RETRIES})")
            return GENERATE  # Retry

    print("No hallucination detected")

    # 4. Answer Quality Check
    return _check_answer_quality(question, generation, retries, MAX_RETRIES)


def _has_llm_knowledge_flag(documents: list) -> bool:
    """Check if there's an LLM knowledge flag among documents"""
    for doc in documents:
        content_lower = doc.page_content.lower()
        if "general knowledge" in content_lower or "not related to the provided documents" in content_lower:
            return True
    return False


def _check_answer_quality(question: str, generation: str, retries: int, max_retries: int) -> str:
    """Does the answer address the question?"""
    print("→ Checking: Does answer address the question?")

    answer_score = answer_grader.invoke({
        "question": question,
        "generation": generation
    })

    if answer_score.binary_score:
        print("ANSWER IS GOOD → END")
        return END
    else:
        print("ANSWER DOES NOT ADDRESS QUESTION")

        if retries >= max_retries:
            print(f"MAX RETRIES ({max_retries}) REACHED → END (accept poor answer)")
            return END
        else:
            print(f"→ RE-GENERATE ({retries + 1}/{max_retries})")
            return GENERATE


def build_graph():
    """
    Simplified LangGraph workflow.

    Flow:
    1. Router → RETRIEVE or FALLBACK_TO_LLM
    2. RETRIEVE → GRADE_DOCUMENTS
    3. GRADE_DOCUMENTS → GENERATE or FALLBACK_TO_LLM
    4. FALLBACK_TO_LLM → GENERATE
    5. GENERATE → Quality check → END or GENERATE (retry)
    """
    workflow = StateGraph(GraphState)

    # ============================================
    # NODES
    # ============================================
    workflow.add_node(RETRIEVE, retrieve)
    workflow.add_node(GRADE_DOCUMENTS, grade_documents)
    workflow.add_node(GENERATE, generate)
    workflow.add_node(FALLBACK_TO_LLM, fallback_to_llm)  # Can be renamed

    # ============================================
    # ENTRY POINT: Router
    # ============================================
    workflow.set_conditional_entry_point(
        route_question,
        {
            RETRIEVE: RETRIEVE,
            FALLBACK_TO_LLM: FALLBACK_TO_LLM,
        },
    )

    # ============================================
    # EDGES
    # ============================================

    # After RETRIEVE → always grade documents
    workflow.add_edge(RETRIEVE, GRADE_DOCUMENTS)

    # After GRADE_DOCUMENTS → GENERATE or FALLBACK
    workflow.add_conditional_edges(
        GRADE_DOCUMENTS,
        decide_after_grading,
        {
            GENERATE: GENERATE,
            FALLBACK_TO_LLM: FALLBACK_TO_LLM,
        },
    )

    # After FALLBACK_TO_LLM → always generate
    workflow.add_edge(FALLBACK_TO_LLM, GENERATE)

    # After GENERATE → quality check
    workflow.add_conditional_edges(
        GENERATE,
        decide_after_generation,
        {
            GENERATE: GENERATE,  # Re-generate (hallucination or poor answer)
            END: END,  # Good answer
        },
    )

    return workflow.compile()


# Compile the graph
app = build_graph()

# Uncomment to visualize
# app.get_graph().draw_mermaid_png(output_file_path="graph.png")