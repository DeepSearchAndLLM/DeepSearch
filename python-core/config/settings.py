from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    CHROMA_PATH: str = "./chroma_db"
    EMBEDDING_MODEL: str = "multi-qa-distilbert-cos-v1"
    #LLM_MODEL: str = "llama3"
    #OLLAMA_HOST: str = "http://localhost:11434"

    class Config:
        env_file = ".env"

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR.parent / "data"
DOCUMENTS_DIR = DATA_DIR / "documents"
VECTOR_DB_PATH = BASE_DIR / "scripts" / "chroma_db"

settings = Settings()
