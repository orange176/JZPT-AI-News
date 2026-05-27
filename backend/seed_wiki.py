"""Initialize wiki table and inject seed data if empty."""

import os

from backend import models
from backend.database import SessionLocal, engine
from backend.models import Wiki
from sqlalchemy import text

WIKI_SEED_TRY_EMBEDDINGS = os.getenv("WIKI_SEED_TRY_EMBEDDINGS", "").lower() in (
    "1",
    "true",
    "yes",
)

WIKI_SEED_DATA: list[dict[str, str]] = [
    {
        "word": "加速主义",
        "category": "理论流派",
        "definition": (
            "加速主义（Accelerationism）是一组主张通过「加速」现有社会—技术—资本体系的内生矛盾，"
            "以促成结构性跃迁或系统崩溃的政治—哲学思潮。在网络键政语境中，它常被简化为对"
            "「越加速、越接近临界点」的想象，既包含对技术资本主义的批判性利用，也衍生出虚无主义式的解构表达。"
        ),
        "origin": (
            "概念可追溯至 20 世纪欧陆哲学对现代性与资本逻辑的反思；2010 年代后在英文互联网与中文键政圈"
            "经由 Nick Land、Left Accelerationism 等讨论被二次传播。中文社群中，加速主义常与「大加速」"
            "「入关前夜」等模因并置，成为描述社会节奏、技术迭代与政策周期叠加的隐喻框架。"
        ),
        "ai_analysis": (
            "【思想根源】\n"
            "思想根源可追溯至对现代性「不可逆加速」的哲学观察：资本、技术与信息流动构成自我强化的正反馈环。"
            "左翼加速主义试图「加速到尽头以触发新秩序」，右翼/虚无主义变体则倾向于将加速本身当作解构旧结构的工具。"
            "中文语境还叠加了工业党、技术乐观主义与网络亚文化的交叉影响。\n\n"
            "【舆论演变】\n"
            "舆论演变呈现「学术概念 → 网络模因 → 键政标签」的三级扩散。早期讨论聚焦理论与未来学；"
            "中期在社交媒体被简化为「越乱越快越好」的梗；近期则分化为一派严肃引用、一派反讽解构。"
            "平台算法对极端表达的放大，进一步强化了加速叙事的可见度与误读风险。\n\n"
            "【光谱定位】\n"
            "光谱定位横跨左翼未来主义、技术自由主义与网络虚无主义，难以用传统左右轴单一标注。"
            "若置于「结构变革 vs 秩序维护」轴上，偏变革一端；若置于「理性规划 vs 民粹情绪」轴上，"
            "则呈现高度分裂——既有技术精英话语，也有情绪化模因消费。"
        ),
    },
    {
        "word": "入关学",
        "category": "地缘战略",
        "definition": (
            "入关学是中文互联网键政话语中的一种地缘—文明想象：借明清「入关」历史隐喻，讨论大国竞争、"
            "秩序更替与文明冲突。其核心并非历史学考证，而是一种将国际政治「棋盘化」的叙事工具，"
            "用于解释权力转移、联盟重组与舆论动员。"
        ),
        "origin": (
            "约 2019—2020 年在知乎、B 站等平台兴起，被广泛认为与键政作者「山高县」及其追随者的话语生产密切相关。"
            "山高县以「入关」类比大国博弈中的攻守易势，提出「工业国 vs 金融国」「陆权 vs 海权」等简化模型，"
            "在中文互联网引发大量二次创作与争议。此后该概念逐渐脱离严谨地缘分析，"
            "演变为带有戏谑与对抗色彩的亚文化符号。"
        ),
        "ai_analysis": (
            "【思想根源】\n"
            "思想根源混合了历史类比思维、现实主义国际关系观与网络集体身份建构。"
            "它将复杂的地缘博弈压缩为「攻守易势」的戏剧叙事，满足公众对大势判断的简化需求，"
            "同时承接了长期存在的「文明兴衰」焦虑。山高县等人的文本为这一话语提供了最初的叙事模板。\n\n"
            "【舆论演变】\n"
            "舆论演变从少数键政圈层的隐喻，扩散为泛政治讨论的常用修辞。支持者视其为「打破西方中心叙事」的话语武器；"
            "批评者则认为其过度简化历史、助长对立。平台内容监管与话题周期更替，使其热度呈脉冲式起伏，"
            "「入关」本身亦成为可被反讽与解构的网络梗。\n\n"
            "【光谱定位】\n"
            "光谱定位偏民族主义—现实主义交叉地带，常与「工业党」「强国家能力」话语相邻。"
            "在国际观上强调竞争与秩序重构，在国内观上则可能被不同阵营选择性引用——"
            "既可用于凝聚共识，也可能滑向排外或历史决定论。"
        ),
    },
    {
        "word": "工业党",
        "category": "网络群体",
        "definition": (
            "工业党是中文互联网中强调「工业化优先、国家组织能力、长期主义建设」的键政群体标签。"
            "其典型主张包括：重视制造业与基础设施、强调科技自主、以「工程师思维」审视政策与产业路径，"
            "并对「金融化」「去工业化」表达警惕。"
        ),
        "origin": (
            "2000 年代后在论坛与博客圈逐步成型，2010 年代在知乎等平台获得广泛讨论，"
            "与「小粉红」「自由派」等标签形成并置。标志性议题包括高铁、核电、航天、产业链安全等，"
            "常被用作衡量「是否真正重视实体强国」的话语坐标。"
        ),
        "ai_analysis": (
            "【思想根源】\n"
            "思想根源来自近代以来「实业救国」「工程师治国」的知识传统，以及对冷战后期全球产业分工变迁的观察。"
            "工业党将「可制造、可迭代、可规模复制」视为国家竞争力的核心，"
            "对虚拟经济泡沫与短期选举导向的政策保持结构性怀疑。\n\n"
            "【舆论演变】\n"
            "舆论演变经历了「技术理性圈层 → 公共政策讨论 → 网络身份标签」的路径。"
            "早期以数据和工程案例说服为主；中期在热点事件中与民族主义、贸易战议题耦合；"
            "近期则面临「标签化」风险——支持者与被贴标签者之间的边界日益模糊。\n\n"
            "【光谱定位】\n"
            "光谱定位整体偏国家能力主义与中长期发展主义，经济上接近生产主义，"
            "政治上常表现为务实中间偏强国家一端。与自由市场原教旨主义距离较远，"
            "与部分左翼产业政策的工具层面存在交集，但价值基础与分配议题上仍可能分歧显著。"
        ),
    },
]


