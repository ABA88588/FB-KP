"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AdAccount, DemoQueryContext } from "@adflow/meta-client";
import {
  getClientApiAdapter,
  getClientApiConnection,
  resolveInitialDataMode,
  type ClientApiAdapter,
  type ClientApiConnection,
  type ClientDataMode,
  type LiveSnapshot
} from "@/lib/client-api-adapter";
import { apiPath } from "@/lib/app-paths";

export const dateRanges = ["近 7 天", "近 14 天", "近 30 天"] as const;
export const compareRanges = ["上一周期", "去年同期", "不对比"] as const;

export type DateRange = (typeof dateRanges)[number];
export type CompareRange = (typeof compareRanges)[number];

type PersistedDemoState = {
  accountId?: string;
  dateRange?: DateRange;
  compareRange?: CompareRange;
};

type DemoContextValue = {
  api: ClientApiAdapter;
  connection: ClientApiConnection;
  mode: ClientDataMode;
  accounts: AdAccount[];
  account: AdAccount;
  accountIndex: number;
  dateRange: DateRange;
  compareRange: CompareRange;
  revision: number;
  queryContext: DemoQueryContext;
  accountLabel: string;
  dateLabel: string;
  cycleAccount: () => AdAccount;
  cycleDateRange: () => DateRange;
  cycleCompareRange: () => CompareRange;
  setAccountByName: (name: string) => void;
  setDateRange: (range: DateRange) => void;
  setCompareRange: (range: CompareRange) => void;
  setMode: (mode: ClientDataMode) => void;
  touchDemoData: () => void;
};

const storageKeyByMode: Record<ClientDataMode, string> = {
  live: "adflow.liveContext",
  demo: "adflow.demoContext"
};

const fallbackAccount: AdAccount = {
  id: "act_demo",
  name: "Seoul Beauty KR",
  maskedId: "act_••••8291",
  currency: "KRW",
  timezone: "Asia/Seoul",
  status: "healthy"
};

