"use client";

import { CalendarDays, ChevronDown, CircleHelp, FileBarChart, Grid3X3, Image, LayoutDashboard, RefreshCcw, Settings, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
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
  const account = demoAccounts[0] ?? {
    id: "act_demo",
    name: "Seoul Beauty KR",
    maskedId: "act_•••• 8291",
    currency: "KRW" as const,
    timezone: "Asia/Seoul",
    status: "healthy" as const
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
        <button className="workspace-switcher" type="button" onClick={() => onToast("当前组织：云帆电商", "info")}>
          <span className="workspace-avatar">云</span>
          <span className="workspace-copy"><strong>云帆电商</strong><small>Owner</small></span>
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
          <button className="account-picker" type="button" onClick={() => onToast("已切换广告账户：Seoul Beauty KR", "success")}>
            <span className="account-logo">S</span>
            <span className="account-copy">
              <strong>{account.name}</strong>
              <small>{account.maskedId} · {account.currency} · {account.timezone}</small>
            </span>
            <ChevronDown size={14} />
          </button>
          <div className="topbar-spacer" />
          <button className="top-control" type="button" onClick={() => onToast("日期范围已切换：近 7 天", "success")}>
            <CalendarDays size={14} /> 近 7 天 <ChevronDown size={13} />
          </button>
          <button className="top-control" type="button" onClick={() => onToast("对比周期：上一周期", "info")}>对比：上一周期</button>
          <button className="icon-control" type="button" aria-label="刷新同步" onClick={() => onToast("已创建手动刷新任务，页面不会阻塞", "success")}>
            <RefreshCcw size={15} />
          </button>
          <div className="sync-state"><StatusDot tone="success" />数据已更新</div>
          <button className="icon-control" type="button" aria-label="帮助" onClick={() => onToast("帮助入口：当前为演示模式说明", "info")}>
            <CircleHelp size={16} />
          </button>
          <button className="user-menu" type="button" onClick={() => onToast("王 · Operator，Demo Provider", "info")}>
            <span>王</span>
            <ChevronDown size={13} />
          </button>
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
