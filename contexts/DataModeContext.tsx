"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type DataModeContextValue = {
  isMockMode: boolean;
  setIsMockMode: (value: boolean) => void;
  toggleMode: () => void;
};

const DataModeContext = createContext<DataModeContextValue | null>(null);
const STORAGE_KEY = "jzpt-data-mode";

export function DataModeProvider({ children }: { children: React.ReactNode }) {
  const [isMockMode, setIsMockMode] = useState(true);

  useEffect(() => {
    const persisted = window.localStorage.getItem(STORAGE_KEY);
    if (persisted === "real") setIsMockMode(false);
    if (persisted === "mock") setIsMockMode(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, isMockMode ? "mock" : "real");
  }, [isMockMode]);

  const value = useMemo<DataModeContextValue>(
    () => ({
      isMockMode,
      setIsMockMode,
      toggleMode: () => setIsMockMode((prev) => !prev),
    }),
    [isMockMode],
  );

  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>;
}

export function useDataMode() {
  const ctx = useContext(DataModeContext);
  if (!ctx) {
    throw new Error("useDataMode must be used within DataModeProvider");
  }
  return ctx;
}
