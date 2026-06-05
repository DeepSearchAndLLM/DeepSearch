import argparse
import json
import re
import shutil
import ssl
import string
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from graph.nodes.generate import generate
from graph.nodes.gradeDocuments import grade_documents
from models.embedding_model import (
    get_embedding_collection_name,
    get_embedding_model,
)


SQUAD_URLS = {
    "train": "https://rajpurkar.github.io/SQuAD-explorer/dataset/train-v2.0.json",
    "dev": "https://rajpurkar.github.io/SQuAD-explorer/dataset/dev-v2.0.json",
}
DEFAULT_DATA_ROOT = BASE_DIR / "evals" / "squad_datasets"
DEFAULT_CHROMA_ROOT = BASE_DIR / "evals" / "squad_chroma"
NO_ANSWER_PHRASES = (
    "don't know",
    "do not know",
    "not know",
    "cannot answer",
    "can't answer",
    "not provided",
    "not mentioned",
    "not stated",
    "no information",
    "does not say",
    "not in the context",
    "unknown",
)


class SerialEmbeddings(Embeddings):
    """Avoid Ollama batch embedding failures by embedding documents one by one."""

    def __init__(self, wrapped: Embeddings, retries: int, delay_seconds: float):
        self.wrapped = wrapped
        self.retries = retries
        self.delay_seconds = delay_seconds

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [
            self._embed_with_retry(text, is_query=False)
            for text in texts
        ]

    def embed_query(self, text: str) -> list[float]:
        return self._embed_with_retry(text, is_query=True)

    def _embed_with_retry(self, text: str, is_query: bool) -> list[float]:
        last_error = None
        for attempt in range(self.retries + 1):
            try:
                if self.delay_seconds:
                    time.sleep(self.delay_seconds)
                if is_query:
                    return self.wrapped.embed_query(text)
                return self.wrapped.embed_documents([text])[0]
            except Exception as exc:
                last_error = exc
                if attempt >= self.retries:
                    break
                time.sleep(max(self.delay_seconds, 0.25) * (attempt + 1))
        raise last_error


def download_squad(split: str, data_root: Path, insecure_download: bool) -> Path:
    data_root.mkdir(parents=True, exist_ok=True)
    target = data_root / f"{split}-v2.0.json"
    if target.exists():
        return target

    if insecure_download:
        context = ssl._create_unverified_context()
    else:
        try:
            import certifi

            context = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            context = ssl.create_default_context()

    print(f"Downloading {SQUAD_URLS[split]}")
    with urllib.request.urlopen(SQUAD_URLS[split], context=context) as response:
        target.write_bytes(response.read())
    return target


def normalize_answer(text: str) -> str:
    def remove_articles(value: str) -> str:
        return re.sub(r"\b(a|an|the)\b", " ", value)

    def white_space_fix(value: str) -> str:
        return " ".join(value.split())

    def remove_punc(value: str) -> str:
        exclude = set(string.punctuation)
        return "".join(ch for ch in value if ch not in exclude)

    return white_space_fix(remove_articles(remove_punc(text.lower())))


def token_f1(prediction: str, gold: str) -> float:
    prediction_tokens = normalize_answer(prediction).split()
    gold_tokens = normalize_answer(gold).split()
    common = Counter(prediction_tokens) & Counter(gold_tokens)
    num_same = sum(common.values())
    if not prediction_tokens or not gold_tokens:
        return float(prediction_tokens == gold_tokens)
    if num_same == 0:
        return 0.0
    precision = num_same / len(prediction_tokens)
    recall = num_same / len(gold_tokens)
    return 2 * precision * recall / (precision + recall)


def exact_match(prediction: str, gold: str) -> float:
    return float(normalize_answer(prediction) == normalize_answer(gold))


def contains_gold(prediction: str, gold_answers: list[str]) -> float:
    normalized_prediction = normalize_answer(prediction)
    for gold in gold_answers:
        normalized_gold = normalize_answer(gold)
        if normalized_gold and normalized_gold in normalized_prediction:
            return 1.0
    return 0.0


def looks_like_no_answer(answer: str) -> bool:
    normalized = normalize_answer(answer)
    return any(phrase in normalized for phrase in NO_ANSWER_PHRASES)


