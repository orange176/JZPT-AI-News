import { NextResponse } from "next/server";

/**
 * @deprecated 此 Next.js 路由已废弃。
 * AI 分析请统一由以下方式处理：
 * - Real 模式：`backend/main.py` 的 `POST /analyze`（FastAPI + Gemini 流式 NDJSON）
 * - Mock 模式：前端 `PolicyNewsAnalysisFeed` 直接使用 `presetAnalysis` 本地展示
 *
 * 保留此文件仅为避免旧客户端或文档中的 `/api/analyze` 路径静默失败。
 */

export const runtime = "nodejs";

const DEPRECATED_BODY = {
  status: "deprecated",
  message: "Please use FastAPI backend /analyze instead.",
} as const;

function deprecatedResponse() {
  return NextResponse.json(DEPRECATED_BODY, {
    status: 410,
    headers: {
      Deprecation: "true",
      Link: '</analyze>; rel="successor-version"',
    },
  });
}

export async function GET() {
  return deprecatedResponse();
}

export async function POST() {
  return deprecatedResponse();
}
