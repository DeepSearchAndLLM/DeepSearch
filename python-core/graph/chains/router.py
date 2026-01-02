from typing import Literal

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from langchain_ollama import ChatOllama

from config.settings import Settings

settings = Settings()

class RouteQuery(BaseModel):
    """
    Route a user query to the most relevant datasource.
    """

    datasource: Literal["vectorstore", "local_search"] = Field(
        ...,
        description="Given a user question choose a route it to local search or a vectorstore.",
    )

llm = ChatOllama(
    model=settings.LLM_MODEL,
    base_url=settings.OLLAMA_HOST,
    temperature=0,
)
structured_llm_router = llm.with_structured_output(RouteQuery)

system = """
You are an expert at routing a user question to a vectorsearch or local llm search.
Use the vectorsearch for questions on users ask. For all else use local llm search.
"""

route_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system),
        ("human", "{question}")
    ]
)

question_chain = route_prompt | structured_llm_router
