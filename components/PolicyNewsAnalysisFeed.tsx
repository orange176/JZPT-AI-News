"use client";

import { Loader2, Newspaper } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDataMode } from "@/contexts/DataModeContext";
import { mockNewsData } from "@/lib/mockData";
import type { NewsItem, StructuredAnalysis } from "@/types/news";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const NEWS_URL = `${API_BASE_URL.replace(/\/$/, "")}/news`;
const ANALYZE_URL = `${API_BASE_URL.replace(/\/$/, "")}/analyze`;

const REAL_CARD_ACCENTS = [
  "from-slate-700 via-slate-800 to-slate-900",
  "from-slate-800 via-indigo-900 to-slate-900",
  "from-slate-900 via-blue-950 to-slate-800",
  "from-slate-700 via-emerald-900 to-slate-900",
];

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatPresetAnalysis(preset: StructuredAnalysis): string {
  return [
    `【宏观政策】\n${preset.macro}`,
    `【民众体感】\n${preset.public}`,
    `【国际反应】\n${preset.international}`,
  ].join("\n\n");
}

async function streamPresetAnalysis(
  itemId: string,
  text: string,
  onUpdate: (id: string, value: string) => void,
) {
  const step = 2;
  for (let i = 0; i < text.length; i += step) {
    onUpdate(itemId, text.slice(0, i + step));
    await delay(30);
  }
  onUpdate(itemId, text);
}

function normalizeRealNewsPayload(data: unknown): NewsItem[] {
  if (!Array.isArray(data)) return [];
  return data.map((row, index) => {
    const obj = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      id: String(obj.id ?? `news-${index}`),
      title: String(obj.title ?? ""),
      summary: String(obj.summary ?? ""),
      label: String(obj.category ?? "时政"),
      time: index === 0 ? "刚刚" : `${index + 1}小时前`,
      accent: REAL_CARD_ACCENTS[index % REAL_CARD_ACCENTS.length],
      presetAnalysis: undefined,
    };
  });
}

