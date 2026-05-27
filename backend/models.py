from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from backend.database import Base


class News(Base):
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    url = Column(String(1024), unique=True, index=True, nullable=False)
    source = Column(String(100), nullable=False)
    publish_time = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    analysis = Column(Text, nullable=True)


class Wiki(Base):
    __tablename__ = "wiki"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(255), nullable=False, unique=True, index=True)
    category = Column(String(100), nullable=False)
    definition = Column(Text, nullable=False)
    origin = Column(Text, nullable=False)
    ai_analysis = Column(Text, nullable=True)
    embedding = Column(Text, nullable=True)
