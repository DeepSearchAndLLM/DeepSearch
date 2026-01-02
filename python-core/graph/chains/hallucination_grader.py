from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from langchain_ollama import ChatOllama

from config.settings import Settings

settings = Settings()

llm = ChatOllama(
    model=settings.LLM_MODEL,
    base_url=settings.OLLAMA_HOST,
    temperature=0,
)

class GradeHallucination(BaseModel):
    """Binary score for hallucination present in generated answer."""

    binary_score: bool = Field(
        description="Answer is grounded in the facts, 'yes' or 'no'",
    )

structured_llm_grader = llm.with_structured_output(GradeHallucination)

system_prompt = """
You are a grader assessing whether an LLM generation is grounded in / supported by a set of retrieved facts. \n
 Give a binary score 'yes' or 'no'. 'Yes' means that the answer is grounded in / supported by the set of facts.
"""

hallucination_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system_prompt),
        ("human", "Set of facts: \n\n {documents} \n\n LLM generation: {generation}")
    ]
)

hallucination_grader = hallucination_prompt | structured_llm_grader