function ListLoadingSkeleton() {
  return (
    <ul className="space-y-6">
      {Array.from({ length: 3 }).map((_, idx) => (
        <li key={`list-skeleton-${idx}`} className="border-b border-slate-200 pb-6 last:border-b-0 last:pb-0">
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/80">
            <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
              <div className="h-32 w-full animate-pulse rounded-lg bg-slate-200 md:w-48" />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-14 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="mt-3 h-5 w-[82%] animate-pulse rounded bg-slate-200" />
                <div className="mt-2 h-4 w-full animate-pulse rounded bg-slate-100" />
                <div className="mt-1 h-4 w-[88%] animate-pulse rounded bg-slate-100" />
                <div className="mt-4 h-8 w-36 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function renderInlineMarkdown(input: string) {
  const tokens = input.split(/(\*\*[^*]+\*\*)/g);
  return tokens.map((token, tokenIndex) => {
    const isBold = token.startsWith("**") && token.endsWith("**");
    const content = isBold ? token.slice(2, -2) : token;

    const withDimension = content.split(/(【宏观政策】|【民众体感】|【国际反应】)/g);
    const nodes = withDimension.map((segment, segmentIndex) => {
      if (segment === "【宏观政策】" || segment === "【民众体感】" || segment === "【国际反应】") {
        return (
          <strong key={`dimension-${tokenIndex}-${segmentIndex}`} className="font-semibold text-slate-900">
            {segment}
          </strong>
        );
      }
      return <span key={`segment-${tokenIndex}-${segmentIndex}`}>{segment}</span>;
    });

    if (!isBold) return <span key={`token-${tokenIndex}`}>{nodes}</span>;
    return (
      <strong key={`token-${tokenIndex}`} className="font-semibold text-slate-900">
        {nodes}
      </strong>
    );
  });
}

function renderBasicMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, lineIndex) => (
    <span key={`line-${lineIndex}`}>
      {renderInlineMarkdown(line)}
      {lineIndex < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

export default function PolicyNewsAnalysisFeed() {
  const { isMockMode } = useDataMode();

  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<Record<string, boolean>>({});
  const [analysisResult, setAnalysisResult] = useState<Record<string, string>>({});
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  const hasAnyNews = useMemo(() => newsList.length > 0, [newsList.length]);

  useEffect(() => {
    let cancelled = false;

    async function loadSource() {
      setNewsLoading(true);
      setNewsError(null);
      setIsAnalyzing({});
      setAnalysisResult({});
      setExpandedById({});

      if (isMockMode) {
        await delay(350);
        if (cancelled) return;
        setNewsList(mockNewsData);
        setNewsLoading(false);
        return;
      }

      await delay(2000);
      if (cancelled) return;

      try {
        const res = await fetch(NEWS_URL);
        const raw = await res.text();
        let payload: unknown;
        try {
          payload = raw.length ? JSON.parse(raw) : null;
        } catch {
          setNewsList([]);
          setNewsError("真实数据解析失败：接口返回了非 JSON。");
          setNewsLoading(false);
          return;
        }

        if (!res.ok) {
          const detail =
            payload && typeof payload === "object" && "detail" in payload
              ? String((payload as Record<string, unknown>).detail)
              : `HTTP ${res.status}`;
          setNewsList([]);
          setNewsError(`真实数据暂不可用（${detail}）。`);
          setNewsLoading(false);
          return;
        }

        if (!cancelled) {
          setNewsList(normalizeRealNewsPayload(payload));
          setNewsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setNewsList([]);
          setNewsError("无法连接真实 API，请确认 backend 已启动。");
          setNewsLoading(false);
        }
      }
    }

    loadSource();
    return () => {
      cancelled = true;
    };
  }, [isMockMode]);

  async function handleAnalyze(item: NewsItem) {
    setExpandedById((prev) => ({ ...prev, [item.id]: true }));
    setAnalysisResult((prev) => ({ ...prev, [item.id]: "" }));
    setIsAnalyzing((prev) => ({ ...prev, [item.id]: true }));

    try {
      if (isMockMode) {
        const preset = item.presetAnalysis;
        if (!preset) {
          setAnalysisResult((prev) => ({
            ...prev,
            [item.id]: "暂无 Mock 分析内容。",
          }));
          return;
        }
        await streamPresetAnalysis(item.id, formatPresetAnalysis(preset), (id, value) => {
          setAnalysisResult((prev) => ({ ...prev, [id]: value }));
        });
        return;
      }

      const newsId = Number.parseInt(item.id, 10);
      if (!Number.isFinite(newsId)) {
        setAnalysisResult((prev) => ({
          ...prev,
          [item.id]: "无效的新闻 ID，请刷新列表后重试。",
        }));
        return;
      }

      const res = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newsId,
          title: item.title,
          content: `${item.title}\n\n${item.summary}`,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        const message = data?.error ?? `请求失败（HTTP ${res.status}）`;
        setAnalysisResult((prev) => ({ ...prev, [item.id]: message }));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setAnalysisResult((prev) => ({
          ...prev,
          [item.id]: "浏览器不支持读取流式响应（body 为空）。",
        }));
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
              setAnalysisResult((prev) => ({ ...prev, [item.id]: packet.e ?? "分析服务返回错误。" }));
              continue;
            }
            if (!packet.d) continue;
            setAnalysisResult((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? "") + packet.d }));
          } catch {
            setAnalysisResult((prev) => ({ ...prev, [item.id]: `${prev[item.id] ?? ""}${line}` }));
          }
        }

        if (done) break;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "未知错误";
      setAnalysisResult((prev) => ({ ...prev, [item.id]: `分析请求失败：${message}` }));
    } finally {
      setIsAnalyzing((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-slate-500" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">今日热评</h2>
        </div>
        <Link
          href="#"
          className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-600"
        >
          更多 &gt;
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white/70 p-4 md:p-5">
        <p className="mb-5 border-b border-slate-200 pb-4 text-sm text-slate-600">
          当前数据源：{isMockMode ? "Mock（演示数据）" : "Real（真实接口）"}。
          切换右下角开关可快速对比两种模式。
        </p>

        {newsLoading ? <ListLoadingSkeleton /> : null}

        {!newsLoading && newsError ? (
          <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            {newsError}
          </div>
        ) : null}

        {!newsLoading && !newsError && !hasAnyNews ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
            暂无可展示新闻数据。
          </div>
        ) : null}

        {!newsLoading && !newsError && hasAnyNews ? (
          <ul className="space-y-6">
            {newsList.map((item) => {
              const loading = Boolean(isAnalyzing[item.id]);
              const content = analysisResult[item.id] ?? "";
              const expanded = Boolean(expandedById[item.id]);
              const showPane = expanded && (loading || content.length > 0);

              return (
                <li key={item.id} className="border-b border-slate-200 pb-6 last:border-b-0 last:pb-0">
                  <article className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/80">
                    <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
                      <div
                        className={`h-32 w-full shrink-0 rounded-lg bg-gradient-to-br md:w-48 ${item.accent}`}
                        aria-hidden
                      />

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                            {item.label}
                          </span>
                          <span className="text-[11px] text-slate-500">{item.time}</span>
                        </div>

                        <h3 className="mt-2 text-[19px] font-bold leading-snug tracking-tight text-slate-900">
                          {item.title}
                        </h3>

                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                          {item.summary}
                        </p>

                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => handleAnalyze(item)}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#ff6b00] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#e55f00] disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {loading ? "AI 深度解构中..." : "查看逻辑分析"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {showPane ? (
                      <div className="mt-4 rounded-b-lg border-t border-slate-100 bg-slate-50 p-4">
                        {loading && !content ? (
                          <div className="space-y-3">
                            <div className="h-3 w-1/4 animate-pulse rounded bg-slate-300/50" />
                            <div className="h-3 animate-pulse rounded bg-slate-300/40" />
                            <div className="h-3 w-5/6 animate-pulse rounded bg-slate-300/35" />
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                            {renderBasicMarkdown(content)}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </section>
  );
}
