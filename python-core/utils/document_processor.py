import os
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


# 🔥 Eksik olan: Dosya bazlı yükleme fonksiyonu
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


# (Tüm klasörü yüklemek istersen kullanılan eski fonksiyon)
def load_documents(directory: str):
    docs = []

    for filename in os.listdir(directory):
        path = os.path.join(directory, filename)

        if filename.endswith(".txt"):
            docs.extend(load_text_file(path))

        elif filename.endswith(".pdf"):
            docs.extend(load_pdf_file(path))

        elif filename.endswith(".docx"):
            docs.extend(load_docx_file(path))

        elif filename.endswith(".xlsx"):
            docs.extend(load_excel_file(path))

    return docs


from langchain_text_splitters import RecursiveCharacterTextSplitter

def split_documents_tiktoken(documents, chunk_size=250, chunk_overlap=0):
    """
    It splits documents into smaller pieces using a TikTok-based splitter.
    """
    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    docs_split = text_splitter.split_documents(documents)
    return docs_split
