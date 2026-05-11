import Link from "next/link";
import { ArrowRight } from "lucide-react";

const heroCards = [
  {
    section: "深度分析",
    title: "地方债务化解：财政与金融协同路径",
  },
  {
    section: "政策观察",
    title: "制造业稳增长下的税费与投资抓手",
  },
  {
    section: "外媒追踪",
    title: "国际资本如何重新定价中国政策预期",
  },
];

export default function Hero() {
  return (
    <section className="relative z-20 h-[600px] w-full overflow-visible bg-[#020817]">
      {/* 第一层：底层（视觉背景层 z-0） */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-[8%] top-[12%] h-[52%] w-[52%] rounded-full bg-blue-600/15 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
          aria-hidden
        />
      </div>

      {/* 第二层：中层（主干信息层 z-10） */}
      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-4">
        <span className="mb-5 inline-block w-fit rounded-full border border-blue-400/40 bg-blue-600/20 px-3 py-1 text-sm font-medium text-blue-200">
          今日焦点
        </span>

        <h1 className="mb-6 max-w-4xl text-4xl font-bold leading-tight text-white md:text-5xl">
          财政政策加力，结构性改革如何落地？
        </h1>

        <p className="mb-8 max-w-2xl text-lg leading-relaxed text-slate-300">
          从中央政治局会议到地方两会，政策信号密集释放。本文梳理关键政策脉络，
          结合数据观察潜在影响路径与市场反应，帮助你快速把握政经变量。
        </p>

        <div>
          <Link
            href="#"
            className="inline-flex items-center gap-2 rounded-md bg-[#ff6b00] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e55f00]"
          >
            阅读全文
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* 第三层：顶层（悬浮扩展层 z-20） */}
      <div className="absolute left-4 right-4 -bottom-16 z-30">
        <div className="mx-auto hidden max-w-7xl grid-cols-3 gap-6 md:grid">
          {heroCards.map((card) => (
            <article
              key={card.title}
              className="flex items-center gap-4 rounded-xl border border-white/20 bg-white/10 p-4 shadow-lg shadow-black/25 backdrop-blur-xl transition-colors hover:border-white/35"
            >
              <div className="h-14 w-14 shrink-0 rounded-md bg-slate-900/90" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-wide text-slate-300">{card.section}</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-white">{card.title}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
