from typing import Any, Dict
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.documents import Document
from langchain_ollama import ChatOllama

from graph.state import GraphState
from config.settings import Settings

settings = Settings()

llm = ChatOllama(
    model=settings.LLM_MODEL,
    base_url=settings.OLLAMA_HOST,
    temperature=0,
)

# Prompt to determine if the LLM can answer the question
can_answer_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a helpful assistant. Given a user question, determine if you can answer it based on your general knowledge.

Respond with only "YES" if you can provide a meaningful answer to the question, or "NO" if you cannot answer it adequately.
Be conservative - only respond "YES" if you are confident you can provide a good answer."""),
    ("human", "{question}")
])

can_answer_chain = can_answer_prompt | llm | StrOutputParser()


def fallback_to_llm(state: GraphState) -> Dict[str, Any]:
    """
    Checks if LLM can answer from general knowledge and adds appropriate document.
    This is used when documents aren't helpful and we've already tried local search.
    """
    print("---USE LLM KNOWLEDGE---")
    question = state["question"]
    documents = state.get("documents", [])
    
    # Check if we already have LLM knowledge document
    has_llm_knowledge = False
    for doc in documents:
        if "general knowledge" in doc.page_content.lower() or "not related to the provided documents" in doc.page_content.lower():
            has_llm_knowledge = True
            break
    
    if not has_llm_knowledge:
        print("Checking if LLM can answer from its own knowledge...")
        can_answer_response = can_answer_chain.invoke({"question": question})
        can_answer = can_answer_response.strip().upper().startswith("YES")
        
        if can_answer:
            # LLM can answer from its own knowledge
            print("LLM can answer from its own knowledge")
            llm_knowledge_doc = Document(
                page_content="The question is not related to the provided documents, but I can answer it based on my general knowledge."
            )
            # Clear existing documents and use only LLM knowledge doc
            documents = [llm_knowledge_doc]
        else:
            # LLM cannot answer
            print("LLM cannot answer - returning no answer message")
            no_answer_doc = Document(page_content="I don't have an answer to this question.")
            documents = [no_answer_doc]
    
    # Reset generation retries
    return {"documents": documents, "question": question, "generation_retries": 0}

