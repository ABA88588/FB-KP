"use client";

import { ChevronDown, CircleHelp, FileBarChart, Grid3X3, Image, LayoutDashboard, RefreshCcw, Settings, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { cn } from "@adflow/shared";
import { apiPath } from "@/lib/app-paths";
import type { PageKey } from "@/lib/app-types";
import { useDemoContext } from "@/lib/demo-context";
import { DataSourceBanner, StatusDot } from "./ui";

const navItems: Array<{ page: PageKey; label: string; href: string; icon: ReactNode; count?: string; danger?: boolean }> = [
  { page: "overview", label: "总览", href: "/overview", icon: <LayoutDashboard size={16} /> },
  { page: "campaigns", label: "广告管理", href: "/campaigns?level=campaign", icon: <Grid3X3 size={16} /> },
  { page: "creatives", label: "素材中心", href: "/creatives", icon: <Image size={16} /> },
  { page: "reports", label: "自定义报表", href: "/reports", icon: <FileBarChart size={16} /> },
  { page: "sync-center", label: "同步与错误", href: "/sync-center", icon: <RefreshCcw size={16} />, danger: true },
  { page: "settings", label: "设置", href: "/settings/connections", icon: <Settings size={16} /> }
];

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
  const { api, connection, account, dateRange, compareRange, queryContext, revision, cycleAccount: cycleContextAccount, cycleDateRange, cycleCompareRange, touchDemoData } = useDemoContext();
  const [workspaceIndex, setWorkspaceIndex] = useState(0);
  const [syncLabel, setSyncLabel] = useState("数据已更新");
  const [helpOpen, setHelpOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const workspace = workspaces[workspaceIndex] ?? workspaces[0];
  const campaignCount = useMemo(
    () => api.listEntities("campaign", account.id, "", queryContext).length,
    [account.id, api, queryContext, revision]
  );

  const cycleWorkspace = () => {
    setWorkspaceIndex((current) => {
      const next = (current + 1) % workspaces.length;
      const nextWorkspace = workspaces[next] ?? workspaces[0];
      onToast(`已切换组织：${nextWorkspace.name}`, "success");
      return next;
    });
  };

  const cycleAccount = () => {
    const next = cycleContextAccount();
    onToast(`已切换广告账户：${next.name}`, "success");
  };

  const cycleDate = () => {
    const next = cycleDateRange();
    onToast(`日期范围已切换：${next}`, "success");
  };

  const cycleCompare = () => {
    const next = cycleCompareRange();
    onToast(`对比周期：${next}`, "info");
  };

  const refresh = () => {
    if (!connection.canRead) {
      onToast(connection.stateDetail, "warning");
      return;
    }
    setSyncLabel("正在刷新…");
    touchDemoData();
    onToast("已创建手动刷新任务，页面不会阻塞", "success");
    window.setTimeout(() => setSyncLabel("刚刚刷新"), 700);
  };

  const logout = async () => {
    await fetch(apiPath("/api/auth/logout"), { method: "POST" });
    router.push("/login");
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
              {item.page === "campaigns" ? <span className="nav-count">{campaignCount}</span> : item.count ? <span className="nav-count">{item.count}</span> : null}
              {item.danger ? <span className="dot danger" /> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="connection-card">
            <div className="connection-row"><StatusDot tone={connection.state === "unconfigured" ? "danger" : connection.canWrite ? "success" : "warning"} /><strong>{connection.stateLabel}</strong></div>
            <div className="connection-meta">{connection.sourceLabel}</div>
            <div className="connection-meta">{connection.canWrite ? "写操作可用" : "写操作禁用"}</div>
          </div>
          <div className="unofficial">独立产品 · 非 Meta 官方工具</div>
        </div>
      </aside>

      <section className="main-shell">
        <header className="topbar">
          <button className="account-picker" data-testid="account-picker" type="button" onClick={cycleAccount}>
            <span className="account-logo">S</span>
            <span className="account-copy">
              <strong>{account.name}</strong>
              <small>{account.maskedId} · {account.currency} · {account.timezone}</small>
            </span>
            <ChevronDown size={14} />
          </button>
          <div className="topbar-spacer" />
          <button className="top-control" data-testid="date-range-picker" type="button" onClick={cycleDate}>
            {dateRange} <ChevronDown size={13} />
          </button>
          <button className="top-control" type="button" onClick={cycleCompare}>对比：{compareRange}</button>
          <button className="icon-control" type="button" aria-label="刷新同步" onClick={refresh}>
            <RefreshCcw size={15} />
          </button>
          <div className="sync-state"><StatusDot tone={syncLabel === "正在刷新…" ? "info" : "success"} />{syncLabel}</div>
          <div className="topbar-menu-wrap">
            <button className="icon-control" type="button" aria-label="帮助" onClick={() => setHelpOpen((open) => !open)}>
            <CircleHelp size={16} />
            </button>
            {helpOpen ? <div className="topbar-menu"><strong>{connection.stateLabel}</strong><span>{connection.stateDetail}</span><button type="button" onClick={() => router.push("/settings/connections")}>查看连接</button></div> : null}
          </div>
          <div className="topbar-menu-wrap">
            <button className="user-menu" type="button" onClick={() => setUserOpen((open) => !open)}>
              <span>王</span>
              <ChevronDown size={13} />
            </button>
            {userOpen ? <div className="topbar-menu user"><strong>王 · Operator</strong><span>{connection.sourceLabel}</span><button type="button" onClick={() => router.push("/settings/members")}>成员设置</button><button type="button" onClick={() => void logout()}>退出登录</button></div> : null}
          </div>
        </header>
        <DataSourceBanner connection={connection} />
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