const liveFallbackAccount: AdAccount = {
  id: "live_unconfigured",
  name: "未连接广告账户",
  maskedId: "请先连接 Meta",
  currency: "USD",
  timezone: "待配置",
  status: "permission-denied"
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children, forceMode }: { children: ReactNode; forceMode?: ClientDataMode }) {
  const [mode, setModeState] = useState<ClientDataMode>(() => forceMode ?? resolveInitialDataMode());
  const [liveSnapshot, setLiveSnapshot] = useState<LiveSnapshot | null>(null);
  const api = useMemo(() => getClientApiAdapter(mode, liveSnapshot), [liveSnapshot, mode]);
  const connection = useMemo(() => getClientApiConnection(mode), [mode]);
  const accounts = useMemo(() => api.listAdAccounts(), [api]);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? fallbackAccount.id);
  const [dateRange, setDateRangeState] = useState<DateRange>("近 7 天");
  const [compareRange, setCompareRangeState] = useState<CompareRange>("上一周期");
  const [revision, setRevision] = useState(0);
  const [loadedStorage, setLoadedStorage] = useState(false);
  const fallback = mode === "live" ? liveFallbackAccount : fallbackAccount;
  const account = accounts.find((item) => item.id === accountId) ?? accounts[0] ?? fallback;
  const accountIndex = Math.max(0, accounts.findIndex((item) => item.id === account.id));

  useEffect(() => {
    if (forceMode && forceMode !== mode) {
      const nextApi = getClientApiAdapter(forceMode, forceMode === "live" ? liveSnapshot : null);
      const [nextAccount] = nextApi.listAdAccounts();
      setModeState(forceMode);
      setAccountId(nextAccount?.id ?? (forceMode === "live" ? liveFallbackAccount.id : fallbackAccount.id));
      setLoadedStorage(false);
    }
  }, [forceMode, liveSnapshot, mode]);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKeyByMode[mode]);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PersistedDemoState;
        if (parsed.accountId) setAccountId(parsed.accountId);
        if (parsed.dateRange && dateRanges.includes(parsed.dateRange)) setDateRangeState(parsed.dateRange);
        if (parsed.compareRange && compareRanges.includes(parsed.compareRange)) setCompareRangeState(parsed.compareRange);
      } catch {
        window.localStorage.removeItem(storageKeyByMode[mode]);
      }
    }
    setLoadedStorage(true);
  }, [mode]);

  useEffect(() => {
    if (!loadedStorage) return;
    window.localStorage.setItem(storageKeyByMode[mode], JSON.stringify({ accountId: account.id, dateRange, compareRange }));
  }, [account.id, compareRange, dateRange, loadedStorage, mode]);

  useEffect(() => {
    if (mode !== "live") return;
    let cancelled = false;
    fetch(apiPath("/api/live/bootstrap"), { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: LiveSnapshot } | null) => {
        if (!cancelled && payload?.data) {
          setLiveSnapshot(payload.data);
          setRevision((current) => current + 1);
        }
      })
      .catch(() => {
        if (!cancelled) setLiveSnapshot(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const value = useMemo<DemoContextValue>(() => {
    const queryContext: DemoQueryContext = { accountId: account.id, dateRange, compareRange };
    const touchDemoData = () => setRevision((current) => current + 1);
    const setMode = (nextMode: ClientDataMode) => {
      if (forceMode && nextMode !== forceMode) return;
      const nextApi = getClientApiAdapter(nextMode, nextMode === "live" ? liveSnapshot : null);
      const [nextAccount] = nextApi.listAdAccounts();
      setModeState(nextMode);
      setAccountId(nextAccount?.id ?? (nextMode === "live" ? liveFallbackAccount.id : fallbackAccount.id));
      setRevision((current) => current + 1);
    };
    return {
      api,
      connection,
      mode,
      accounts,
      account,
      accountIndex,
      dateRange,
      compareRange,
      revision,
      queryContext,
      accountLabel: mode === "live" && account.id === liveFallbackAccount.id ? "广告账户 / 未连接" : `广告账户 / ${account.name}`,
      dateLabel: `${formatDateRange(dateRange)} · ${account.timezone}`,
      cycleAccount: () => {
        const nextIndex = accounts.length > 0 ? (accountIndex + 1) % accounts.length : 0;
        const nextAccount = accounts[nextIndex] ?? account;
        setAccountId(nextAccount.id);
        setRevision((current) => current + 1);
        return nextAccount;
      },
      cycleDateRange: () => {
        const currentIndex = dateRanges.indexOf(dateRange);
        const next = dateRanges[(currentIndex + 1) % dateRanges.length] ?? "近 7 天";
        setDateRangeState(next);
        setRevision((current) => current + 1);
        return next;
      },
      cycleCompareRange: () => {
        const currentIndex = compareRanges.indexOf(compareRange);
        const next = compareRanges[(currentIndex + 1) % compareRanges.length] ?? "上一周期";
        setCompareRangeState(next);
        setRevision((current) => current + 1);
        return next;
      },
      setAccountByName: (name: string) => {
        const next = accounts.find((item) => item.name === name);
        if (next) {
          setAccountId(next.id);
          setRevision((current) => current + 1);
        }
      },
      setDateRange: (range: DateRange) => {
        setDateRangeState(range);
        setRevision((current) => current + 1);
      },
      setCompareRange: (range: CompareRange) => {
        setCompareRangeState(range);
        setRevision((current) => current + 1);
      },
      setMode,
      touchDemoData
    };
  }, [account, accountIndex, accounts, api, compareRange, connection, dateRange, forceMode, liveSnapshot, mode, revision]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoContext(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemoContext must be used within DemoProvider");
  return context;
}

function formatDateRange(range: DateRange): string {
  if (range === "近 30 天") return "2026年5月27日–6月25日";
  if (range === "近 14 天") return "2026年6月12日–6月25日";
  return "2026年6月19日–6月25日";
}
