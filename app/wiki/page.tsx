"use client";

import { useDataMode } from "@/contexts/DataModeContext";
import { BookOpen, Loader2, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const WIKI_LIST_URL = `${API_BASE_URL.replace(/\/$/, "")}/api/wiki`;
const WIKI_SEARCH_URL = `${API_BASE_URL.replace(/\/$/, "")}/api/wiki/search`;
const WIKI_ANALYZE_URL = `${API_BASE_URL.replace(/\/$/, "")}/api/wiki/analyze`;
const WIKI_SEARCH_DEBOUNCE_MS = 400;

type WikiAiAnalysis = {
  ideologicalRoots: string;
  publicOpinion: string;
  spectrumPosition: string;
};

type WikiEntry = {
  id: string;
  category: string;
  title: string;
  basicDefinition: string;
  originEvents: string;
  aiAnalysis?: WikiAiAnalysis;
};

const WIKI_MOCK_ENTRIES: WikiEntry[] = [
  {
    id: "mock-1",
    category: "理论流派",
    title: "加速主义",
    basicDefinition:
      "加速主义（Accelerationism）是一组主张通过「加速」现有社会—技术—资本体系的内生矛盾，以促成结构性跃迁或系统崩溃的政治—哲学思潮。在网络键政语境中，它常被简化为对「越加速、越接近临界点」的想象，既包含对技术资本主义的批判性利用，也衍生出虚无主义式的解构表达。",
    originEvents:
      "概念可追溯至 20 世纪欧陆哲学对现代性与资本逻辑的反思；2010 年代后在英文互联网与中文键政圈经由 Nick Land、Left Accelerationism 等讨论被二次传播。中文社群中，加速主义常与「大加速」「入关前夜」等模因并置，成为描述社会节奏、技术迭代与政策周期叠加的隐喻框架。",
    aiAnalysis: {
      ideologicalRoots:
        "思想根源可追溯至对现代性「不可逆加速」的哲学观察：资本、技术与信息流动构成自我强化的正反馈环。左翼加速主义试图「加速到尽头以触发新秩序」，右翼/虚无主义变体则倾向于将加速本身当作解构旧结构的工具。中文语境还叠加了工业党、技术乐观主义与网络亚文化的交叉影响。",
      publicOpinion:
        "舆论演变呈现「学术概念 → 网络模因 → 键政标签」的三级扩散。早期讨论聚焦理论与未来学；中期在社交媒体被简化为「越乱越快越好」的梗；近期则分化为一派严肃引用、一派反讽解构。平台算法对极端表达的放大，进一步强化了加速叙事的可见度与误读风险。",
      spectrumPosition:
        "光谱定位横跨左翼未来主义、技术自由主义与网络虚无主义，难以用传统左右轴单一标注。若置于「结构变革 vs 秩序维护」轴上，偏变革一端；若置于「理性规划 vs 民粹情绪」轴上，则呈现高度分裂——既有技术精英话语，也有情绪化模因消费。",
    },
  },
  {
    id: "mock-2",
    category: "地缘战略",
    title: "入关学",
    basicDefinition:
      "入关学是中文互联网键政话语中的一种地缘—文明想象：借明清「入关」历史隐喻，讨论大国竞争、秩序更替与文明冲突。其核心并非历史学考证，而是一种将国际政治「棋盘化」的叙事工具，用于解释权力转移、联盟重组与舆论动员。",
    originEvents:
      "约 2019—2020 年在知乎、B 站等平台兴起，被广泛认为与键政作者「山高县」及其追随者的话语生产密切相关，后逐渐演变为带有戏谑与对抗色彩的互联网亚文化符号。",
    aiAnalysis: {
      ideologicalRoots:
        "思想根源混合了历史类比思维、现实主义国际关系观与网络集体身份建构。它将复杂的地缘博弈压缩为「攻守易势」的戏剧叙事，满足公众对大势判断的简化需求，同时承接了长期存在的「文明兴衰」焦虑。",
      publicOpinion:
        "舆论演变从少数键政圈层的隐喻，扩散为泛政治讨论的常用修辞。支持者视其为「打破西方中心叙事」的话语武器；批评者则认为其过度简化历史、助长对立。平台内容监管与话题周期更替，使其热度呈脉冲式起伏。",
      spectrumPosition:
        "光谱定位偏民族主义—现实主义交叉地带，常与「工业党」「强国家能力」话语相邻。在国际观上强调竞争与秩序重构，在国内观上则可能被不同阵营选择性引用——既可用于凝聚共识，也可能滑向排外或决定论。",
    },
  },
  {
    id: "mock-3",
    category: "网络群体",
    title: "工业党",
    basicDefinition:
      "工业党是中文互联网中强调「工业化优先、国家组织能力、长期主义建设」的键政群体标签。其典型主张包括：重视制造业与基础设施、强调科技自主、以「工程师思维」审视政策与产业路径，并对「金融化」「去工业化」表达警惕。",
    originEvents:
      "2000 年代后在论坛与博客圈逐步成型，2010 年代在知乎等平台获得广泛讨论，与「小粉红」「自由派」等标签形成并置。标志性议题包括高铁、核电、航天、产业链安全等，常被用作衡量「是否真正重视实体强国」的话语坐标。",
    aiAnalysis: {
      ideologicalRoots:
        "思想根源来自近代以来「实业救国」「工程师治国」的知识传统，以及对冷战后期全球产业分工变迁的观察。工业党将「可制造、可迭代、可规模复制」视为国家竞争力的核心，对虚拟经济泡沫与短期选举导向的政策保持结构性怀疑。",
      publicOpinion:
        "舆论演变经历了「技术理性圈层 → 公共政策讨论 → 网络身份标签」的路径。早期以数据和工程案例说服为主；中期在热点事件中与民族主义、贸易战议题耦合；近期则面临「标签化」风险——支持者与被贴标签者之间的边界日益模糊。",
      spectrumPosition:
        "光谱定位整体偏国家能力主义与中长期发展主义，经济上接近生产主义，政治上常表现为务实中间偏强国家一端。与自由市场原教旨主义距离较远，与部分左翼产业政策的工具层面存在交集，但价值基础与分配议题上仍可能分歧显著。",
    },
  },
];

function formatWikiAiAnalysis(analysis: WikiAiAnalysis): string {
  return [
    `【思想根源】\n${analysis.ideologicalRoots}`,
    `【舆论演变】\n${analysis.publicOpinion}`,
    `【光谱定位】\n${analysis.spectrumPosition}`,
  ].join("\n\n");
}

function normalizeWikiPayload(data: unknown): WikiEntry[] {
  if (!Array.isArray(data)) return [];
  return data.map((row, index) => {
    const obj = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      id: String(obj.id ?? `wiki-${index}`),
      category: String(obj.category ?? "未分类"),
      title: String(obj.word ?? ""),
      basicDefinition: String(obj.definition ?? ""),
      originEvents: String(obj.origin ?? ""),
    };
  });
}

