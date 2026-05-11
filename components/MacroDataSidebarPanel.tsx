import { Tag } from "lucide-react";

const QUOTE_UP = "#ef4444";
const QUOTE_DOWN = "#22c55e";

const KEY_DATA_ROWS: {
  label: string;
  value: string;
  trendUp: boolean;
  prev: string;
  spark: number[];
}[] = [
  { label: "GDP（同比）", value: "5.2%", trendUp: true, prev: "前值 +0.1pp", spark: [4.8, 4.9, 5.0, 5.1, 5.15, 5.2] },
  { label: "CPI（同比）", value: "0.3%", trendUp: false, prev: "前值 -0.2pp", spark: [0.9, 0.7, 0.5, 0.4, 0.35, 0.3] },
  { label: "PPI（同比）", value: "-2.5%", trendUp: false, prev: "前值 -0.3pp", spark: [-1.8, -2.0, -2.1, -2.2, -2.4, -2.5] },
  { label: "制造业 PMI", value: "49.8", trendUp: true, prev: "前值 +0.4", spark: [49.0, 49.2, 49.4, 49.5, 49.6, 49.8] },
  { label: "社融增量（万亿）", value: "4.62", trendUp: true, prev: "前值 +0.08", spark: [4.2, 4.35, 4.4, 4.48, 4.55, 4.62] },
  { label: "美元兑人民币", value: "7.24", trendUp: true, prev: "前值 +0.02", spark: [7.18, 7.2, 7.21, 7.22, 7.23, 7.24] },
];

const HOT_TAGS = [
  "财政政策",
  "货币政策",
  "宏观经济",
  "房地产",
  "地方债务",
  "中美关系",
  "科技创新",
  "人工智能",
  "新能源",
  "资本市场",
  "就业",
  "消费",
  "产业升级",
  "数据图解",
  "一带一路",
  "外贸出口",
];

function sparkGeometry(points: number[], w: number, h: number) {
  if (points.length === 0) {
    return { lineD: "", areaD: "", last: { x: 0, y: h / 2 } };
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i * step : w / 2;
    const y = h - ((p - min) / span) * (h - 4) - 2;
    return { x, y };
  });
  const lineD = coords.reduce((acc, point, index, arr) => {
    if (index === 0) return `M${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const prev = arr[index - 1];
    const cx = ((prev.x + point.x) / 2).toFixed(1);
    return `${acc} Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)}, ${cx} ${((prev.y + point.y) / 2).toFixed(1)} T ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, "");
  const first = coords[0];
  const last = coords[coords.length - 1];
  const areaD =
    coords.length > 0
      ? `${lineD} L ${last.x.toFixed(1)} ${h} L ${first.x.toFixed(1)} ${h} Z`
      : "";
  return { lineD, areaD, last };
}

function Sparkline({
  points,
  trendUp,
  drawDelayMs = 0,
}: {
  points: number[];
  trendUp: boolean;
  drawDelayMs?: number;
}) {
  const w = 72;
  const h = 22;
  const stroke = trendUp ? QUOTE_UP : QUOTE_DOWN;
  const { lineD, areaD, last } = sparkGeometry(points, w, h);
  if (!lineD) return null;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      {areaD ? (
        <path
          d={areaD}
          fill={stroke}
          fillOpacity={0.1}
          style={{
            opacity: 0,
            animation: "jzpt-fade-in-spark-area 0.45s ease-out forwards",
            animationDelay: `${drawDelayMs + 300}ms`,
          }}
        />
      ) : null}
      <path
        d={lineD}
        fill="none"
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1}
        style={{
          animation: "jzpt-spark-draw 820ms cubic-bezier(0.33, 1, 0.68, 1) forwards",
          animationDelay: `${drawDelayMs}ms`,
        }}
      />
      <g transform={`translate(${last.x.toFixed(2)} ${last.y.toFixed(2)})`}>
        <circle
          cx={0}
          cy={0}
          r={2.25}
          fill={stroke}
          stroke="white"
          strokeWidth={1}
          style={{
            opacity: 0,
            transformOrigin: "0 0",
            animation: "jzpt-spark-dot-in 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            animationDelay: `${drawDelayMs + 450}ms`,
          }}
        />
      </g>
    </svg>
  );
}

export default function MacroDataSidebarPanel() {
  return (
    <aside className="space-y-6">
      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">关键数据速览</h2>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">DEMO</span>
        </div>

        <ul className="mt-4 divide-y divide-slate-100">
          {KEY_DATA_ROWS.map((row, rowIndex) => (
            <li key={row.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-slate-800">{row.label}</p>
                <p className="mt-0.5 text-[11px] font-medium tabular-nums text-slate-500">{row.prev}</p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span className="tabular-nums text-[14px] font-semibold tracking-tight text-slate-900">
                  {row.value}
                </span>
                <span
                  className="inline-flex h-4 w-4 items-center justify-center text-[10px] font-bold"
                  style={{
                    color: row.trendUp ? QUOTE_UP : QUOTE_DOWN,
                  }}
                  aria-hidden
                >
                  {row.trendUp ? "↑" : "↓"}
                </span>
              </div>

              <Sparkline points={row.spark} trendUp={row.trendUp} drawDelayMs={rowIndex * 95} />
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="border-b border-slate-100 pb-3 text-[15px] font-semibold tracking-tight text-slate-900">
          本周荐读
        </h2>
        <ol className="mt-4 list-decimal space-y-2.5 pl-4 text-[13px] leading-snug text-slate-700 marker:text-slate-400">
          <li className="pl-1">
            <a href="#" className="transition-colors hover:text-[#ff6b00]">
              政策利率路径与汇率预期的联动
            </a>
          </li>
          <li className="pl-1">
            <a href="#" className="transition-colors hover:text-[#ff6b00]">
              制造业库存周期：从主动去库到弱复苏
            </a>
          </li>
          <li className="pl-1">
            <a href="#" className="transition-colors hover:text-[#ff6b00]">
              海外大选年对风险资产的定价含义
            </a>
          </li>
          <li className="pl-1">
            <a href="#" className="transition-colors hover:text-[#ff6b00]">
              政策预期切换期的资产配置框架
            </a>
          </li>
        </ol>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-slate-400" />
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">热门标签</h2>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {HOT_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className="cursor-pointer rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-[#ff6b00]"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-[13px] font-semibold text-slate-800">订阅不迷路</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
            深度解构与数据周报将发送至邮箱
          </p>
          <div className="mt-4 flex items-center gap-2">
            <input
              type="email"
              placeholder="输入邮箱地址"
              className="min-h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none ring-slate-200 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
              readOnly
              aria-label="邮箱（示意）"
            />
            <button
              type="button"
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[#ff6b00] px-4 text-[13px] font-semibold text-white transition hover:bg-[#e55f00]"
            >
              立即订阅
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
