import os

# Force Python HTTP clients to ignore system proxy in local dev.
os.environ["http_proxy"] = ""
os.environ["https_proxy"] = ""
os.environ["no_proxy"] = "*"

import json
import re
import traceback
from typing import Generator

import feedparser
import google.generativeai as genai
import models
from database import engine, get_db
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Load environment variables, prioritizing backend/.env.
BACKEND_ENV = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv()
load_dotenv(BACKEND_ENV, override=True)


def _red_warning(message: str) -> None:
    print(f"\033[91m{message}\033[0m")


def _current_gemini_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or "").strip()


gemini_key = _current_gemini_key()
if not gemini_key:
    _red_warning("WARNING: GEMINI_API_KEY not found. /analyze will fail until key is configured.")
else:
    print(f"GEMINI_API_KEY loaded: {gemini_key[:5]}..., len={len(gemini_key)}")
    genai.configure(api_key=gemini_key)

app = FastAPI()
models.Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class NewsRequest(BaseModel):
    id: int | None = None
    title: str
    content: str


def _friendly_ai_error(exc: Exception) -> str:
    name = type(exc).__name__.lower()
    message = str(exc).lower()
    if "timeout" in name or "timed out" in message:
        return "Gemini 分析超时，请稍后重试。"
    if "401" in message or "403" in message or "permission" in message or "auth" in message:
        return "Gemini 接口鉴权失败，请检查 GEMINI_API_KEY 是否正确。"
    if "429" in message or "quota" in message or "rate" in message:
        return "Gemini 请求过于频繁或额度不足，请稍后再试。"
    if "connection" in message or "network" in message:
        return "无法连接 Gemini 服务，请检查网络后重试。"
    return "分析暂时失败，请稍后重试。"


XINHUA_POLITICS_RSS = "http://www.xinhuanet.com/politics/news_politics.xml"
DEFAULT_NEWS_SOURCE = "新华网"
ANALYZE_STREAM_SYSTEM_PROMPT = (
    "你是一位资深的中文政经分析专家。请针对提供的新闻，从"
    "“政策风向”、“宏观经济影响”、“民众生活关联”三个维度进行深度解构，"
    "字数限制在 300 字以内。"
)


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


def _stream_text_as_ndjson(text: str, chunk_size: int = 24) -> Generator[bytes, None, None]:
    for i in range(0, len(text), chunk_size):
        piece = text[i : i + chunk_size]
        yield (json.dumps({"d": piece}, ensure_ascii=False) + "\n").encode("utf-8")


def _find_news_record(db: Session, request: NewsRequest) -> models.News | None:
    if request.id is not None:
        row = db.query(models.News).filter(models.News.id == request.id).first()
        if row:
            return row
    return db.query(models.News).filter(models.News.title == request.title).first()


def _gemini_stream_text(request: NewsRequest) -> Generator[str, None, None]:
    api_key = _current_gemini_key()
    if not api_key:
        raise RuntimeError("缺少 GEMINI_API_KEY，请在 backend/.env 中配置后重启后端。")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=ANALYZE_STREAM_SYSTEM_PROMPT,
    )
    stream = model.generate_content(_build_user_prompt(request), stream=True)
    for chunk in stream:
        piece = getattr(chunk, "text", None) or ""
        if piece:
            yield piece


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


def _analyze_ndjson_stream(request: NewsRequest, db: Session):
    """Stream analysis as NDJSON lines: {'d': '...'} or {'e': '...'}."""
    news_row = _find_news_record(db, request)
    if not news_row:
        yield (json.dumps({"e": "未找到对应新闻记录，请刷新新闻列表后重试。"}, ensure_ascii=False) + "\n").encode(
            "utf-8"
        )
        return

    if news_row.analysis:
        yield from _stream_text_as_ndjson(news_row.analysis)
        return

    try:
        chunks: list[str] = []
        for piece in _gemini_stream_text(request):
            chunks.append(piece)
            yield (json.dumps({"d": piece}, ensure_ascii=False) + "\n").encode("utf-8")

        final_analysis = "".join(chunks).strip()
        if not final_analysis:
            yield (json.dumps({"e": "分析服务未返回有效内容，请稍后重试。"}, ensure_ascii=False) + "\n").encode(
                "utf-8"
            )
            return

        news_row.title = request.title
        news_row.content = request.content
        news_row.analysis = final_analysis
        db.commit()
    except Exception as exc:
        db.rollback()
        print("AI stream error:")
        traceback.print_exc()
        yield (json.dumps({"e": _friendly_ai_error(exc)}, ensure_ascii=False) + "\n").encode("utf-8")


