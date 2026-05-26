import os

# Force Python HTTP clients to ignore system proxy in local dev.
os.environ["http_proxy"] = ""
os.environ["https_proxy"] = ""
os.environ["no_proxy"] = "*"

import asyncio
import json
import logging
import math
import re
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import feedparser
import models
from database import SessionLocal, engine, get_db
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BACKEND_ENV = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv()
load_dotenv(BACKEND_ENV, override=True)

XINHUA_POLITICS_RSS = "http://www.xinhuanet.com/politics/news_politics.xml"
DEFAULT_NEWS_SOURCE = "新华网"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
WIKI_SEARCH_MIN_SCORE = float(os.getenv("WIKI_SEARCH_MIN_SCORE", "0.3"))
WIKI_SEARCH_EMBED_TIMEOUT = float(os.getenv("WIKI_SEARCH_EMBED_TIMEOUT", "20"))
WIKI_KEYWORD_SEARCH_MIN_SCORE = float(os.getenv("WIKI_KEYWORD_SEARCH_MIN_SCORE", "0.35"))
ANALYZE_STREAM_SYSTEM_PROMPT = (
    "你是一位资深的中文政经分析专家。请针对提供的新闻，从"
    "“政策风向”、“宏观经济影响”、“民众生活关联”三个维度进行深度解构，"
    "字数限制在 300 字以内。"
)
WIKI_ANALYZE_STREAM_SYSTEM_PROMPT = (
    "你是一位资深的中文政治学分析专家。请针对提供的键政百科词条，"
    "必须严格从【思想根源】、【舆论演变】、【光谱定位】三个维度进行深度解构。"
    "每个维度必须以对应标记独占一行开头，随后写该维度正文。"
    "总字数控制在 400 字以内。"
)
GEMINI_FIRST_CHUNK_TIMEOUT = float(os.getenv("GEMINI_FIRST_CHUNK_TIMEOUT", "30"))
GEMINI_INTER_CHUNK_TIMEOUT = float(os.getenv("GEMINI_INTER_CHUNK_TIMEOUT", "20"))
GEMINI_STREAM_MAX_SECONDS = float(os.getenv("GEMINI_STREAM_MAX_SECONDS", "120"))

logger = logging.getLogger("jzpt.backend")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def _red_warning(message: str) -> None:
    logger.warning(message)


def _current_gemini_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or "").strip()


gemini_key = _current_gemini_key()
client: genai.Client | None = None
if not gemini_key:
    _red_warning("WARNING: GEMINI_API_KEY not found. /analyze will fail until key is configured.")
else:
    logger.info("GEMINI_API_KEY loaded: %s..., len=%d", gemini_key[:5], len(gemini_key))
    client = genai.Client(
        api_key=gemini_key,
        http_options=types.HttpOptions(timeout=int(GEMINI_STREAM_MAX_SECONDS * 1000)),
    )

# ---------------------------------------------------------------------------
# App lifespan (scheduler)
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    from scheduler import scheduler, start_scheduler
    from seed_wiki import seed_wiki

    try:
        seed_wiki()
    except Exception as exc:
        logger.warning("Wiki auto-seed failed: %s: %s", type(exc).__name__, exc)

    start_scheduler()
    yield
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] 调度器已关闭。")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="JZPT Backend", version="1.0.0", lifespan=lifespan)
models.Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class NewsRequest(BaseModel):
    id: int | None = Field(default=None, description="新闻主键，优先用于精确匹配与缓存查询")
    title: str
    content: str


class WikiResponse(BaseModel):
    id: int
    word: str
    category: str
    definition: str
    origin: str
    ai_analysis: str | None = None


class WikiSearchResult(WikiResponse):
    score: float


class WikiAnalyzeRequest(BaseModel):
    id: int = Field(description="百科词条主键")
    word: str = Field(description="词条名称，id 未命中时降级匹配")


NDJSON_STREAM_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _strip_html(text: str) -> str:
    if not text:
        return ""
    plain = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", plain).strip()


def _entry_url(entry: object, index: int) -> str:
    for attr in ("link", "id", "guid"):
        value = (getattr(entry, attr, None) or "").strip()
        if value:
            return value
    return f"xinhua-politics-{index}"


def _build_user_prompt(request: NewsRequest) -> str:
    return f"新闻标题：{request.title}\n新闻内容：{request.content}"


