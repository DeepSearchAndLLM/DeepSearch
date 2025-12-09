from typing import Literal

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from config.settings import Settings
from langchain_ollama import ChatOllama

settings = Settings()



class RouteQuery(BaseModel):
    """
    Route a user query to the most relevant datasource.
    """

    datasource: Literal["vectorstore", "llm_generation"] = Field(
        ...,
        description="Given a user question choose a route it to llm generation or a vectorstore.",
    )

llm = ChatOllama(
    model=settings.LLM_MODEL,
    base_url=settings.OLLAMA_HOST,
    temperature=0,
)
structured_llm_router = llm.with_structured_output(RouteQuery)

system = """
You are an expert at routing a user question to a vectorsearch or llm generation.
The vectorsearch contains documents related to ai, satellite and cyber security.
Use the vectorsearch for questions on these topics. For all else use llm generation.
"""

route_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system),
        ("human", "{question}")
    ]
)

question_chain = route_prompt | structured_llm_router

if __name__ == "__main__":
    print(question_chain.invoke(
        {"question": 'how can i create an agent'}
    ))