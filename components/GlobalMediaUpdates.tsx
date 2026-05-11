import Link from "next/link";
import { Globe2 } from "lucide-react";

type MediaUpdate = {
  id: string;
  logo: string;
  title: string;
  source: string;
  time: string;
  summary: string;
};

const mockMediaUpdates: MediaUpdate[] = [
  {
    id: "media-1",
    logo: "FT",
    title: "中国经济复苏的三大支撑与两大隐忧",
    source: "Financial Times",
    time: "2天前",
    summary: "政策托底与产业升级形成共振，但地方财政约束与需求修复节奏仍是关键变量。",
  },
  {
    id: "media-2",
    logo: "WSJ",
    title: "美联储鸽派，热度中点分歧加大",
    source: "The Wall Street Journal",
    time: "3天前",
    summary: "市场在降息预期与通胀黏性之间反复定价，风险资产波动区间可能继续放大。",
  },
  {
    id: "media-3",
    logo: "Nikkei",
    title: "日本企业的“中国+1”策略调查",
    source: "Nikkei Asia",
    time: "本周",
    summary: "供应链多元化趋势延续，但中国市场的规模效应和配套效率仍具显著吸引力。",
  },
];

export default function GlobalMediaUpdates() {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-slate-500" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">外媒动态</h2>
        </div>
        <Link
          href="#"
          className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-600"
        >
          更多 &gt;
        </Link>
      </div>

      <ul className="divide-y divide-slate-100">
        {mockMediaUpdates.map((item) => (
          <li key={item.id} className="py-4 first:pt-0 last:pb-0">
            <article className="flex flex-row gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                {item.logo}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="cursor-pointer text-base font-bold text-slate-900 transition-colors hover:text-[#ff6b00]">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {item.source}
                  <span className="mx-1.5 text-slate-300">·</span>
                  {item.time}
                </p>
                <p className="mt-1 line-clamp-1 text-sm text-slate-500">{item.summary}</p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