def _ndjson_line(payload: dict) -> bytes:
    return (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")


async def _stream_text_as_ndjson_async(
    text: str, chunk_size: int = 24
) -> AsyncGenerator[bytes, None]:
    for i in range(0, len(text), chunk_size):
        yield _ndjson_line({"d": text[i : i + chunk_size]})
        await asyncio.sleep(0)


def _find_news_record(db: Session, request: NewsRequest) -> models.News | None:
    """Look up news by id first; fall back to exact title match for legacy clients."""
    if request.id is not None:
        row = db.query(models.News).filter(models.News.id == request.id).first()
        if row:
            return row
    title = request.title.strip()
    if title:
        return db.query(models.News).filter(models.News.title == title).first()
    return None


def _timeout_error_message() -> str:
    return "调用大模型超时，请检查网络或 API Key"


def _friendly_ai_error(exc: Exception) -> str:
    name = type(exc).__name__.lower()
    message = str(exc).lower()
    if isinstance(exc, asyncio.TimeoutError) or "timeout" in name or "timed out" in message:
        return _timeout_error_message()
    if "401" in message or "403" in message or "permission" in message or "auth" in message:
        return "Gemini 接口鉴权失败，请检查 GEMINI_API_KEY 是否正确。"
    if "429" in message or "quota" in message or "rate" in message:
        return "Gemini 请求过于频繁或额度不足，请稍后再试。"
    if "connection" in message or "network" in message:
        return "无法连接 Gemini 服务，请检查网络后重试。"
    return "分析暂时失败，请稍后重试。"


def _gemini_generate_config(system_prompt: str) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.7,
    )


def _chunk_text(chunk: types.GenerateContentResponse) -> str:
    try:
        text = chunk.text
    except Exception:
        return ""
    return (text or "").strip()


async def _gemini_stream_text_pieces(
    prompt: str,
    system_prompt: str,
    *,
    log_prefix: str,
    entity_id: int,
    stream_started: float,
) -> AsyncGenerator[str, None]:
    if client is None:
        raise RuntimeError("缺少 GEMINI_API_KEY，请在 backend/.env 中配置后重启后端。")

    logger.info("[%s] calling Gemini entity_id=%s model=%s", log_prefix, entity_id, GEMINI_MODEL)
    gemini_stream = await client.aio.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=prompt,
        config=_gemini_generate_config(system_prompt),
    )

    loop = asyncio.get_running_loop()
    deadline = loop.time() + GEMINI_STREAM_MAX_SECONDS
    awaiting_first = True
    stream_iter = gemini_stream.__aiter__()

    while True:
        wait_budget = GEMINI_FIRST_CHUNK_TIMEOUT if awaiting_first else GEMINI_INTER_CHUNK_TIMEOUT
        remaining = deadline - loop.time()
        if remaining <= 0:
            raise asyncio.TimeoutError("stream deadline exceeded")

        try:
            chunk = await asyncio.wait_for(
                stream_iter.__anext__(),
                timeout=min(wait_budget, remaining),
            )
        except StopAsyncIteration:
            break

        piece = _chunk_text(chunk)
        if not piece:
            continue

        if awaiting_first:
            logger.info(
                "[%s] Gemini first token entity_id=%s elapsed=%.2fs preview=%r",
                log_prefix,
                entity_id,
                time.monotonic() - stream_started,
                piece[:40],
            )
        awaiting_first = False
        yield piece


def _persist_analysis(news_id: int, title: str, content: str, analysis: str) -> None:
    db = SessionLocal()
    try:
        row = db.query(models.News).filter(models.News.id == news_id).first()
        if not row:
            logger.warning("persist_analysis: news_id=%s not found", news_id)
            return
        row.title = title
        row.content = content
        row.analysis = analysis
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("persist_analysis failed for news_id=%s", news_id)
    finally:
        db.close()


