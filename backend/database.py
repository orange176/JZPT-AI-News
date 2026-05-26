import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_DB_FILE = os.path.join(_BACKEND_DIR, "jzpt.db")
SQLALCHEMY_DATABASE_URL = "sqlite:///" + _DB_FILE.replace("\\", "/")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
