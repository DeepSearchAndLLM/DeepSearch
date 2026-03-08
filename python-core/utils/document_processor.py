# utils/document_processor.py

import os
from datetime import datetime
import pdfplumber
from docx import Document as DocxDocument
from openpyxl import load_workbook
from langchain_community.document_loaders import TextLoader
from langchain_core.documents import Document


def load_text_file(path):
    loader = TextLoader(path, encoding="utf-8")
    return loader.load()


def load_pdf_file(path):
    docs = []
    with pdfplumber.open(path) as pdf:
        text = ""
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    docs.append(Document(page_content=text, metadata={"source": os.path.basename(path)}))
    return docs


def load_docx_file(path):
    doc = DocxDocument(path)
    full_text = "\n".join([p.text for p in doc.paragraphs])
    return [Document(page_content=full_text, metadata={"source": os.path.basename(path)})]


def load_excel_file(path):
    wb = load_workbook(path, data_only=True)
    text = ""
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        for row in ws.iter_rows(values_only=True):
            row_text = " ".join([str(cell) for cell in row if cell is not None])
            text += row_text + "\n"
    return [Document(page_content=text, metadata={"source": os.path.basename(path)})]


def load_documents_for_file(path: str):
    filename = os.path.basename(path)

    if filename.endswith(".txt"):
        return load_text_file(path)
    if filename.endswith(".pdf"):
        return load_pdf_file(path)
    if filename.endswith(".docx"):
        return load_docx_file(path)
    if filename.endswith(".xlsx"):
        return load_excel_file(path)

    return []


def get_file_metadata(file_path: str) -> dict:
    """
    gather metadata from file
    """
    import os
    from datetime import datetime

    file_stats = os.stat(file_path)

    return {
        'file_name': os.path.basename(file_path),
        'file_path': file_path,
        'file_size': file_stats.st_size,  # Byte
        'created_date': datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
        'modified_date': datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
        'extension': os.path.splitext(file_path)[1]
    }


from langchain_text_splitters import RecursiveCharacterTextSplitter


def split_documents_tiktoken(documents, chunk_size=250, chunk_overlap=0):
    """
    Chunking
    """
    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    docs_split = text_splitter.split_documents(documents)
    return docs_split


def add_chunk_metadata(docs_split, file_path: str):
    """
    add chunk metadata

    Args:
        docs_split: split documents
        file_path: file path of document

    Returns:
        documents with metadata
    """
    file_metadata = get_file_metadata(file_path)

    for i, doc in enumerate(docs_split):
        doc.metadata.update({
            "source": file_metadata['file_name'],
            "chunk_index": i,
            "total_chunks": len(docs_split),
            "chunk_size": len(doc.page_content),
            "file_size": file_metadata['file_size'],
            "file_path": file_metadata['file_path'],
            "upload_date": file_metadata['modified_date'],
            "extension": file_metadata['extension']
        })

    return docs_split