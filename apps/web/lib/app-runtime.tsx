"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DataState } from "@adflow/shared";
import type { ToastKind } from "@/lib/app-types";

type AppRuntimeValue = {
  dataState: DataState;
  showToast: (text: string, kind?: ToastKind) => void;
};

const AppRuntimeContext = createContext<AppRuntimeValue | null>(null);

export function AppRuntimeProvider({ value, children }: { value: AppRuntimeValue; children: ReactNode }) {
  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
}

export function useAppRuntime(): AppRuntimeValue {
  const context = useContext(AppRuntimeContext);
  if (!context) throw new Error("useAppRuntime must be used within AppRuntimeProvider");
  return context;
}
