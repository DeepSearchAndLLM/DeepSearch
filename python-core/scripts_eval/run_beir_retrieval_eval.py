import argparse
import csv
import json
import shutil
import ssl
import sys
import time
import urllib.request
import zipfile
from collections import defaultdict
from math import log2
from pathlib import Path
from typing import Any, Iterable

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from models.embedding_model import (
    get_embedding_collection_name,
    get_embedding_model,
)


BEIR_DOWNLOAD_URL = (
    "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/{dataset}.zip"
)
DEFAULT_DATA_ROOT = BASE_DIR / "evals" / "beir_datasets"
DEFAULT_CHROMA_ROOT = BASE_DIR / "evals" / "beir_chroma"


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


def dataset_dir(data_root: Path, dataset: str) -> Path:
    return data_root / dataset


def download_dataset(dataset: str, data_root: Path, insecure_download: bool) -> Path:
    data_root.mkdir(parents=True, exist_ok=True)
    target_dir = dataset_dir(data_root, dataset)
    if (target_dir / "corpus.jsonl").exists():
        return target_dir

    archive_path = data_root / f"{dataset}.zip"
    url = BEIR_DOWNLOAD_URL.format(dataset=dataset)
    print(f"Downloading {url}")

    if insecure_download:
        context = ssl._create_unverified_context()
    else:
        try:
            import certifi

            context = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            context = ssl.create_default_context()

    with urllib.request.urlopen(url, context=context) as response:
        archive_path.write_bytes(response.read())

    with zipfile.ZipFile(archive_path) as archive:
        archive.extractall(data_root)

    if not (target_dir / "corpus.jsonl").exists():
        raise FileNotFoundError(
            f"Downloaded archive did not produce {target_dir / 'corpus.jsonl'}"
        )
    return target_dir


def resolve_dataset_path(
    dataset: str,
    data_root: Path,
    should_download: bool,
    insecure_download: bool,
) -> Path:
    path = dataset_dir(data_root, dataset)
    if path.exists():
        return path
    if should_download:
        return download_dataset(dataset, data_root, insecure_download)
    raise FileNotFoundError(
        f"BEIR dataset not found at {path}. Re-run with --download or put the "
        "BEIR files there manually."
    )