async def _analyze_ndjson_stream(
    request: NewsRequest, db: Session
) -> AsyncGenerator[bytes, None]:
    """Stream analysis as NDJSON: {"d": "..."} or {"e": "..."}."""
    stream_started = time.monotonic()
    logger.info("[analyze] start id=%s title=%r", request.id, request.title[:80])

    news_row = _find_news_record(db, request)
    if not news_row:
        logger.warning("[analyze] news not found id=%s title=%r", request.id, request.title[:80])
        yield _ndjson_line({"e": "未找到对应新闻记录，请刷新新闻列表后重试。"})
        return

    cached = (news_row.analysis or "").strip()
    if cached:
        logger.info(
            "[analyze] cache hit news_id=%s len=%d elapsed=%.2fs",
            news_row.id,
            len(cached),
            time.monotonic() - stream_started,
        )
        first_cached = True
        async for chunk in _stream_text_as_ndjson_async(cached):
            if first_cached:
                logger.info(
                    "[analyze] first chunk sent (cache) news_id=%s elapsed=%.2fs",
                    news_row.id,
                    time.monotonic() - stream_started,
                )
                first_cached = False
            yield chunk
        return

    api_key = _current_gemini_key()
    if not api_key:
        yield _ndjson_line({"e": "缺少 GEMINI_API_KEY，请在 backend/.env 中配置后重启后端。"})
        return

    news_id = news_row.id
    chunks: list[str] = []
    try:
        async for piece in _gemini_stream_text_pieces(
            _build_user_prompt(request),
            ANALYZE_STREAM_SYSTEM_PROMPT,
            log_prefix="analyze",
            entity_id=news_id,
            stream_started=stream_started,
        ):
            if not chunks:
                logger.info(
                    "[analyze] first chunk sent (live) news_id=%s elapsed=%.2fs preview=%r",
                    news_id,
                    time.monotonic() - stream_started,
                    piece[:40],
                )
            chunks.append(piece)
            yield _ndjson_line({"d": piece})
            await asyncio.sleep(0)
    except asyncio.TimeoutError:
        logger.warning(
            "[analyze] stream timeout news_id=%s elapsed=%.2fs",
            news_id,
            time.monotonic() - stream_started,
        )
        yield _ndjson_line({"e": _timeout_error_message()})
        return
    except Exception as exc:
        logger.error(
            "[analyze] Gemini stream error news_id=%s elapsed=%.2fs: %s: %s",
            news_id,
            time.monotonic() - stream_started,
            type(exc).__name__,
            exc,
        )
        yield _ndjson_line({"e": _friendly_ai_error(exc)})
        return

    final_analysis = "".join(chunks).strip()
    if not final_analysis:
        logger.warning("[analyze] empty Gemini response news_id=%s", news_id)
        yield _ndjson_line({"e": "分析服务未返回有效内容，请稍后重试。"})
        return

    logger.info(
        "[analyze] stream complete news_id=%s chars=%d elapsed=%.2fs persisting...",
        news_id,
        len(final_analysis),
        time.monotonic() - stream_started,
    )
    await asyncio.to_thread(
        _persist_analysis,
        news_id,
        request.title,
        request.content,
        final_analysis,
    )


def _find_wiki_record(db: Session, request: WikiAnalyzeRequest) -> models.Wiki | None:
    row = db.query(models.Wiki).filter(models.Wiki.id == request.id).first()
    if row:
        return row
    word = request.word.strip()
    if word:
        return db.query(models.Wiki).filter(models.Wiki.word == word).first()
    return None


def _persist_wiki_analysis(wiki_id: int, analysis: str) -> None:
    db = SessionLocal()
    try:
        row = db.query(models.Wiki).filter(models.Wiki.id == wiki_id).first()
        if not row:
            logger.warning("persist_wiki_analysis: wiki_id=%s not found", wiki_id)
            return
        row.ai_analysis = analysis
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("persist_wiki_analysis failed for wiki_id=%s", wiki_id)
    finally:
        db.close()


def _build_wiki_user_prompt(wiki_row: models.Wiki) -> str:
    return (
        f"词条名称：{wiki_row.word}\n"
        f"分类：{wiki_row.category}\n"
        f"基础释义：{wiki_row.definition}\n"
        f"起源与核心事件：{wiki_row.origin}"
    )


def _wiki_to_search_result(row: models.Wiki, score: float) -> WikiSearchResult:
    return WikiSearchResult(
        id=row.id,
        word=row.word,
        category=row.category,
        definition=row.definition,
        origin=row.origin,
        ai_analysis=row.ai_analysis,
        score=score,
    )


def _cosine_similarity(vector_a: list[float], vector_b: list[float]) -> float:
    if len(vector_a) != len(vector_b) or not vector_a:
        return 0.0
    dot_product = sum(a * b for a, b in zip(vector_a, vector_b))
    magnitude_a = math.sqrt(sum(a * a for a in vector_a))
    magnitude_b = math.sqrt(sum(b * b for b in vector_b))
    if magnitude_a == 0.0 or magnitude_b == 0.0:
        return 0.0
    return dot_product / (magnitude_a * magnitude_b)


def _embed_query_vector(query: str) -> list[float]:
    api_key = _current_gemini_key()
    if not api_key:
        raise RuntimeError("缺少 GEMINI_API_KEY，无法进行语义搜索。")

    embed_client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=int(WIKI_SEARCH_EMBED_TIMEOUT * 1000)),
    )
    emb_response = embed_client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=query,
    )
    embeddings = emb_response.embeddings or []
    if not embeddings or not embeddings[0].values:
        raise RuntimeError("无法生成查询向量，请稍后重试。")
    return embeddings[0].values


