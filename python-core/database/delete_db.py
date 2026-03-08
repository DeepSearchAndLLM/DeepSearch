import shutil
from config.settings import VECTOR_DB_PATH


if __name__ == "__main__":
    shutil.rmtree(VECTOR_DB_PATH, ignore_errors=True)
    print('Old Chroma DB deleted')