def iter_squad_examples(path: Path) -> Iterable[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    for article_index, article in enumerate(payload["data"]):
        title = article.get("title", f"article-{article_index}")
        for paragraph_index, paragraph in enumerate(article.get("paragraphs", [])):
            passage_id = f"{article_index}-{paragraph_index}"
            context = paragraph["context"]
            for qa in paragraph.get("qas", []):
                answers = [answer["text"] for answer in qa.get("answers", [])]
                yield {
                    "id": qa["id"],
                    "title": title,
                    "passage_id": passage_id,
                    "context": context,
                    "question": qa["question"],
                    "answers": answers,
                    "is_impossible": bool(qa.get("is_impossible", False)),
                }


def load_examples(path: Path, include_impossible: bool) -> list[dict[str, Any]]:
    examples = []
    for example in iter_squad_examples(path):
        if example["is_impossible"] and not include_impossible:
            continue
        examples.append(example)
    return examples


def build_passage_documents(examples: list[dict[str, Any]]) -> list[Document]:
    seen = set()
    docs = []
    for example in examples:
        passage_id = example["passage_id"]
        if passage_id in seen:
            continue
        seen.add(passage_id)
        docs.append(
            Document(
                page_content=example["context"],
                metadata={
                    "source": passage_id,
                    "squad_passage_id": passage_id,
                    "title": example["title"],
                    "extension": ".squad",
                },
            )
        )
    return docs


def get_store(
    split: str,
    chroma_root: Path,
    rebuild: bool,
    embedding_retries: int,
    embedding_delay: float,
) -> Chroma:
    persist_dir = chroma_root / split
    if rebuild and persist_dir.exists():
        shutil.rmtree(persist_dir)
    persist_dir.mkdir(parents=True, exist_ok=True)

    embedding_model = SerialEmbeddings(
        get_embedding_model(),
        retries=embedding_retries,
        delay_seconds=embedding_delay,
    )
    return Chroma(
        collection_name=get_embedding_collection_name(f"squad_v2_{split}"),
        persist_directory=str(persist_dir),
        embedding_function=embedding_model,
        collection_metadata={"hnsw:space": "cosine"},
    )


def collection_count(store: Chroma) -> int:
    return int(store._collection.count())


def add_documents_safely(
    store: Chroma,
    docs: list[Document],
    ids: list[str],
) -> tuple[list[str], list[dict[str, str]]]:
    try:
        store.add_documents(docs, ids=ids)
        return ids, []
    except Exception:
        print(f"  batch failed; retrying {len(docs)} passages one by one")

    successful_ids = []
    skipped = []
    for doc, doc_id in zip(docs, ids):
        try:
            store.add_documents([doc], ids=[doc_id])
            successful_ids.append(doc_id)
        except Exception as exc:
            skipped.append(
                {
                    "id": doc_id,
                    "title": str(doc.metadata.get("title", "")),
                    "error": str(exc),
                }
            )
            print(f"  skipped {doc_id}: {exc}")

    return successful_ids, skipped


def index_passages(
    store: Chroma,
    docs: list[Document],
    batch_size: int,
) -> list[dict[str, str]]:
    if collection_count(store) > 0:
        print(f"Using existing SQuAD Chroma index with {collection_count(store)} passages.")
        return []

    print("Indexing SQuAD passages into an isolated Chroma collection...")
    indexed_count = 0
    skipped_passages = []
    for start in range(0, len(docs), batch_size):
        batch = docs[start : start + batch_size]
        ids = [doc.metadata["squad_passage_id"] for doc in batch]
        successful_ids, skipped = add_documents_safely(store, batch, ids)
        indexed_count += len(successful_ids)
        skipped_passages.extend(skipped)
        print(f"  indexed {indexed_count}/{min(start + len(batch), len(docs))} passages")

    if skipped_passages:
        print(f"Skipped {len(skipped_passages)} passages during indexing.")
    return skipped_passages


def score_answer(answer: str, gold_answers: list[str], is_impossible: bool) -> dict[str, Any]:
    if is_impossible:
        no_answer = looks_like_no_answer(answer)
        return {
            "exact_match": float(no_answer),
            "token_f1": float(no_answer),
            "contains_gold": float(no_answer),
            "no_answer_correct": float(no_answer),
            "passed": no_answer,
        }

    if not gold_answers:
        return {
            "exact_match": 0.0,
            "token_f1": 0.0,
            "contains_gold": 0.0,
            "no_answer_correct": None,
            "passed": False,
        }

    best_em = max(exact_match(answer, gold) for gold in gold_answers)
    best_f1 = max(token_f1(answer, gold) for gold in gold_answers)
    gold_contained = contains_gold(answer, gold_answers)
    return {
        "exact_match": best_em,
        "token_f1": best_f1,
        "contains_gold": gold_contained,
        "no_answer_correct": None,
        "passed": bool(gold_contained or best_f1 >= 0.75),
    }


def answer_example(
    example: dict[str, Any],
    mode: str,
    store: Chroma,
    k: int,
    grade_retrieved: bool,
) -> dict[str, Any]:
    if mode == "oracle-context":
        docs = [
            Document(
                page_content=example["context"],
                metadata={
                    "source": example["passage_id"],
                    "squad_passage_id": example["passage_id"],
                    "title": example["title"],
                    "extension": ".squad",
                },
            )
        ]
        retrieved_ids = [example["passage_id"]]
    else:
        docs = store.similarity_search(example["question"], k=k)
        retrieved_ids = [
            doc.metadata.get("squad_passage_id") or doc.metadata.get("source")
            for doc in docs
        ]
        if grade_retrieved and docs:
            graded = grade_documents({"question": example["question"], "documents": docs})
            docs = graded.get("documents", [])

    state = generate(
        {
            "question": example["question"],
            "documents": docs,
            "generation_retries": 0,
        }
    )
    answer = state.get("generation", "")
    scores = score_answer(answer, example["answers"], example["is_impossible"])
    retrieval_hit = float(example["passage_id"] in retrieved_ids)

    return {
        "id": example["id"],
        "question": example["question"],
        "is_impossible": example["is_impossible"],
        "gold_answers": example["answers"],
        "answer": answer,
        "retrieved_ids": retrieved_ids,
        "gold_passage_id": example["passage_id"],
        "retrieval_hit": retrieval_hit,
        **scores,
    }


def answer_examples_with_full_graph(
    examples: list[dict[str, Any]],
    store: Chroma,
) -> list[dict[str, Any]]:
    import graph.graph as graph_module
    import graph.nodes.retrieve as retrieve_module

    original_vectorstore = retrieve_module.vectorstore
    retrieve_module.vectorstore = store
    app = graph_module.build_graph()

    rows = []
    try:
        for example in examples:
            result = app.invoke({"question": example["question"]})
            answer = result.get("generation", "")
            docs = result.get("documents", [])
            retrieved_ids = [
                doc.metadata.get("squad_passage_id") or doc.metadata.get("source")
                for doc in docs
                if doc.metadata.get("squad_passage_id") or doc.metadata.get("source")
            ]
            scores = score_answer(answer, example["answers"], example["is_impossible"])
            rows.append(
                {
                    "id": example["id"],
                    "question": example["question"],
                    "is_impossible": example["is_impossible"],
                    "gold_answers": example["answers"],
                    "answer": answer,
                    "retrieved_ids": retrieved_ids,
                    "gold_passage_id": example["passage_id"],
                    "retrieval_hit": float(example["passage_id"] in retrieved_ids),
                    "generation_retries": result.get("generation_retries"),
                    "source_count": len(result.get("sources", [])),
                    **scores,
                }
            )
    finally:
        retrieve_module.vectorstore = original_vectorstore

    return rows


def average(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    answerable = [row for row in rows if not row["is_impossible"]]
    impossible = [row for row in rows if row["is_impossible"]]
    return {
        "evaluated_questions": len(rows),
        "answerable_questions": len(answerable),
        "impossible_questions": len(impossible),
        "pass_rate": average([float(row["passed"]) for row in rows]),
        "exact_match": average([row["exact_match"] for row in rows]),
        "token_f1": average([row["token_f1"] for row in rows]),
        "contains_gold_rate": average([row["contains_gold"] for row in answerable]),
        "no_answer_accuracy": average(
            [row["no_answer_correct"] for row in impossible if row["no_answer_correct"] is not None]
        ),
        "retrieval_hit_rate": average([row["retrieval_hit"] for row in rows]),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate DeepSearch answer accuracy with SQuAD 2.0."
    )
    parser.add_argument("--split", choices=sorted(SQUAD_URLS), default="dev")
    parser.add_argument(
        "--mode",
        choices=["oracle-context", "retrieval", "full-graph"],
        default="oracle-context",
        help=(
            "oracle-context isolates answer generation; retrieval tests direct "
            "retrieval plus generation; full-graph runs the LangGraph pipeline."
        ),
    )
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT)
    parser.add_argument("--chroma-root", type=Path, default=DEFAULT_CHROMA_ROOT)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--insecure-download", action="store_true")
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--include-impossible", action="store_true")
    parser.add_argument("--grade-retrieved", action="store_true")
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--embedding-retries", type=int, default=5)
    parser.add_argument("--embedding-delay", type=float, default=0.15)
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument(
        "--index-limit",
        type=int,
        help="Limit indexed passages for smoke tests. Defaults to the full split.",
    )
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    try:
        dataset_path = args.data_root / f"{args.split}-v2.0.json"
        if args.download or not dataset_path.exists():
            dataset_path = download_squad(
                args.split,
                args.data_root,
                args.insecure_download,
            )

        all_examples = load_examples(
            dataset_path,
            include_impossible=args.include_impossible,
        )
        examples = all_examples
        if args.limit:
            examples = examples[: args.limit]

        store = get_store(
            split=args.split,
            chroma_root=args.chroma_root,
            rebuild=args.rebuild,
            embedding_retries=args.embedding_retries,
            embedding_delay=args.embedding_delay,
        )
        skipped_index_passages = []
        if args.mode in {"retrieval", "full-graph"}:
            index_examples = all_examples
            if args.index_limit:
                index_examples = all_examples[: args.index_limit]
            skipped_index_passages = index_passages(
                store,
                build_passage_documents(index_examples),
                args.batch_size,
            )

        if args.mode == "full-graph":
            rows = answer_examples_with_full_graph(examples, store)
        else:
            rows = [
                answer_example(
                    example=example,
                    mode=args.mode,
                    store=store,
                    k=args.k,
                    grade_retrieved=args.grade_retrieved,
                )
                for example in examples
            ]
        report = {
            "summary": summarize(rows),
            "mode": args.mode,
            "split": args.split,
            "skipped_index_passages": skipped_index_passages,
            "cases": rows,
        }
        report["summary"]["skipped_index_passages"] = len(skipped_index_passages)
    except Exception as exc:
        print(
            "SQuAD answer eval could not run. Check dataset files, Ollama models, "
            "and Chroma dependencies.",
            file=sys.stderr,
        )
        print(f"Original error: {exc}", file=sys.stderr)
        return 2

    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