def _keyword_wiki_score(row: models.Wiki, query: str) -> float:
    q = query.strip().lower()
    if not q:
        return 1.0

    word = row.word.lower()
    if word == q:
        return 0.95
    if q in word or word in q:
        return 0.88

    category = row.category.lower()
    if q in category:
        return 0.78

    for field in (row.definition, row.origin):
        text = field.lower()
        if q in text:
            return min(0.82, 0.58 + len(q) / max(len(text), 1) * 0.35)

    return 0.0


def _keyword_search_wiki_results(rows: list[models.Wiki], query: str) -> list[WikiSearchResult]:
    scored_rows: list[tuple[float, models.Wiki]] = []
    for row in rows:
        score = _keyword_wiki_score(row, query)
        if score >= WIKI_KEYWORD_SEARCH_MIN_SCORE:
            scored_rows.append((score, row))
    scored_rows.sort(key=lambda item: item[0], reverse=True)
    return [_wiki_to_search_result(row, score) for score, row in scored_rows]


def _semantic_search_wiki_results(
    rows: list[models.Wiki], query_vector: list[float]
) -> list[WikiSearchResult]:
    scored_rows: list[tuple[float, models.Wiki]] = []
    for row in rows:
        if not row.embedding:
            continue
        vector = _parse_wiki_embedding(row.embedding)
        if vector is None:
            continue
        score = _cosine_similarity(query_vector, vector)
        if score < WIKI_SEARCH_MIN_SCORE:
            continue
        scored_rows.append((score, row))
    scored_rows.sort(key=lambda item: item[0], reverse=True)
    return [_wiki_to_search_result(row, score) for score, row in scored_rows]


def _parse_wiki_embedding(raw: str) -> list[float] | None:
    try:
        vector = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(vector, list):
        return None
    try:
        return [float(value) for value in vector]
    except (TypeError, ValueError):
        return None


async def _wiki_analyze_ndjson_stream(
    request: WikiAnalyzeRequest, db: Session
) -> AsyncGenerator[bytes, None]:
    """Stream wiki analysis as NDJSON: {"d": "..."} or {"e": "..."}."""
    stream_started = time.monotonic()
    logger.info("[wiki/analyze] start id=%s word=%r", request.id, request.word[:80])

    wiki_row = _find_wiki_record(db, request)
    if not wiki_row:
        logger.warning("[wiki/analyze] not found id=%s word=%r", request.id, request.word[:80])
        yield _ndjson_line({"e": "未找到对应百科词条，请刷新页面后重试。"})
        return

    cached = (wiki_row.ai_analysis or "").strip()
    if cached:
        logger.info(
            "[wiki/analyze] cache hit wiki_id=%s len=%d elapsed=%.2fs",
            wiki_row.id,
            len(cached),
            time.monotonic() - stream_started,
        )
        first_cached = True
        async for chunk in _stream_text_as_ndjson_async(cached):
            if first_cached:
                logger.info(
                    "[wiki/analyze] first chunk sent (cache) wiki_id=%s elapsed=%.2fs",
                    wiki_row.id,
                    time.monotonic() - stream_started,
                )
                first_cached = False
            yield chunk
        return

    api_key = _current_gemini_key()
    if not api_key:
        yield _ndjson_line({"e": "缺少 GEMINI_API_KEY，请在 backend/.env 中配置后重启后端。"})
        return

    wiki_id = wiki_row.id
    chunks: list[str] = []
    try:
        async for piece in _gemini_stream_text_pieces(
            _build_wiki_user_prompt(wiki_row),
            WIKI_ANALYZE_STREAM_SYSTEM_PROMPT,
            log_prefix="wiki/analyze",
            entity_id=wiki_id,
            stream_started=stream_started,
        ):
            if not chunks:
                logger.info(
                    "[wiki/analyze] first chunk sent (live) wiki_id=%s elapsed=%.2fs preview=%r",
                    wiki_id,
                    time.monotonic() - stream_started,
                    piece[:40],
                )
            chunks.append(piece)
            yield _ndjson_line({"d": piece})
            await asyncio.sleep(0)
    except asyncio.TimeoutError:
        logger.warning(
            "[wiki/analyze] stream timeout wiki_id=%s elapsed=%.2fs",
            wiki_id,
            time.monotonic() - stream_started,
        )
        yield _ndjson_line({"e": _timeout_error_message()})
        return
    except Exception as exc:
        logger.error(
            "[wiki/analyze] Gemini stream error wiki_id=%s elapsed=%.2fs: %s: %s",
            wiki_id,
            time.monotonic() - stream_started,
            type(exc).__name__,
            exc,
        )
        yield _ndjson_line({"e": _friendly_ai_error(exc)})
        return

    final_analysis = "".join(chunks).strip()
    if not final_analysis:
        logger.warning("[wiki/analyze] empty Gemini response wiki_id=%s", wiki_id)
        yield _ndjson_line({"e": "分析服务未返回有效内容，请稍后重试。"})
        return

    logger.info(
        "[wiki/analyze] stream complete wiki_id=%s chars=%d elapsed=%.2fs persisting...",
        wiki_id,
        len(final_analysis),
        time.monotonic() - stream_started,
    )
    await asyncio.to_thread(_persist_wiki_analysis, wiki_id, final_analysis)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/news")
