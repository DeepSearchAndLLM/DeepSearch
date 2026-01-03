from langchain_core.output_parsers import StrOutputParser
from langsmith import Client
from config.settings import Settings
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate

settings = Settings()

client = Client()
#prompt = client.pull_prompt("rlm/rag-prompt")


prompt = ChatPromptTemplate.from_messages([
    ("system", """You are an assistant for question-answering tasks.\n 
    IMPORTANT: Always respond in the SAME LANGUAGE as the user's question.\n
    - If the question is in Turkish, respond in Turkish.\n
    - If the question is in English, respond in English.\n
    
    Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise."""),
    ("human", "Question: {question}\n\n Context: {context}\n\n Answer:")
])

llm = ChatOllama(
    model=settings.LLM_MODEL,
    base_url=settings.OLLAMA_HOST,
    temperature=0,
)



generation_chain = prompt | llm | StrOutputParser()