import os
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

def load_documents(directory: str):
    docs = []
    for filename in os.listdir(directory):
        if filename.endswith(".txt"):
            path = os.path.join(directory, filename)
            loader = TextLoader(path, encoding="utf-8")
            docs.extend(loader.load())
    return docs

def split_documents_tiktoken(documents, chunk_size=250, chunk_overlap=0):
    # chunk_size => Maximum size of chunks to return
    # chunk_overlap => Overlap in characters between chunks

    """
    It splits documents into smaller pieces using a TikTok-based splitter.
    """

    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    docs_split = text_splitter.split_documents(documents)
    return docs_split