async def get_xinhua_politics_news(db: Session = Depends(get_db)):
    """Fetch RSS news, dedupe by URL, then return DB rows."""
    try:
        feed = feedparser.parse(XINHUA_POLITICS_RSS)
        entries = getattr(feed, "entries", None) or []
        if not entries and not db.query(models.News).first():
            raise HTTPException(
                status_code=502,
                detail="未能从 RSS 获取到条目，请检查网络或源站是否可用。",
            )

        for i, entry in enumerate(entries[:6]):
            url = _entry_url(entry, i)
            exists = db.query(models.News.id).filter(models.News.url == url).first()
            if exists:
                continue

            title = (getattr(entry, "title", None) or "").strip()
            raw = (
                getattr(entry, "summary", None)
                or getattr(entry, "description", None)
                or ""
            )
            summary = _strip_html(str(raw)) if raw else ""
            if not summary:
                summary = title

            publish_time = (getattr(entry, "published", None) or "").strip()
            db.add(
                models.News(
                    title=title,
                    content=summary,
                    url=url,
                    source=DEFAULT_NEWS_SOURCE,
                    publish_time=publish_time,
                )
            )
        db.commit()

        rows = db.query(models.News).order_by(models.News.created_at.desc()).all()
        return [
            {
                "id": row.id,
                "title": row.title,
                "summary": row.content,
                "category": row.source,
            }
            for row in rows
        ]
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/analyze")
async def analyze_news(request: NewsRequest, db: Session = Depends(get_db)):
    return StreamingResponse(
        _analyze_ndjson_stream(request, db),
        media_type="application/x-ndjson; charset=utf-8",
        headers=NDJSON_STREAM_HEADERS,
    )


@app.get("/api/wiki", response_model=list[WikiResponse])
async def list_wiki_entries(db: Session = Depends(get_db)):
    """Return all wiki entries ordered by id ascending."""
    rows = db.query(models.Wiki).order_by(models.Wiki.id.asc()).all()
    return [
        WikiResponse(
            id=row.id,
            word=row.word,
            category=row.category,
            definition=row.definition,
            origin=row.origin,
            ai_analysis=row.ai_analysis,
        )
        for row in rows
    ]


@app.get("/api/wiki/search", response_model=list[WikiSearchResult])
async def search_wiki_entries(q: str = "", db: Session = Depends(get_db)):
    """Semantic wiki search with keyword fallback when embeddings or network are unavailable."""
    rows = db.query(models.Wiki).order_by(models.Wiki.id.asc()).all()
    query = q.strip()

    if not query:
        return [_wiki_to_search_result(row, 1.0) for row in rows]

    embedded_rows = [row for row in rows if row.embedding]
    if not embedded_rows or client is None:
        logger.info("[wiki/search] no embeddings or Gemini client, using keyword fallback q=%r", query)
        return _keyword_search_wiki_results(rows, query)

    query_vector: list[float] | None = None
    try:
        query_vector = await asyncio.wait_for(
            asyncio.to_thread(_embed_query_vector, query),
            timeout=WIKI_SEARCH_EMBED_TIMEOUT,
        )
    except Exception as exc:
        logger.warning(
            "[wiki/search] embedding failed, keyword fallback q=%r: %s: %s",
            query,
            type(exc).__name__,
            exc,
        )
        return _keyword_search_wiki_results(rows, query)

    semantic_results = _semantic_search_wiki_results(rows, query_vector)
    if semantic_results:
        return semantic_results

    logger.info("[wiki/search] semantic results empty, keyword fallback q=%r", query)
    return _keyword_search_wiki_results(rows, query)


@app.post("/api/wiki/analyze")
async def analyze_wiki_entry(request: WikiAnalyzeRequest, db: Session = Depends(get_db)):
    return StreamingResponse(
        _wiki_analyze_ndjson_stream(request, db),
        media_type="application/x-ndjson; charset=utf-8",
        headers=NDJSON_STREAM_HEADERS,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
