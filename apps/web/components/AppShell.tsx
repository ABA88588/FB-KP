"use client";

import { CalendarDays, ChevronDown, CircleHelp, FileBarChart, Grid3X3, Image, LayoutDashboard, RefreshCcw, Settings, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { demoAccounts } from "@adflow/meta-client";
import { cn } from "@adflow/shared";
import type { PageKey } from "@/lib/app-types";
import { DemoModeBanner, StatusDot } from "./ui";

const navItems: Array<{ page: PageKey; label: string; href: string; icon: ReactNode; count?: string; danger?: boolean }> = [
  { page: "overview", label: "总览", href: "/overview", icon: <LayoutDashboard size={16} /> },
  { page: "campaigns", label: "广告管理", href: "/campaigns?level=campaign", icon: <Grid3X3 size={16} />, count: "42" },
  { page: "creatives", label: "素材中心", href: "/creatives", icon: <Image size={16} /> },
  { page: "reports", label: "自定义报表", href: "/reports", icon: <FileBarChart size={16} /> },
  { page: "sync-center", label: "同步与错误", href: "/sync-center", icon: <RefreshCcw size={16} />, danger: true },
  { page: "settings", label: "设置", href: "/settings/connections", icon: <Settings size={16} /> }
];

const dateRanges = ["近 7 天", "近 14 天", "近 30 天"] as const;
const compareRanges = ["上一周期", "去年同期", "不对比"] as const;
const workspaces = [
  { name: "云帆电商", role: "Owner", avatar: "云" },
  { name: "Seoul Growth", role: "Operator", avatar: "S" }
] as const;

export function AppShell({
  page,
  onToast,
  children
}: {
  page: PageKey;
  onToast: (message: string, kind?: "info" | "success" | "warning" | "danger") => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const activePage: PageKey = page === "campaigns-new" ? "campaigns" : page;
  const [workspaceIndex, setWorkspaceIndex] = useState(0);
  const [accountIndex, setAccountIndex] = useState(0);
  const [dateIndex, setDateIndex] = useState(0);
  const [compareIndex, setCompareIndex] = useState(0);
  const [syncLabel, setSyncLabel] = useState("数据已更新");
  const [helpOpen, setHelpOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const workspace = workspaces[workspaceIndex] ?? workspaces[0];
  const account = demoAccounts[accountIndex] ?? {
    id: "act_demo",
    name: "Seoul Beauty KR",
    maskedId: "act_•••• 8291",
    currency: "KRW" as const,
    timezone: "Asia/Seoul",
    status: "healthy" as const
  };

  useEffect(() => {
    window.localStorage.setItem("adflow.topbarState", JSON.stringify({
      workspace: workspace.name,
      account: account.id,
      dateRange: dateRanges[dateIndex],
      compare: compareRanges[compareIndex]
    }));
  }, [workspace.name, account.id, dateIndex, compareIndex]);

  const cycleWorkspace = () => {
    setWorkspaceIndex((current) => {
      const next = (current + 1) % workspaces.length;
      const nextWorkspace = workspaces[next] ?? workspaces[0];
      onToast(`已切换组织：${nextWorkspace.name}`, "success");
      return next;
    });
  };

  const cycleAccount = () => {
    setAccountIndex((current) => {
      const next = (current + 1) % demoAccounts.length;
      const nextAccountName = demoAccounts[next]?.name ?? "Seoul Beauty KR";
      onToast(`已切换广告账户：${nextAccountName}`, "success");
      return next;
    });
  };

  const cycleDate = () => {
    setDateIndex((current) => {
      const next = (current + 1) % dateRanges.length;
      onToast(`日期范围已切换：${dateRanges[next]}`, "success");
      return next;
    });
  };

  const cycleCompare = () => {
    setCompareIndex((current) => {
      const next = (current + 1) % compareRanges.length;
      onToast(`对比周期：${compareRanges[next]}`, "info");
      return next;
    });
  };

  const refresh = () => {
    setSyncLabel("正在刷新…");
    onToast("已创建手动刷新任务，页面不会阻塞", "success");
    window.setTimeout(() => setSyncLabel("刚刚刷新"), 700);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>AdFlow</strong>
            <span>广告工作台</span>
          </div>
        </div>
        <button className="workspace-switcher" type="button" onClick={cycleWorkspace}>
          <span className="workspace-avatar">{workspace.avatar}</span>
          <span className="workspace-copy"><strong>{workspace.name}</strong><small>{workspace.role}</small></span>
          <ChevronDown size={14} />
        </button>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.page}
              className={cn("nav-item", activePage === item.page && "active")}
              type="button"
              onClick={() => router.push(item.href)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.count ? <span className="nav-count">{item.count}</span> : null}
              {item.danger ? <span className="dot danger" /> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="connection-card">
            <div className="connection-row"><StatusDot tone="success" /><strong>演示连接正常</strong></div>
            <div className="connection-meta">最后同步 6 分钟前</div>
            <div className="connection-meta">不会写入 Meta</div>
          </div>
          <div className="unofficial">独立产品 · 非 Meta 官方工具</div>
        </div>
      </aside>

      <section className="main-shell">
        <header className="topbar">
          <button className="account-picker" type="button" onClick={cycleAccount}>
            <span className="account-logo">S</span>
            <span className="account-copy">
              <strong>{account.name}</strong>
              <small>{account.maskedId} · {account.currency} · {account.timezone}</small>
            </span>
            <ChevronDown size={14} />
          </button>
          <div className="topbar-spacer" />
          <button className="top-control" type="button" onClick={cycleDate}>
            <CalendarDays size={14} /> {dateRanges[dateIndex]} <ChevronDown size={13} />
          </button>
          <button className="top-control" type="button" onClick={cycleCompare}>对比：{compareRanges[compareIndex]}</button>
          <button className="icon-control" type="button" aria-label="刷新同步" onClick={refresh}>
            <RefreshCcw size={15} />
          </button>
          <div className="sync-state"><StatusDot tone={syncLabel === "正在刷新…" ? "info" : "success"} />{syncLabel}</div>
          <div className="topbar-menu-wrap">
            <button className="icon-control" type="button" aria-label="帮助" onClick={() => setHelpOpen((open) => !open)}>
            <CircleHelp size={16} />
            </button>
            {helpOpen ? <div className="topbar-menu"><strong>演示模式</strong><span>所有写操作只更新本地 Demo 数据。</span><button type="button" onClick={() => router.push("/settings/connections")}>查看连接</button></div> : null}
          </div>
          <div className="topbar-menu-wrap">
            <button className="user-menu" type="button" onClick={() => setUserOpen((open) => !open)}>
              <span>王</span>
              <ChevronDown size={13} />
            </button>
            {userOpen ? <div className="topbar-menu user"><strong>王 · Operator</strong><span>Demo Provider</span><button type="button" onClick={() => router.push("/settings/members")}>成员设置</button></div> : null}
          </div>
        </header>
        <DemoModeBanner />
        <main id="main-content">
          <MobileNotice />
          {children}
        </main>
      </section>
    </div>
  );
}

function MobileNotice() {
  return (
    <div className="mobile-notice">
      <SlidersHorizontal size={16} />
      小于 1024px 时仅支持只读查看。请使用桌面端进行批量编辑和创建广告。
    </div>
  );
}
