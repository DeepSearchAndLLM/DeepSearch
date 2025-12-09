from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from config.settings import Settings
from langchain_ollama import ChatOllama

settings = Settings()

llm = ChatOllama(
    model=settings.LLM_MODEL,
    base_url=settings.OLLAMA_HOST,
    temperature=0,
)

class GradeDocument(BaseModel):
    """Binary score for relevance check on retrieved documents."""

    binary_score: str = Field(
        description="Documents are relevant to the question, 'yes or 'no'",
    )


structured_llm_grader = llm.with_structured_output(GradeDocument)

system = """
You are a grader assessing relevance of a retrieved document to a user question. \n
If the document contains keyword(s) or semantic meaning related to the question, grade it as relevant. \n
Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question.
"""

grade_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system),
        ("human", "Retrieved document: {document} User question: {question}"),
    ]
)

retrieval_grader = grade_prompt | structured_llm_grader