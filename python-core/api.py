from fastapi import FastAPI
from pydantic import BaseModel, Field

from services.query_service import answer_question_with_scoped_documents


class QueryRequest(BaseModel):
    question: str = Field(min_length=1)
    allowed_sources: list[str] = Field(default_factory=list)


app = FastAPI(title="DeepSearch Python API")


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "deepsearch-python-api",
    }


@app.post("/query")
def query_documents(payload: QueryRequest):
    result = answer_question_with_scoped_documents(
        question=payload.question,
        allowed_sources=payload.allowed_sources,
    )

    return result