@app.post("/analyze")
async def analyze_news(request: NewsRequest, db: Session = Depends(get_db)):
    return StreamingResponse(
        _analyze_ndjson_stream(request, db),
        media_type="application/x-ndjson; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
import os

# --- 新增：强制让 Python 忽略系统代理 ---
os.environ["http_proxy"] = ""
os.environ["https_proxy"] = ""
os.environ["no_proxy"] = "*"
# ------------------------------------

import json
import re
import traceback
from typing import Optional

import feedparser
import openai
import models
from dotenv import load_dotenv
from database import engine, get_db
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

# 1. 导入必要的“零件”
# 从 backend 目录向上读取项目根目录 .env
ROOT_ENV = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv()
load_dotenv(ROOT_ENV)


def _red_warning(message: str) -> None:
    print(f"\033[91m{message}\033[0m")


def _current_api_key() -> str:
    return (os.getenv("DEEPSEEK_API_KEY") or "").strip()


_key = _current_api_key()
if not _key:
    _red_warning("WARNING: DEEPSEEK_API_KEY not found. /analyze will fail until key is configured.")
else:
    print(f"DEEPSEEK_API_KEY loaded: {_key[:5]}..., len={len(_key)}")

# 2. 创建一个名为 app 的“办事处”
app = FastAPI()
models.Base.metadata.create_all(bind=engine)

# 3. 配置“准行证”（CORS）
# 作用：告诉浏览器，允许 localhost:3000 (你的网页) 来访问 localhost:8000 (你的 AI)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有网页访问，开发环境最方便
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. 定义“数据快递单”格式
# 告诉程序，前端发过来的东西必须包含一个叫 content 的字符串
class NewsRequest(BaseModel):
    id: Optional[int] = None
    title: Optional[str] = None
    content: str


def _friendly_ai_error(exc: Exception) -> str:
    """将底层异常转换为用户可读的中文说明。"""
    for cls, message in (
        (getattr(openai, "APITimeoutError", None), "分析服务响应超时，请稍后再试。"),
        (getattr(openai, "APIConnectionError", None), "无法连接到分析服务，请检查网络或代理设置后重试。"),
        (getattr(openai, "RateLimitError", None), "当前请求过于频繁，请稍后再试。"),
        (getattr(openai, "AuthenticationError", None), "AI 接口鉴权失败，请检查 API 密钥是否有效。"),
        (getattr(openai, "BadRequestError", None), "请求参数不被 AI 服务接受，请稍后重试或联系管理员。"),
    ):
        if cls and isinstance(exc, cls):
            return message

    name = type(exc).__name__
    low = str(exc).lower()
    if "timeout" in name.lower() or "timed out" in low:
        return "分析服务响应超时，请稍后再试。"
    if "connection" in name.lower() or "connect" in low:
        return "无法连接到分析服务，请检查网络后重试。"
    if "401" in low or "403" in low or "unauthorized" in low or "forbidden" in low:
        return "AI 接口鉴权失败，请检查 API 密钥或账号权限。"
    if "429" in low or "rate" in low:
        return "当前请求过于频繁，请稍后再试。"

    return "分析暂时失败，请稍后重试。若问题持续，请查看服务端日志或联系管理员。"


XINHUA_POLITICS_RSS = "http://www.xinhuanet.com/politics/news_politics.xml"


def _strip_html(text: str) -> str:
    if not text:
        return ""
    plain = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", plain).strip()


def _entry_category(entry: object) -> str:
    tags = getattr(entry, "tags", None) or []
    if tags and isinstance(tags[0], dict):
        term = tags[0].get("term")
        if term:
            return str(term).strip()
    return "时政"


def _entry_id(entry: object, index: int) -> str:
    for attr in ("id", "guid", "link"):
        val = getattr(entry, attr, None)
        if val:
            return str(val).strip()
    return f"xinhua-politics-{index}"


@app.get("/news")
async def get_xinhua_politics_news(db: Session = Depends(get_db)):
    """优先返回数据库新闻；若数据库为空则抓取 RSS 入库后返回。"""
    try:
        existing_news = db.query(models.News).all()
        if not existing_news:
            feed = feedparser.parse(XINHUA_POLITICS_RSS)
            entries = getattr(feed, "entries", None) or []
            if not entries:
                raise HTTPException(
                    status_code=502,
                    detail="未能从 RSS 获取到条目，请检查网络或源站是否可用。",
                )

            for i, entry in enumerate(entries[:6]):
                title = (getattr(entry, "title", None) or "").strip()
                raw = (
                    getattr(entry, "summary", None)
                    or getattr(entry, "description", None)
                    or ""
                )
                summary = _strip_html(str(raw)) if raw else ""
                if not summary:
                    summary = title

                url = (getattr(entry, "link", None) or "").strip() or _entry_id(entry, i)
                publish_time = (getattr(entry, "published", None) or "").strip()
                db.add(
                    models.News(
                        title=title,
                        content=summary,
                        url=url,
                        source="新华网",
                        publish_time=publish_time,
                    )
                )
            db.commit()
            existing_news = db.query(models.News).all()

        return [
            {
                "id": row.id,
                "title": row.title,
                "summary": row.content,
                "category": row.source,
            }
            for row in existing_news
        ]
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=502, detail=str(e)) from e