function normalizeWikiSearchPayload(data: unknown): { entries: WikiEntry[]; scores: Record<string, number> } {
  if (!Array.isArray(data)) return { entries: [], scores: {} };
  const entries: WikiEntry[] = [];
  const scores: Record<string, number> = {};

  data.forEach((row, index) => {
    const obj = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const id = String(obj.id ?? `wiki-${index}`);
    entries.push({
      id,
      category: String(obj.category ?? "未分类"),
      title: String(obj.word ?? ""),
      basicDefinition: String(obj.definition ?? ""),
      originEvents: String(obj.origin ?? ""),
    });
    const rawScore = obj.score;
    scores[id] = typeof rawScore === "number" && Number.isFinite(rawScore) ? rawScore : 1;
  });

  return { entries, scores };
}

function filterMockWikiEntries(entries: WikiEntry[], query: string): WikiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(q) ||
      entry.category.toLowerCase().includes(q) ||
      entry.basicDefinition.toLowerCase().includes(q) ||
      entry.originEvents.toLowerCase().includes(q),
  );
}

function renderInlineHighlights(input: string) {
  const tokens = input.split(/(【思想根源】|【舆论演变】|【光谱定位】)/g);
  return tokens.map((token, index) => {
    if (token === "【思想根源】" || token === "【舆论演变】" || token === "【光谱定位】") {
      return (
        <strong key={`dim-${index}`} className="font-semibold text-orange-300">
          {token}
        </strong>
      );
    }
    return <span key={`txt-${index}`}>{token}</span>;
  });
}

function streamMockWikiAnalysis(
  text: string,
  onUpdate: (value: string) => void,
  signal: { cancelled: boolean },
): Promise<void> {
  return new Promise((resolve) => {
    let index = 0;
    const step = 2;
    const timer = window.setInterval(() => {
      if (signal.cancelled) {
        window.clearInterval(timer);
        resolve();
        return;
      }
      if (index >= text.length) {
        window.clearInterval(timer);
        onUpdate(text);
        resolve();
        return;
      }
      index += step;
      onUpdate(text.slice(0, index));
    }, 28);
  });
}

