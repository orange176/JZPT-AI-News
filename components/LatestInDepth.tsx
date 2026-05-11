import Link from "next/link";

type InDepthItem = {
  id: string;
  tag: string;
  title: string;
  time: string;
  readTime: string;
  coverClass: string;
};

const mockInDepthData: InDepthItem[] = [
  {
    id: "depth-1",
    tag: "深度分析",
    title: "房地产新模式：从增量扩张到存量运营的再平衡",
    time: "昨天",
    readTime: "约12分钟",
    coverClass: "from-slate-700 to-slate-900",
  },
  {
    id: "depth-2",
    tag: "产业研究",
    title: "半导体国产化进入“深水区”：设备、材料与生态协同挑战",
    time: "2天前",
    readTime: "约15分钟",
    coverClass: "from-indigo-800 to-slate-900",
  },
  {
    id: "depth-3",
    tag: "政策观察",
    title: "地方财政约束下的新基建投向：算力、绿色能源与公共服务",
    time: "本周",
    readTime: "约10分钟",
    coverClass: "from-slate-800 to-emerald-900",
  },
];

export default function LatestInDepth() {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">最新深度</h2>
        <Link
          href="#"
          className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-600"
        >
          更多 &gt;
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {mockInDepthData.map((item) => (
          <article key={item.id} className="group flex cursor-pointer flex-col gap-3">
            <div className="relative h-40 w-full overflow-hidden rounded-lg">
              <div
                className={`h-full w-full bg-gradient-to-br ${item.coverClass} transition-transform duration-300 ease-out group-hover:scale-105`}
              />
            </div>

            <span className="w-max rounded bg-[#001529] px-2 py-1 text-xs text-white">{item.tag}</span>

            <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900 transition-colors group-hover:text-[#ff6b00]">
              {item.title}
            </h3>

            <p className="text-xs text-slate-500">
              {item.time}
              <span className="mx-1.5 text-slate-300">·</span>
              {item.readTime}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