ANALYZE_STREAM_SYSTEM_PROMPT = """你是时政与全球传播分析引擎。严禁寒暄、解释任务、重复题干或任何与三维度无关的废话。

用户会提供一段新闻（摘要或正文）。你必须且只能从下列三个维度用中文给出实质分析，并严格使用下列标记行划分板块（标记必须原样大写，独占一行，前后无空格）：

[MACRO]
宏观政策维度：国家导向、监管与产业政策、中长期行业趋势。

[PUBLIC]
民众体感维度：对就业与收入、日常生活成本、社会心理与预期的影响。

[INT]
国际反应维度：国际市场、资本流动、外媒或地缘政治层面的反馈。

输出要求（必须严格遵守）：
1. 正文必须按顺序出现且仅出现一次：[MACRO]、[PUBLIC]、[INT]，每个标记单独占一行。
2. 每个标记下一行起写该维度正文，可多段；不要使用 Markdown 代码围栏；不要输出第四个板块。
3. 每个维度至少有一句有信息量的分析。"""


def _find_news_record(db: Session, request: NewsRequest) -> Optional[models.News]:
    if request.id is not None:
        row = db.query(models.News).filter(models.News.id == request.id).first()
        if row:
            return row
    if request.title:
        return db.query(models.News).filter(models.News.title == request.title).first()
    return None


def _analyze_ndjson_stream(request: NewsRequest, db: Session):
    """将 DeepSeek 流式 token 以 NDJSON 行输出：{"d":"片段"} 或单行错误 {"e":"…"}。"""
    api_key = _current_api_key()
    if not api_key:
        err_line = json.dumps(
            {"e": "缺少 DEEPSEEK_API_KEY，请在 .env 配置后重启后端。"},
            ensure_ascii=False,
        ) + "\n"
        yield err_line.encode("utf-8")
        return

    news_row = _find_news_record(db, request)
    if news_row and news_row.analysis:
        cached_line = json.dumps({"d": news_row.analysis}, ensure_ascii=False) + "\n"
        yield cached_line.encode("utf-8")
        return

    try:
        client = openai.OpenAI(
            api_key=api_key,
            base_url=(os.getenv("BASE_URL") or "https://api.deepseek.com"),
        )
        stream = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": ANALYZE_STREAM_SYSTEM_PROMPT},
                {"role": "user", "content": request.content},
            ],
            stream=True,
        )
        chunks = []
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta is None:
                continue
            piece = getattr(delta, "content", None) or ""
            if not piece:
                continue
            chunks.append(piece)
            line = json.dumps({"d": piece}, ensure_ascii=False) + "\n"
            yield line.encode("utf-8")

        final_analysis = "".join(chunks).strip()
        if final_analysis and news_row:
            news_row.analysis = final_analysis
            db.commit()
    except Exception as e:
        db.rollback()
        print("AI stream error:")
        traceback.print_exc()
        err_line = json.dumps({"e": _friendly_ai_error(e)}, ensure_ascii=False) + "\n"
        yield err_line.encode("utf-8")


# 6. 创建“服务窗口”：分析新闻（NDJSON 流式，便于前端拼原文并按 [MACRO]/[PUBLIC]/[INT] 解析）
@app.post("/analyze")
async def analyze_news(request: NewsRequest, db: Session = Depends(get_db)):
    return StreamingResponse(
        _analyze_ndjson_stream(request, db),
        media_type="application/x-ndjson; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

# 7. 设定启动参数
if __name__ == "__main__":
    import uvicorn
    # 在 8000 端口启动服务
    uvicorn.run(app, host="0.0.0.0", port=8000)