async function consumeNdjsonStream(
  response: Response,
  onChunk: (text: string) => void,
  onError: (message: string) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    onError("浏览器不支持读取流式响应（body 为空）。");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
    } else {
      buffer += decoder.decode(value, { stream: true });
    }

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      try {
        const packet = JSON.parse(line) as { d?: string; e?: string };
        if (packet.e) {
          onError(packet.e ?? "分析服务返回错误。");
          continue;
        }
        if (!packet.d) continue;
        onChunk(packet.d);
      } catch {
        onChunk(line);
      }
    }

    if (done) break;
  }
}

function WikiSidebarSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 3 }).map((_, idx) => (
        <li key={`wiki-sk-${idx}`} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
          <div className="mt-2 h-4 w-24 animate-pulse rounded bg-white/10" />
        </li>
      ))}
    </ul>
  );
}

function WikiDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3 border-b border-white/10 pb-5">
        <div className="h-6 w-20 animate-pulse rounded-full bg-orange-400/20" />
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-white/10" />
        <div className="h-4 w-[92%] animate-pulse rounded bg-white/10" />
        <div className="h-4 w-[85%] animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}

export default function WikiPage() {
  const { isMockMode } = useDataMode();
  const [wikiList, setWikiList] = useState<WikiEntry[]>([]);
  const [displayList, setDisplayList] = useState<WikiEntry[]>([]);
  const [scoreById, setScoreById] = useState<Record<string, number>>({});
  const [searchInput, setSearchInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [wikiLoading, setWikiLoading] = useState(true);
  const [wikiError, setWikiError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiExpanded, setAiExpanded] = useState(false);
  const streamSignalRef = useRef({ cancelled: false });
  const searchRequestRef = useRef(0);
  const activeIdRef = useRef(activeId);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const runWikiSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim();

      if (isMockMode) {
        const filtered = filterMockWikiEntries(wikiList, trimmed);
        setDisplayList(filtered);
        setScoreById(
          trimmed
            ? Object.fromEntries(filtered.map((entry) => [entry.id, 1]))
            : {},
        );
        if (filtered.length > 0 && !filtered.some((entry) => entry.id === activeIdRef.current)) {
          setActiveId(filtered[0].id);
        }
        return;
      }

      if (!trimmed) {
        setDisplayList(wikiList);
        setScoreById({});
        return;
      }

      const requestId = ++searchRequestRef.current;
      setSearchLoading(true);
      try {
        const res = await fetch(`${WIKI_SEARCH_URL}?q=${encodeURIComponent(trimmed)}`);
        const raw = await res.text();
        let payload: unknown;
        try {
          payload = raw.length ? JSON.parse(raw) : null;
        } catch {
          if (requestId !== searchRequestRef.current) return;
          setWikiError("搜索响应解析失败：接口返回了非 JSON。");
          return;
        }

        if (!res.ok) {
          const detail =
            payload && typeof payload === "object" && "detail" in payload
              ? String((payload as Record<string, unknown>).detail)
              : `HTTP ${res.status}`;
          if (requestId !== searchRequestRef.current) return;
          setWikiError(`语义搜索暂不可用（${detail}）。`);
          return;
        }

        if (requestId !== searchRequestRef.current) return;
        const { entries, scores } = normalizeWikiSearchPayload(payload);
        setWikiError(null);
        setDisplayList(entries);
        setScoreById(scores);
        if (entries.length > 0 && !entries.some((entry) => entry.id === activeIdRef.current)) {
          setActiveId(entries[0].id);
        }
      } catch {
        if (requestId !== searchRequestRef.current) return;
        setWikiError("无法连接语义搜索 API，请确认后端已启动（npm run dev:backend）。");
      } finally {
        if (requestId === searchRequestRef.current) {
          setSearchLoading(false);
        }
      }
    },
    [isMockMode, wikiList],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadWikiSource() {
      setWikiLoading(true);
      setWikiError(null);
      setSearchInput("");
      setSearchLoading(false);
      setScoreById({});
      setAiLoading(false);
      setAiResult("");
      setAiExpanded(false);
      streamSignalRef.current.cancelled = true;
      searchRequestRef.current += 1;

      if (isMockMode) {
        if (cancelled) return;
        setWikiList(WIKI_MOCK_ENTRIES);
        setDisplayList(WIKI_MOCK_ENTRIES);
        setActiveId(WIKI_MOCK_ENTRIES[0]?.id ?? "");
        setWikiLoading(false);
        return;
      }

      try {
        const res = await fetch(WIKI_LIST_URL);
        const raw = await res.text();
        let payload: unknown;
        try {
          payload = raw.length ? JSON.parse(raw) : null;
        } catch {
          if (!cancelled) {
            setWikiList([]);
            setDisplayList([]);
            setWikiError("百科数据解析失败：接口返回了非 JSON。");
            setWikiLoading(false);
          }
          return;
        }

        if (!res.ok) {
          const detail =
            payload && typeof payload === "object" && "detail" in payload
              ? String((payload as Record<string, unknown>).detail)
              : `HTTP ${res.status}`;
          if (!cancelled) {
            setWikiList([]);
            setDisplayList([]);
            setWikiError(`百科数据暂不可用（${detail}）。`);
            setWikiLoading(false);
          }
          return;
        }

        const entries = normalizeWikiPayload(payload);
        if (!cancelled) {
          setWikiList(entries);
          setDisplayList(entries);
          setActiveId(entries[0]?.id ?? "");
          if (entries.length === 0) {
            setWikiError("百科库为空，请先运行 python backend/seed_wiki.py 注入种子数据。");
          }
          setWikiLoading(false);
        }
      } catch {
        if (!cancelled) {
          setWikiList([]);
          setDisplayList([]);
          setWikiError("无法连接百科 API，请确认后端已启动（npm run dev:backend）。");
          setWikiLoading(false);
        }
      }
    }

    void loadWikiSource();
    return () => {
      cancelled = true;
    };
  }, [isMockMode]);

  useEffect(() => {
    if (wikiLoading) return;

    const timer = window.setTimeout(() => {
      void runWikiSearch(searchInput);
    }, WIKI_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput, wikiLoading, runWikiSearch]);

  const activeEntry = useMemo(
    () => wikiList.find((entry) => entry.id === activeId) ?? displayList[0] ?? wikiList[0],
    [wikiList, displayList, activeId],
  );

  const hasActiveSearch = searchInput.trim().length > 0;

  const handleSelectEntry = useCallback((id: string) => {
    streamSignalRef.current.cancelled = true;
    setActiveId(id);
    setAiLoading(false);
    setAiResult("");
    setAiExpanded(false);
  }, []);

  const handleStartAiAnalysis = useCallback(async () => {
    if (aiLoading || !activeEntry) return;
    streamSignalRef.current.cancelled = false;
    setAiExpanded(true);
    setAiResult("");
    setAiLoading(true);

    try {
      if (isMockMode) {
        const preset = activeEntry.aiAnalysis;
        if (!preset) {
          setAiResult("暂无 Mock 分析内容。");
          return;
        }
        await streamMockWikiAnalysis(
          formatWikiAiAnalysis(preset),
          setAiResult,
          streamSignalRef.current,
        );
        return;
      }

      const wikiId = Number.parseInt(activeEntry.id, 10);
      if (!Number.isFinite(wikiId)) {
        setAiResult("无效的词条 ID，请刷新页面后重试。");
        return;
      }

      const res = await fetch(WIKI_ANALYZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: wikiId, word: activeEntry.title }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string; error?: string } | null;
        const message = data?.detail ?? data?.error ?? `请求失败（HTTP ${res.status}）`;
        setAiResult(message);
        return;
      }

      let accumulated = "";
      await consumeNdjsonStream(
        res,
        (chunk) => {
          accumulated += chunk;
          setAiResult(accumulated);
        },
        (message) => {
          setAiResult(message);
        },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "未知错误";
      setAiResult(`分析请求失败：${message}`);
    } finally {
      if (!streamSignalRef.current.cancelled) setAiLoading(false);
    }
  }, [activeEntry, aiLoading, isMockMode]);

  return (
    <div className="relative min-h-screen bg-main text-slate-200">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-[10%] top-[8%] h-[40%] w-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.16) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
      </div>

      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#ff6b00]/15 p-2 text-[#ff6b00]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">键政百科</h1>
              <p className="mt-1 text-sm text-slate-400">Political Lexicon · 概念溯源与 AI 三维解构</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            当前数据源：{isMockMode ? "Mock（本地演示）" : "Real（SQLite + Gemini）"}
          </p>
        </div>

        {wikiError && !wikiLoading ? (
          <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {wikiError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          <aside className="lg:col-span-3">
            <div className="rounded-xl border border-white/10 bg-[#020817]/80 p-4 shadow-lg shadow-black/30 backdrop-blur-md">
              <div className="relative mb-4">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void runWikiSearch(searchInput);
                    }
                  }}
                  placeholder="输入热梗、拼音或语义描述..."
                  disabled={wikiLoading}
                  className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pl-10 pr-10 text-sm text-slate-200 shadow-inner shadow-black/20 placeholder:text-slate-500 transition focus:border-[#ff6b00]/40 focus:bg-black/55 focus:outline-none focus:ring-1 focus:ring-[#ff6b00]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="百科语义搜索"
                />
                {searchLoading ? (
                  <Loader2
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500"
                    aria-hidden
                  />
                ) : null}
              </div>

              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                {hasActiveSearch ? "搜索结果" : "词条目录"}
              </p>
              {wikiLoading ? (
                <WikiSidebarSkeleton />
              ) : displayList.length > 0 ? (
                <ul className="space-y-2">
                  {displayList.map((entry) => {
                    const selected = entry.id === activeId;
                    const score = scoreById[entry.id];
                    const showScore = hasActiveSearch && typeof score === "number";
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectEntry(entry.id)}
                          className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                            selected
                              ? "border-[#ff6b00]/50 bg-[#ff6b00]/10 shadow-[0_0_20px_rgba(255,107,0,0.12)]"
                              : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-medium text-slate-400">【{entry.category}】</p>
                              <p
                                className={`mt-1 text-sm font-semibold ${selected ? "text-white" : "text-slate-200"}`}
                              >
                                {entry.title}
                              </p>
                            </div>
                            {showScore ? (
                              <span className="shrink-0 pt-0.5 text-[10px] font-medium tabular-nums text-slate-500">
                                匹配度 {Math.round(score * 100)}%
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  {hasActiveSearch ? "未找到相关词条，试试换个描述。" : "暂无词条数据。"}
                </p>
              )}
            </div>
          </aside>

          <div className="lg:col-span-9">
            <article className="rounded-xl border border-white/10 bg-[#020817]/80 p-6 shadow-lg shadow-black/30 backdrop-blur-md md:p-8">
              {wikiLoading ? (
                <WikiDetailSkeleton />
              ) : activeEntry ? (
                <>
                  <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-white/10 pb-5">
                    <span className="rounded-full bg-[#ff6b00] px-3 py-1 text-xs font-semibold text-white">
                      {activeEntry.category}
                    </span>
                    <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                      {activeEntry.title}
                    </h2>
                  </div>

                  <section className="mb-8">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                      <span className="h-px flex-1 bg-white/10" />
                      基础释义
                      <span className="h-px flex-1 bg-white/10" />
                    </h3>
                    <p className="text-sm leading-7 text-slate-300 md:text-[15px]">
                      {activeEntry.basicDefinition}
                    </p>
                  </section>

                  <section className="mb-8">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                      <span className="h-px flex-1 bg-white/10" />
                      起源与核心事件
                      <span className="h-px flex-1 bg-white/10" />
                    </h3>
                    <p className="text-sm leading-7 text-slate-300 md:text-[15px]">
                      {activeEntry.originEvents}
                    </p>
                  </section>

                  <div className="relative overflow-hidden rounded-xl border border-[#ff6b00]/25 bg-gradient-to-br from-[#ff6b00]/10 via-[#020817] to-blue-950/40 p-5 md:p-6">
                    <div
                      className="pointer-events-none absolute inset-0 opacity-30"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 20% 20%, rgba(255,107,0,0.25), transparent 45%), radial-gradient(circle at 80% 80%, rgba(59,130,246,0.15), transparent 40%)",
                      }}
                      aria-hidden
                    />
                    <div className="relative">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-orange-300/90">
                            AI Political Analysis
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {isMockMode
                              ? "Mock 模式：本地打字机演示"
                              : "Real 模式：FastAPI NDJSON 流式 + SQLite 语义缓存"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleStartAiAnalysis()}
                          disabled={aiLoading || wikiLoading}
                          className="inline-flex items-center gap-2 rounded-md bg-[#ff6b00] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#ff6b00]/25 transition hover:bg-[#e55f00] disabled:cursor-not-allowed disabled:opacity-75"
                        >
                          {aiLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          {aiLoading ? "AI 解构中..." : "✨ 开启 AI 政治学三维解构"}
                        </button>
                      </div>

                      {aiExpanded ? (
                        <div className="mt-5 rounded-lg border border-white/10 bg-black/30 p-4">
                          {aiLoading && !aiResult ? (
                            <div className="space-y-3">
                              <div className="h-3 w-1/4 animate-pulse rounded bg-orange-400/20" />
                              <div className="h-3 animate-pulse rounded bg-white/10" />
                              <div className="h-3 w-5/6 animate-pulse rounded bg-white/10" />
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                              {renderInlineHighlights(aiResult)}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">请选择或加载词条后查看详情。</p>
              )}
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