def iter_jsonl(path: Path) -> Iterable[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def load_queries(path: Path) -> dict[str, str]:
    return {row["_id"]: row["text"] for row in iter_jsonl(path)}


def load_qrels(path: Path) -> dict[str, dict[str, int]]:
    qrels: dict[str, dict[str, int]] = defaultdict(dict)
    with path.open("r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if not row or row[0].lower() in {"query-id", "query_id", "qid"}:
                continue
            if len(row) < 3:
                continue
            query_id, corpus_id, score = row[0], row[1], int(float(row[2]))
            if score > 0:
                qrels[query_id][corpus_id] = score
    return dict(qrels)


def qrels_path(path: Path, split: str) -> Path:
    candidate = path / "qrels" / f"{split}.tsv"
    if candidate.exists():
        return candidate

    available = sorted((path / "qrels").glob("*.tsv"))
    if not available:
        raise FileNotFoundError(f"No qrels TSV files found under {path / 'qrels'}")
    names = ", ".join(item.name for item in available)
    raise FileNotFoundError(
        f"Missing qrels/{split}.tsv. Available qrels files: {names}"
    )


def get_store(
    dataset: str,
    chroma_root: Path,
    rebuild: bool,
    batch_embedding: bool,
    embedding_retries: int,
    embedding_delay: float,
) -> Chroma:
    persist_dir = chroma_root / dataset
    if rebuild and persist_dir.exists():
        shutil.rmtree(persist_dir)
    persist_dir.mkdir(parents=True, exist_ok=True)

    embedding_model = get_embedding_model()
    if not batch_embedding:
        embedding_model = SerialEmbeddings(
            embedding_model,
            retries=embedding_retries,
            delay_seconds=embedding_delay,
        )

    return Chroma(
        collection_name=get_embedding_collection_name(
            f"beir_{dataset.replace('-', '_')}"
        ),
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
    except Exception as batch_error:
        print(f"  batch failed; retrying {len(docs)} documents one by one")

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


def index_corpus(
    store: Chroma,
    corpus_path: Path,
    batch_size: int,
    max_docs: int | None,
) -> tuple[set[str] | None, list[dict[str, str]]]:
    if collection_count(store) > 0:
        print(f"Using existing Chroma index with {collection_count(store)} documents.")
        return None, []

    print("Indexing BEIR corpus into an isolated Chroma collection...")
    batch_docs: list[Document] = []
    batch_ids: list[str] = []
    indexed_scope_ids: set[str] | None = set() if max_docs else None
    skipped_documents: list[dict[str, str]] = []
    attempted_count = 0
    indexed_count = 0

    for row in iter_jsonl(corpus_path):
        corpus_id = row["_id"]
        title = row.get("title") or ""
        text = row.get("text") or ""
        page_content = f"{title}\n\n{text}".strip()
        if not page_content:
            continue

        batch_docs.append(
            Document(
                page_content=page_content,
                metadata={
                    "source": corpus_id,
                    "title": title,
                    "beir_id": corpus_id,
                },
            )
        )
        batch_ids.append(corpus_id)
        attempted_count += 1

        if len(batch_docs) >= batch_size:
            successful_ids, skipped = add_documents_safely(store, batch_docs, batch_ids)
            if indexed_scope_ids is not None:
                indexed_scope_ids.update(successful_ids)
            skipped_documents.extend(skipped)
            indexed_count += len(successful_ids)
            batch_docs = []
            batch_ids = []
            print(f"  indexed {indexed_count}/{attempted_count} documents")

        if max_docs and attempted_count >= max_docs:
            break

    if batch_docs:
        successful_ids, skipped = add_documents_safely(store, batch_docs, batch_ids)
        if indexed_scope_ids is not None:
            indexed_scope_ids.update(successful_ids)
        skipped_documents.extend(skipped)
        indexed_count += len(successful_ids)

    print(f"Indexed {indexed_count}/{attempted_count} documents.")
    if skipped_documents:
        print(f"Skipped {len(skipped_documents)} documents during indexing.")
    return indexed_scope_ids, skipped_documents


def precision_at_k(relevant_ids: set[str], retrieved_ids: list[str], k: int) -> float:
    if not retrieved_ids:
        return 0.0
    top_k = retrieved_ids[:k]
    return len(set(top_k) & relevant_ids) / k


def recall_at_k(relevant_ids: set[str], retrieved_ids: list[str], k: int) -> float:
    if not relevant_ids:
        return 0.0
    top_k = retrieved_ids[:k]
    return len(set(top_k) & relevant_ids) / len(relevant_ids)


def reciprocal_rank(relevant_ids: set[str], retrieved_ids: list[str]) -> float:
    for index, doc_id in enumerate(retrieved_ids, start=1):
        if doc_id in relevant_ids:
            return 1.0 / index
    return 0.0


def ndcg_at_k(relevant_ids: set[str], retrieved_ids: list[str], k: int) -> float:
    dcg = 0.0
    for index, doc_id in enumerate(retrieved_ids[:k], start=1):
        if doc_id in relevant_ids:
            dcg += 1.0 / log2(index + 1)

    ideal_hits = min(len(relevant_ids), k)
    if ideal_hits == 0:
        return 0.0
    ideal_dcg = sum(1.0 / log2(index + 1) for index in range(1, ideal_hits + 1))
    return dcg / ideal_dcg


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def evaluate(
    store: Chroma,
    queries: dict[str, str],
    qrels: dict[str, dict[str, int]],
    k: int,
    limit_queries: int | None,
    indexed_ids: set[str] | None,
) -> dict[str, Any]:
    rows = []
    skipped = 0

    for query_id, relevant in qrels.items():
        relevant_ids = set(relevant)
        if indexed_ids is not None:
            relevant_ids &= indexed_ids
        if not relevant_ids or query_id not in queries:
            skipped += 1
            continue

        docs = store.similarity_search(queries[query_id], k=k)
        retrieved_ids = [
            doc.metadata.get("beir_id") or doc.metadata.get("source")
            for doc in docs
            if doc.metadata.get("beir_id") or doc.metadata.get("source")
        ]
        rows.append(
            {
                "query_id": query_id,
                "hit": 1.0 if set(retrieved_ids) & relevant_ids else 0.0,
                "precision": precision_at_k(relevant_ids, retrieved_ids, k),
                "recall": recall_at_k(relevant_ids, retrieved_ids, k),
                "mrr": reciprocal_rank(relevant_ids, retrieved_ids),
                "ndcg": ndcg_at_k(relevant_ids, retrieved_ids, k),
                "relevant_ids": sorted(relevant_ids),
                "retrieved_ids": retrieved_ids,
            }
        )

        if limit_queries and len(rows) >= limit_queries:
            break

    return {
        "summary": {
            "evaluated_queries": len(rows),
            "skipped_queries": skipped,
            f"hit_rate@{k}": mean([row["hit"] for row in rows]),
            f"precision@{k}": mean([row["precision"] for row in rows]),
            f"recall@{k}": mean([row["recall"] for row in rows]),
            f"mrr@{k}": mean([row["mrr"] for row in rows]),
            f"ndcg@{k}": mean([row["ndcg"] for row in rows]),
        },
        "cases": rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate DeepSearch embeddings/retrieval with a BEIR dataset."
    )
    parser.add_argument("--dataset", default="scifact")
    parser.add_argument("--split", default="test")
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT)
    parser.add_argument("--chroma-root", type=Path, default=DEFAULT_CHROMA_ROOT)
    parser.add_argument("--download", action="store_true")
    parser.add_argument(
        "--insecure-download",
        action="store_true",
        help="Disable TLS certificate verification for dataset download.",
    )
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--k", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument(
        "--batch-embedding",
        action="store_true",
        help="Use Ollama's batch embedding endpoint instead of safer serial embedding.",
    )
    parser.add_argument("--embedding-retries", type=int, default=3)
    parser.add_argument("--embedding-delay", type=float, default=0.05)
    parser.add_argument("--max-docs", type=int)
    parser.add_argument("--limit-queries", type=int)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    try:
        path = resolve_dataset_path(
            args.dataset,
            args.data_root,
            args.download,
            args.insecure_download,
        )
        queries = load_queries(path / "queries.jsonl")
        qrels = load_qrels(qrels_path(path, args.split))
        store = get_store(
            args.dataset,
            args.chroma_root,
            args.rebuild,
            args.batch_embedding,
            args.embedding_retries,
            args.embedding_delay,
        )
        indexed_ids, skipped_index_documents = index_corpus(
            store=store,
            corpus_path=path / "corpus.jsonl",
            batch_size=args.batch_size,
            max_docs=args.max_docs,
        )
        report = evaluate(
            store=store,
            queries=queries,
            qrels=qrels,
            k=args.k,
            limit_queries=args.limit_queries,
            indexed_ids=indexed_ids,
        )
        report["summary"]["skipped_index_documents"] = len(skipped_index_documents)
        report["skipped_index_documents"] = skipped_index_documents
    except Exception as exc:
        print(
            "BEIR eval could not run. Check dataset files, Ollama, embedding model, "
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
