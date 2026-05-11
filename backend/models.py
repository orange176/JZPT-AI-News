from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from database import Base


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
