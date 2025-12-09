from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    # Vector DB path (correct)
    # Artık absolute path olarak veriyoruz
    CHROMA_PATH: str = str(Path(__file__).resolve().parent.parent / "chroma_db")

    EMBEDDING_MODEL: str = "multi-qa-distilbert-cos-v1"
    LLM_MODEL: str = "llama3:8b"
    OLLAMA_HOST: str = "http://localhost:11434"

    LANGCHAIN_API_KEY: str | None = None
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_PROJECT: str | None = None

    model_config = SettingsConfigDict(
        env_file="..env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR.parent / "data"
DOCUMENTS_DIR = DATA_DIR / "documents"

CHROMA_PATH = str(BASE_DIR / "chroma_db")
VECTOR_DB_PATH = BASE_DIR / "chroma_db"

settings = Settings()

