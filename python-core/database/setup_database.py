from database.vector_db import get_vector_db
from utils.document_processor import load_documents, split_documents_tiktoken
from config.settings import DOCUMENTS_DIR

def main():
    db = get_vector_db()
    documents = load_documents(DOCUMENTS_DIR)
    docs_split = split_documents_tiktoken(documents, chunk_size=250, chunk_overlap=0) #split documents
    db.add_documents(docs_split)
    #db.persist()

if __name__ == "__main__":
    main()