def dedupe_wiki_rows(db) -> int:
    """Remove duplicate wiki rows, keeping the lowest id per word."""
    rows = db.query(Wiki).order_by(Wiki.id.asc()).all()
    seen_words: set[str] = set()
    removed = 0
    for row in rows:
        if row.word in seen_words:
            db.delete(row)
            removed += 1
        else:
            seen_words.add(row.word)
    if removed:
        db.commit()
    return removed


def ensure_wiki_word_unique_index() -> None:
    """Ensure wiki.word has a unique index on existing SQLite databases."""
    with engine.begin() as conn:
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_word ON wiki (word)"))


def seed_wiki() -> None:
    models.Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        removed = dedupe_wiki_rows(db)
        if removed:
            print(f"Removed {removed} duplicate wiki entries.")
    finally:
        db.close()

    ensure_wiki_word_unique_index()

    db = SessionLocal()
    try:
        existing_words = {word for (word,) in db.query(Wiki.word).all()}
        missing_rows = [row for row in WIKI_SEED_DATA if row["word"] not in existing_words]
        if not missing_rows:
            print("All seed wiki words already exist, skip seeding.")
            return

        embedded_count = 0
        generate_wiki_embedding = None
        if WIKI_SEED_TRY_EMBEDDINGS:
            try:
                from scheduler import _build_gemini_client, _generate_wiki_embedding

                generate_wiki_embedding = _generate_wiki_embedding
                client = _build_gemini_client()
            except Exception as exc:
                client = None
                print(f"Warning: Gemini embeddings unavailable ({exc}).")
        else:
            client = None
            if not existing_words:
                print(
                    "Seeding wiki entries without embeddings "
                    "(set WIKI_SEED_TRY_EMBEDDINGS=1 to enable)."
                )

        for row in missing_rows:
            embedding = None
            if client is not None and generate_wiki_embedding is not None:
                try:
                    embedding = generate_wiki_embedding(client, row["word"], row["definition"])
                    embedded_count += 1
                    print(f"  embedding generated for: {row['word']}")
                except Exception as exc:
                    print(
                        f"  warning: embedding skipped for {row['word']} "
                        f"({type(exc).__name__}: {exc})"
                    )
            db.add(Wiki(**row, embedding=embedding))

        db.commit()
        print(
            f"Seeded {len(missing_rows)} wiki entries "
            f"({embedded_count} with embeddings)."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_wiki()
