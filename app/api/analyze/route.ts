import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `你是资深政经分析师。请接收新闻标题与摘要，并严格按以下三部分输出，且每部分都要有实质信息：
【宏观政策】关注财政货币、监管导向、产业结构与中长期趋势。
【民众体感】关注就业、收入、消费、成本与社会预期变化。
【国际反应】关注国际资本、外媒叙事、地缘风险与跨境市场反馈。`;

function buildMockAnalysis(title: string, summary: string) {
  const safeTitle = title || "（未提供标题）";
  const safeSummary = summary || "（未提供摘要）";
  return `【宏观政策】\n围绕“${safeTitle}”这一议题，政策层面释放出“稳总量、优结构、控风险”的组合信号。财政工具更可能向科技创新、先进制造与公共服务短板倾斜，以提高资金投放效率与中长期产出弹性。结合当前摘要信息可判断，短期政策节奏强调托底，中期政策目标强调改革落地与资源配置优化。\n\n【民众体感】\n从居民端看，政策传导首先体现在就业稳定性与收入预期改善，其次才会逐步反映到消费意愿和资产配置行为。若政策执行保持连续性，企业端信心修复将提升招聘与投资意愿，居民对未来现金流的确定性增强。摘要中提及“${safeSummary.slice(0, 60)}${safeSummary.length > 60 ? "..." : ""}”也说明市场关注点正从情绪波动转向基本面验证。\n\n【国际反应】\n国际市场通常会把这类政策信号视为中国增长与改革路径的重要观察窗口。外资更看重政策兑现能力与跨周期稳定性：若后续数据持续验证，风险溢价有望回落；若执行不及预期，国际资本将继续保持谨慎。外媒叙事大概率聚焦“政策力度”“结构改革进度”以及对全球供应链与风险资产定价的外溢影响。`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { title?: string; summary?: string };
    const title = String(body?.title ?? "");
    const summary = String(body?.summary ?? "");

    const mockText = buildMockAnalysis(title, summary);
    const encoder = new TextEncoder();

    let index = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // 在 mock 阶段保留 prompt 变量，后续对接真实 LLM 直接复用。
        void SYSTEM_PROMPT;

        timer = setInterval(() => {
          if (index >= mockText.length) {
            if (timer) clearInterval(timer);
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(mockText[index]));
          index += 1;
        }, 50);
      },
      cancel() {
        if (timer) clearInterval(timer);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("analyze route error:", error);
    return NextResponse.json({ error: "分析服务暂不可用，请稍后重试。" }, { status: 500 });
  }
}
