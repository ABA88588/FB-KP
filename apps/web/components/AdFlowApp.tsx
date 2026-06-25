"use client";

import { useEffect, useState } from "react";
import type { DataState } from "@adflow/shared";
import type { PageKey } from "@/lib/app-types";
import { AppShell } from "./AppShell";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { CampaignManager } from "@/features/campaigns/CampaignManager";
import { CreateWizard } from "@/features/campaigns/CreateWizard";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { SyncCenterPage } from "@/features/sync/SyncCenterPage";
import { CreativesPage } from "@/features/static/CreativesPage";
import { SettingsPage } from "@/features/static/SettingsPage";

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

export function AdFlowApp({ page }: { page: PageKey }) {
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
    <AppShell page={page} onToast={showToast}>
      {page === "overview" ? <OverviewPage dataState={dataState} showToast={showToast} /> : null}
      {page === "campaigns" ? <CampaignManager dataState={dataState} showToast={showToast} /> : null}
      {page === "campaigns-new" ? <CreateWizard showToast={showToast} /> : null}
      {page === "reports" ? <ReportsPage dataState={dataState} showToast={showToast} /> : null}
      {page === "sync-center" ? <SyncCenterPage dataState={dataState} showToast={showToast} /> : null}
      {page === "creatives" ? <CreativesPage showToast={showToast} /> : null}
      {page === "settings" ? <SettingsPage showToast={showToast} /> : null}
      <div className={`toast ${toast ? "visible" : ""} ${toast?.kind ?? "info"}`} role="status">
        {toast?.text}
      </div>
    </AppShell>
  );
}
