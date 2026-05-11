"use client";

import { useState } from "react";
import Link from "next/link";
import { Hexagon, Menu, Moon, Search } from "lucide-react";

const navItems = [
  { label: "首页", href: "#" },
  { label: "深度", href: "#" },
  { label: "数据", href: "#" },
  { label: "外媒", href: "#" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggleMobile = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleCloseMobile = () => {
    setMobileOpen(false);
  };

  return (
    <header className="relative h-16 bg-[#000c17] text-white">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="#" className="group flex items-center gap-3" onClick={handleCloseMobile}>
            <div className="rounded-md bg-[#ff6b00]/15 p-1.5 text-[#ff6b00]">
              <Hexagon className="h-5 w-5 fill-[#ff6b00] stroke-[#ff6b00]" />
            </div>
            <div className="leading-tight">
              <p className="text-base font-bold tracking-wide text-white">政鉴</p>
              <p className="text-[10px] text-slate-400">全球舆论洞察与逻辑解构</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
                onClick={handleCloseMobile}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <label className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="检索政策、公司与主题..."
              className="h-9 w-64 rounded-full border border-white/10 bg-white/10 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-white/25 focus:ring-2 focus:ring-white/10"
            />
          </label>

          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="切换主题"
          >
            <Moon className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="hidden rounded-md bg-[#ff6b00] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#ff7d26] md:inline-flex"
          >
            订阅
          </button>

          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-slate-200 transition hover:bg-white/10 hover:text-white md:hidden"
            aria-label="打开移动端菜单"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            onClick={handleToggleMobile}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          id="mobile-nav-panel"
          className="absolute left-0 right-0 top-full z-50 border-t border-white/10 bg-[#000c17]/98 shadow-lg shadow-black/40 backdrop-blur-sm md:hidden"
        >
          <div className="mx-auto max-w-7xl px-4 py-3">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={`mobile-${item.label}`}
                  href={item.href}
                  onClick={handleCloseMobile}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
