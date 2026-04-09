from langchain_core.output_parsers import StrOutputParser
from config.settings import Settings
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate

settings = Settings()


prompt = ChatPromptTemplate.from_messages([
    ("system", """You are an assistant for question-answering tasks.\n 
    IMPORTANT: Always respond in the SAME LANGUAGE as the user's question.\n
    - Answer in the same language as the question. If you don't recognize the language, answer in English.\n\n
    
    Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise."""),
    ("human", "Question: {question}\n\n Context: {context}\n\n Answer:")
])

llm = ChatOllama(
    model=settings.LLM_MODEL,
    base_url=settings.OLLAMA_HOST,
    temperature=0,
)



generation_chain = prompt | llm | StrOutputParser()
