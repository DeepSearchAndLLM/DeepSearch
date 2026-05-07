# DeepSearch Eval

This folder is for project and benchmark evaluations.

## BEIR Retrieval Eval

BEIR is useful for testing DeepSearch's retrieval layer with public golden sets. A BEIR dataset contains:

- `corpus.jsonl`: documents/passages.
- `queries.jsonl`: user questions/search queries.
- `qrels/*.tsv`: golden relevance labels that map each query to relevant document IDs.

The BEIR runner keeps benchmark indexes separate from the product Chroma DB, so it will not pollute `python-core/chroma_db`.

## Quick Start

Start Ollama first and make sure the embedding model in `config/settings.py` is available.

For a small first benchmark, use SciFact:

```bash
python-core/.venv/bin/python python-core/scripts_eval/run_beir_retrieval_eval.py \
  --dataset scifact \
  --download \
  --rebuild \
  --k 10 \
  --output python-core/evals/beir_scifact_report.json
```

If you already downloaded a BEIR dataset manually, place it here:

```text
python-core/evals/beir_datasets/scifact/corpus.jsonl
python-core/evals/beir_datasets/scifact/queries.jsonl
python-core/evals/beir_datasets/scifact/qrels/test.tsv
```

Then run without `--download`.

## Recommended Datasets

- `scifact`: small, clean scientific fact retrieval; best first integration test.
- `nfcorpus`: small biomedical/nutrition retrieval.
- `fiqa`: finance retrieval.
- `hotpotqa`: multi-hop Wikipedia retrieval; larger.
- `nq`: Natural Questions retrieval; larger.
- `msmarco`: very large search benchmark; use after the pipeline is stable.

## Metrics

- `hit_rate@k`: at least one golden relevant document appears in the top `k`.
- `precision@k`: fraction of top `k` results that are relevant.
- `recall@k`: fraction of all known relevant documents found in top `k`.
- `mrr@k`: how early the first relevant document appears.
- `ndcg@k`: ranking quality with higher weight for relevant docs near the top.

This evaluates retrieval only. To evaluate answer generation, add a second step that asks DeepSearch to answer from the retrieved documents and grades groundedness or answer correctness.

## SQuAD 2.0 Answer Eval

SQuAD 2.0 is useful for testing answer generation because it contains:

- `context`: the paragraph that contains or does not contain the answer.
- `question`: the user question.
- `answers`: accepted gold answer spans.
- `is_impossible`: whether the question should not be answered from the paragraph.

Run a small answer-generation smoke test with oracle context:

```bash
python-core/.venv/bin/python python-core/scripts_eval/run_squad_answer_eval.py \
  --split dev \
  --download \
  --mode oracle-context \
  --limit 25 \
  --output python-core/evals/squad_oracle_report.json
```

Run end-to-end retrieval plus answer generation:

```bash
python-core/.venv/bin/python python-core/scripts_eval/run_squad_answer_eval.py \
  --split dev \
  --mode retrieval \
  --rebuild \
  --limit 100 \
  --k 5 \
  --output python-core/evals/squad_retrieval_report.json
```

Use `oracle-context` to isolate whether the LLM can extract the right answer when the correct paragraph is already known. Use `retrieval` to test the fuller RAG path: retrieve a paragraph, generate an answer, then compare it to SQuAD's gold answer spans.
