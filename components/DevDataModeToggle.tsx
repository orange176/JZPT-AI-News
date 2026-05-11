"use client";

import { useDataMode } from "@/contexts/DataModeContext";

export default function DevDataModeToggle() {
  const { isMockMode, toggleMode } = useDataMode();

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-white/15 bg-slate-900/90 px-3 py-2 text-white shadow-xl shadow-black/40 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-slate-300">
          Data:{" "}
          <span className="font-semibold text-white">{isMockMode ? "Mock" : "Real"}</span>
        </span>
        <button
          type="button"
          onClick={toggleMode}
          aria-label="切换数据源模式"
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isMockMode ? "bg-emerald-500/70" : "bg-slate-500/80"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              isMockMode ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
