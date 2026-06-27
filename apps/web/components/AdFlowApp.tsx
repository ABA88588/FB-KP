"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { DataState } from "@adflow/shared";
import type { PageKey } from "@/lib/app-types";
import { appBasePath } from "@/lib/app-paths";
import { AppShell } from "./AppShell";
import { AppRuntimeProvider } from "@/lib/app-runtime";
import { DemoProvider } from "@/lib/demo-context";
import type { ReactNode } from "react";

const validStates: DataState[] = [
  "idle",
  "loading",
  "refreshing",
  "success",
  "empty",
  "filtered-empty",
  "stale",
  "partial",
  "permission-denied",
  "connection-expired",
  "recoverable-error",
  "fatal-error"
];

export function AdFlowApp({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const demoSandbox = normalizedPathname === "/demo" || normalizedPathname.startsWith("/demo/");
  const routedPathname = demoSandbox ? stripDemoPrefix(normalizedPathname) : normalizedPathname;
  const page = pageFromPath(routedPathname);
  const standalone = isStandalonePath(routedPathname);
  const [toast, setToast] = useState<{ text: string; kind: "info" | "success" | "warning" | "danger" } | null>(null);
  const [dataState, setDataState] = useState<DataState>("success");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("state");
    if (validStates.includes(requested as DataState)) setDataState(requested as DataState);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (text: string, kind: "info" | "success" | "warning" | "danger" = "info") => setToast({ text, kind });

  return (
    <DemoProvider forceMode={demoSandbox ? "demo" : "live"}>
      <AppRuntimeProvider value={{ dataState, showToast }}>
        {standalone ? (
          <>
            {children}
            <div className={`toast ${toast ? "visible" : ""} ${toast?.kind ?? "info"}`} role="status">
              {toast?.text}
            </div>
          </>
        ) : (
          <AppShell page={page} onToast={showToast} demoSandbox={demoSandbox}>
            {children}
            <div className={`toast ${toast ? "visible" : ""} ${toast?.kind ?? "info"}`} role="status">
              {toast?.text}
            </div>
          </AppShell>
        )}
      </AppRuntimeProvider>
    </DemoProvider>
  );
}

function isStandalonePath(pathname: string): boolean {
  return pathname.startsWith("/login") || pathname.startsWith("/onboarding");
}

function pageFromPath(pathname: string): PageKey {
  if (pathname.startsWith("/campaigns/new")) return "campaigns-new";
  if (pathname.startsWith("/campaigns")) return "campaigns";
  if (pathname.startsWith("/creatives")) return "creatives";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/sync-center")) return "sync-center";
  if (pathname.startsWith("/settings")) return "settings";
  return "overview";
}

function stripDemoPrefix(pathname: string): string {
  if (pathname === "/demo") return "/overview";
  if (pathname.startsWith("/demo/")) return pathname.slice("/demo".length) || "/overview";
  return pathname;
}

function stripBasePath(pathname: string): string {
  if (!appBasePath) return pathname;
  if (pathname === appBasePath) return "/";
  if (pathname.startsWith(`${appBasePath}/`)) return pathname.slice(appBasePath.length) || "/";
  return pathname;
}
