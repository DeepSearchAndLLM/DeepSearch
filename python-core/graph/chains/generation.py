from langchain_core.output_parsers import StrOutputParser
from langsmith import Client
from config.settings import Settings
from langchain_ollama import ChatOllama

settings = Settings()

client = Client()
prompt = client.pull_prompt("rlm/rag-prompt")


llm = ChatOllama(
    model=settings.LLM_MODEL,
    base_url=settings.OLLAMA_HOST,
    temperature=0,
)


generation_chain = prompt | llm | StrOutputParser()