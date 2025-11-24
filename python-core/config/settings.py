from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    #CHROMA_PATH: str = "python-core/scripts/chroma_db"
    CHROMA_PATH: str = "chroma_db"
    EMBEDDING_MODEL: str = "multi-qa-distilbert-cos-v1"
    LLM_MODEL: str = "llama3:8b"
    OLLAMA_HOST: str = "http://localhost:11434"

    LANGCHAIN_API_KEY: str | None = None
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_PROJECT: str | None = None

    # pydantic settings
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR.parent / "data"
DOCUMENTS_DIR = DATA_DIR / "documents"
VECTOR_DB_PATH = BASE_DIR / "scripts" / "chroma_db"

settings = Settings()
