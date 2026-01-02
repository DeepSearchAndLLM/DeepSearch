from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from langchain_ollama import ChatOllama

from config.settings import Settings

settings = Settings()

class GradeAnswer(BaseModel):

    binary_score: bool = Field(
        description="Answer addresses the question, 'yes' or 'no'",
    )

llm = ChatOllama(
    model=settings.LLM_MODEL,
    base_url=settings.OLLAMA_HOST,
    temperature=0,
)
structured_llm_grader = llm.with_structured_output(GradeAnswer) #format JSON

system_prompt = """
You are a grader assessing whether an answer addresses / resolves a question \n
Give a binary score 'yes' or 'no'. Yes' means that the answer resolves the question.
"""

answer_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system_prompt),
        ("human", "User question: \n\n {question} \n\n LLM generation: {generation}")
    ]
)

answer_grader = answer_prompt | structured_llm_grader