import json
import os

os.environ.setdefault("http_proxy", "")
os.environ.setdefault("https_proxy", "")
os.environ.setdefault("no_proxy", "*")

from apscheduler.schedulers.background import BackgroundScheduler
from database import SessionLocal
from dotenv import load_dotenv
from google import genai
from google.genai import types
from models import Wiki

BACKEND_ENV = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv()
load_dotenv(BACKEND_ENV, override=True)

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
GEMINI_STREAM_MAX_SECONDS = float(os.getenv("GEMINI_STREAM_MAX_SECONDS", "120"))
SCHEDULER_WIKI_SYSTEM_PROMPT = (
    "你是一位资深的中文政治学分析专家。请针对提供的键政百科词条，"
    "必须严格从【思想根源】、【舆论演变】、【光谱定位】三个维度进行深度解构。"
    "每个维度必须以对应标记独占一行开头，随后写该维度正文。"
    "总字数控制在 300 字以内。"
)

CANDIDATES = [
    {
        "word": "回旋镖",
        "category": "网络迷因",
        "default_origin": "指互联网上某些言论或事件在一段时间后发生反转，精准伤害到原作者或相关阵营的现象。",
    },
    {
        "word": "塔西佗陷阱",
        "category": "政治学概念",
        "default_origin": "指当公权力遭遇公信力危机时，无论说真话还是假话，做好事还是坏事，都会被社会给予负面评价。",
    },
]

scheduler = BackgroundScheduler()


def _current_gemini_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or "").strip()


def _build_gemini_client() -> genai.Client:
    api_key = _current_gemini_key()
    if not api_key:
        raise RuntimeError("缺少 GEMINI_API_KEY，无法自动生成百科分析。")
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=int(GEMINI_STREAM_MAX_SECONDS * 1000)),
    )


def _generate_wiki_analysis(
    word: str, category: str, definition: str, client: genai.Client | None = None
) -> str:
    gemini_client = client or _build_gemini_client()
    user_prompt = (
        f"词条名称：{word}\n"
        f"分类：{category}\n"
        f"基础释义：{definition}"
    )
    response = gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=SCHEDULER_WIKI_SYSTEM_PROMPT,
            temperature=0.7,
        ),
    )
    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise RuntimeError("Gemini 未返回有效分析文本。")
    return text


def _generate_wiki_embedding(client: genai.Client, word: str, definition: str) -> str:
    emb_response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=f"{word} {definition}",
    )
    embeddings = emb_response.embeddings or []
    if not embeddings or not embeddings[0].values:
        raise RuntimeError("Gemini embed_content 未返回有效向量。")
    return json.dumps(embeddings[0].values)


def auto_fetch_and_expand_wiki() -> None:
    """Simulate hotspot fetch, dedupe by word, generate AI analysis, persist to wiki table."""
    print("[Scheduler] auto_fetch_and_expand_wiki 开始执行...")
    db = SessionLocal()
    try:
        for candidate in CANDIDATES:
            word = candidate["word"]
            try:
                exists = db.query(Wiki).filter(Wiki.word == word).first()
                if exists:
                    print(f"[Scheduler] 词条 {word} 已存在，跳过。")
                    continue

                definition = candidate["default_origin"]
                client = _build_gemini_client()
                print(f"[Scheduler] 发现新词 {word}，正在调用 Gemini 生成三维解构...")
                ai_analysis = _generate_wiki_analysis(
                    word, candidate["category"], definition, client=client
                )
                print(f"[Scheduler] 正在为词条 {word} 生成 embedding...")
                embedding = _generate_wiki_embedding(client, word, definition)

                db.add(
                    Wiki(
                        word=word,
                        category=candidate["category"],
                        definition=definition,
                        origin=definition,
                        ai_analysis=ai_analysis,
                        embedding=embedding,
                    )
                )
                db.commit()
                print(f"[Scheduler] 词条 {word} 已成功入库（含 AI 分析与 embedding）。")
            except Exception as exc:
                db.rollback()
                print(f"[Scheduler] 处理词条 {word} 失败：{type(exc).__name__}: {exc}")
    except Exception as exc:
        db.rollback()
        print(f"[Scheduler] 任务执行异常：{type(exc).__name__}: {exc}")
    finally:
        db.close()
        print("[Scheduler] auto_fetch_and_expand_wiki 执行完毕。")


def start_scheduler() -> None:
    if scheduler.running:
        print("[Scheduler] 调度器已在运行，跳过重复启动。")
        return

    scheduler.add_job(
        auto_fetch_and_expand_wiki,
        trigger="interval",
        seconds=120,
        id="wiki_auto_expand",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    print("[Scheduler] 后台调度器已启动，间隔 120 秒执行 auto_fetch_and_expand_wiki。")
