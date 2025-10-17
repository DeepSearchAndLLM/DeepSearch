import os
from langchain_community.document_loaders import TextLoader

def load_documents(directory: str):
    docs = []
    for filename in os.listdir(directory):
        if filename.endswith(".txt"):
            path = os.path.join(directory, filename)
            loader = TextLoader(path, encoding="utf-8")
            docs.extend(loader.load())
    return docs
