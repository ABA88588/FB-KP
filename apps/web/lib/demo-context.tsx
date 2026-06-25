"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { demoProvider, type AdAccount, type DemoQueryContext } from "@adflow/meta-client";

export const dateRanges = ["近 7 天", "近 14 天", "近 30 天"] as const;
export const compareRanges = ["上一周期", "去年同期", "不对比"] as const;

export type DateRange = (typeof dateRanges)[number];
export type CompareRange = (typeof compareRanges)[number];

type DemoContextValue = {
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
  touchDemoData: () => void;
};

const fallbackAccount: AdAccount = {
  id: "act_demo",
  name: "Seoul Beauty KR",
  maskedId: "act_•••• 8291",
  currency: "KRW",
  timezone: "Asia/Seoul",
  status: "healthy"
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const accounts = demoProvider.listAdAccounts();
  const [accountIndex, setAccountIndex] = useState(0);
  const [dateRange, setDateRangeState] = useState<DateRange>("近 7 天");
  const [compareRange, setCompareRange] = useState<CompareRange>("上一周期");
  const [revision, setRevision] = useState(0);
  const account = accounts[accountIndex] ?? accounts[0] ?? fallbackAccount;

  const value = useMemo<DemoContextValue>(() => {
    const queryContext: DemoQueryContext = { accountId: account.id, dateRange, compareRange };
    const touchDemoData = () => setRevision((current) => current + 1);
    return {
      accounts,
      account,
      accountIndex,
      dateRange,
      compareRange,
      revision,
      queryContext,
      accountLabel: `广告账户 / ${account.name}`,
      dateLabel: `${dateRange} · ${compareRange} · ${account.timezone}`,
      cycleAccount: () => {
        const nextIndex = (accountIndex + 1) % accounts.length;
        const nextAccount = accounts[nextIndex] ?? account;
        setAccountIndex(nextIndex);
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
        setCompareRange(next);
        setRevision((current) => current + 1);
        return next;
      },
      setAccountByName: (name: string) => {
        const nextIndex = accounts.findIndex((item) => item.name === name);
        if (nextIndex >= 0) {
          setAccountIndex(nextIndex);
          setRevision((current) => current + 1);
        }
      },
      setDateRange: (range: DateRange) => {
        setDateRangeState(range);
        setRevision((current) => current + 1);
      },
      touchDemoData
    };
  }, [account, accountIndex, accounts, compareRange, dateRange, revision]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoContext(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemoContext must be used within DemoProvider");
  return context;
}
