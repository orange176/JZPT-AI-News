import { Hexagon } from "lucide-react";
import Link from "next/link";

const aboutLinks = ["关于政鉴", "团队介绍", "发展历程", "联系我们"];
const supportLinks = ["内容共建", "投稿合作", "加入我们", "商务合作"];
const helpLinks = ["使用指南", "隐私政策", "免责声明", "用户反馈"];
const friendLinks = ["国家统计局", "中国人民银行", "新华社", "世界银行"];

function FooterLinks({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-medium text-white">{title}</h3>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item}>
            <Link href="#" className="text-sm text-slate-400 transition-colors hover:text-white">
              {item}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="bg-[#000c17] py-12 text-slate-400">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-[#ff6b00]/15 p-1.5 text-[#ff6b00]">
                <Hexagon className="h-5 w-5 fill-[#ff6b00] stroke-[#ff6b00]" />
              </div>
              <p className="text-lg font-semibold tracking-wide text-white">政鉴</p>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              独立、理性、数据驱动的政经分析平台
            </p>

            <div className="mt-6 flex items-center gap-2.5">
              {["微", "知", "X", "B"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                  aria-label={`社交平台占位-${item}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <FooterLinks title="关于我们" items={aboutLinks} />
          <FooterLinks title="参与与支持" items={supportLinks} />

          <div className="space-y-8">
            <FooterLinks title="帮助与说明" items={helpLinks} />
            <FooterLinks title="友情链接" items={friendLinks} />
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          © 2026 政鉴 All Rights Reserved. 沪ICP备 2024XXXX号
        </div>
      </div>
    </footer>
  );
}
