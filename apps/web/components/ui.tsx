"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Info, Loader2, X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn, effectiveStatusTone, type DataState } from "@adflow/shared";
import type { KpiMetric } from "@adflow/meta-client";

export function Button({
  variant = "secondary",
  size = "default",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "default" | "compact";
}) {
  return (
    <button className={cn("button", variant, size === "compact" && "compact", className)} type="button" {...props}>
      {children}
    </button>
  );
}

export function StatusDot({ tone }: { tone: "success" | "warning" | "danger" | "info" | "muted" }) {
  return <span className={cn("status-dot", tone)} />;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = effectiveStatusTone(status);
  return (
    <span className={cn("status-badge", tone)}>
      <StatusDot tone={tone === "active" ? "success" : tone === "warning" ? "warning" : tone === "error" ? "danger" : "muted"} />
      {status}
    </span>
  );
}

export function DemoModeBanner() {
  return (
    <div className="demo-banner">
      <span className="demo-badge">演示数据</span>
      当前页面使用确定性模拟数据，不会向 Meta 创建或修改任何对象。
      <a href="/settings/connections">查看连接</a>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header compact-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function KpiCard({ metric }: { metric: KpiMetric }) {
  return (
    <article className={cn("metric-card", metric.accent && "accent")} data-testid="kpi-card">
      <div className="metric-label">
        {metric.label} <Info size={13} aria-hidden="true" />
      </div>
      <div className="metric-value">{metric.value || "—"}</div>
      <div className={cn("metric-delta", metric.direction)}>
        {metric.direction === "up" ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
        {metric.delta} <span>{metric.note}</span>
      </div>
    </article>
  );
}

export function TrendChart({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "drawer-chart" : "chart-wrap"} aria-label="花费和转化价值趋势图">
      <svg viewBox={compact ? "0 0 420 110" : "0 0 760 270"} role="img">
        {!compact ? (
          <>
            <g className="grid-lines">
              <line x1="54" y1="24" x2="735" y2="24" />
              <line x1="54" y1="78" x2="735" y2="78" />
              <line x1="54" y1="132" x2="735" y2="132" />
              <line x1="54" y1="186" x2="735" y2="186" />
              <line x1="54" y1="240" x2="735" y2="240" />
            </g>
            <g className="axis-labels">
              <text x="4" y="28">₩2.4M</text>
              <text x="12" y="82">₩1.8M</text>
              <text x="12" y="136">₩1.2M</text>
              <text x="20" y="190">₩600K</text>
              <text x="40" y="244">0</text>
            </g>
            <path className="area-path" d="M55,180 C110,166 130,170 168,147 C215,119 244,134 282,106 C330,78 355,91 395,82 C442,70 470,92 508,64 C558,35 586,56 623,47 C672,34 700,38 734,28 L734,240 L55,240 Z" />
            <path className="line-path value-path" d="M55,180 C110,166 130,170 168,147 C215,119 244,134 282,106 C330,78 355,91 395,82 C442,70 470,92 508,64 C558,35 586,56 623,47 C672,34 700,38 734,28" />
            <path className="line-path spend-path" d="M55,198 C104,188 132,194 168,176 C212,154 242,165 282,151 C329,134 357,149 395,128 C440,108 470,128 508,112 C553,92 588,110 623,98 C666,84 701,91 734,76" />
            <g className="x-labels">
              <text x="42" y="264">6/19</text>
              <text x="150" y="264">6/20</text>
              <text x="260" y="264">6/21</text>
              <text x="370" y="264">6/22</text>
              <text x="480" y="264">6/23</text>
              <text x="590" y="264">6/24</text>
              <text x="700" y="264">6/25</text>
            </g>
          </>
        ) : (
          <path d="M8,90 C55,82 70,84 104,65 C150,42 170,59 210,43 C253,26 276,42 315,27 C355,15 382,21 412,10" />
        )}
      </svg>
    </div>
  );
}

export function HealthPanel({ onOpenSync }: { onOpenSync: () => void }) {
  return (
    <article className="panel health-panel">
      <div className="panel-header">
        <div>
          <h2>账户健康</h2>
          <p>连接、投放与同步</p>
        </div>
        <button className="text-button" type="button" onClick={onOpenSync}>查看详情</button>
      </div>
      <div className="health-score">
        <div className="score-ring">86</div>
        <div>
          <strong>整体正常</strong>
          <span>有 2 项需要关注</span>
        </div>
      </div>
      <div className="health-list">
        <HealthItem tone="success" title="Meta 连接正常" detail="权限有效，演示连接" />
        <HealthItem tone="success" title="数据同步正常" detail="最近更新 6 分钟前" />
        <HealthItem tone="warning" title="3 个广告无转化" detail="近 3 天花费超过 ₩150,000" />
        <HealthItem tone="warning" title="1 个素材频次偏高" detail="近 7 天频次为 5.8" />
      </div>
    </article>
  );
}

function HealthItem({ tone, title, detail }: { tone: "success" | "warning"; title: string; detail: string }) {
  return (
    <div className="health-item">
      <span className={cn("health-icon", tone)}>{tone === "success" ? <Check size={14} /> : "!"}</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="state-panel panel" data-testid="loading-state">
      <Loader2 className="state-spin" size={22} />
      <strong>正在加载演示数据</strong>
      <span>保留页面结构，数据区使用 skeleton 占位。</span>
      <div className="skeleton-list">
        {Array.from({ length: rows }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title = "暂无数据", detail = "当前筛选条件没有返回结果。" }: { title?: string; detail?: string }) {
  return (
    <div className="state-panel panel">
      <Info size={22} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function ErrorState({ state }: { state: DataState }) {
  const copy: Record<DataState, { title: string; detail: string; tone: "warning" | "danger" | "info" }> = {
    idle: { title: "尚未运行查询", detail: "请选择配置后运行。", tone: "info" },
    loading: { title: "正在加载", detail: "数据正在进入页面。", tone: "info" },
    refreshing: { title: "正在刷新", detail: "保留旧数据并更新同步任务。", tone: "info" },
    success: { title: "正常", detail: "数据可用。", tone: "info" },
    empty: { title: "暂无数据", detail: "当前账户没有可展示对象。", tone: "info" },
    "filtered-empty": { title: "筛选后无结果", detail: "清除筛选条件或更换日期范围。", tone: "info" },
    stale: { title: "数据已过期", detail: "最近同步超过 2 小时，建议刷新。", tone: "warning" },
    partial: { title: "部分数据可用", detail: "部分任务失败，已保留成功结果。", tone: "warning" },
    "permission-denied": { title: "权限不足", detail: "当前角色不能查看或编辑这些对象。", tone: "danger" },
    "connection-expired": { title: "Meta 授权已失效", detail: "缓存数据可查看，写操作已禁用。", tone: "danger" },
    "recoverable-error": { title: "可重试错误", detail: "任务遇到临时错误，可稍后重试。", tone: "warning" },
    "fatal-error": { title: "配置错误", detail: "请检查连接、权限或环境变量。", tone: "danger" }
  };
  const current = copy[state];
  return (
    <div className={cn("state-panel panel", current.tone)}>
      <AlertTriangle size={22} />
      <strong>{current.title}</strong>
      <span>{current.detail}</span>
    </div>
  );
}

export function StateNotice({ state }: { state: Extract<DataState, "refreshing" | "stale" | "partial"> }) {
  const copy: Record<"refreshing" | "stale" | "partial", { title: string; detail: string; tone: "info" | "warning" }> = {
    refreshing: { title: "正在刷新", detail: "页面保留当前数据，后台同步任务更新完成后再替换结果。", tone: "info" },
    stale: { title: "数据已过期", detail: "当前展示最近一次成功同步结果，建议手动刷新。", tone: "warning" },
    partial: { title: "部分数据可用", detail: "已保留成功同步的数据，失败任务请到同步中心查看。", tone: "warning" }
  };
  const current = copy[state];
  return (
    <div className={cn("state-notice", current.tone)} role="status">
      <AlertTriangle size={15} />
      <strong>{current.title}</strong>
      <span>{current.detail}</span>
    </div>
  );
}

export function StateGate({ state, children }: { state: DataState; children: ReactNode }) {
  if (state === "loading") return <LoadingSkeleton />;
  if (state === "empty" || state === "filtered-empty") return <EmptyState title={state === "empty" ? "暂无数据" : "筛选后无结果"} />;
  if (state === "refreshing" || state === "stale" || state === "partial") {
    return (
      <>
        <StateNotice state={state} />
        {children}
      </>
    );
  }
  if (state !== "success") return <ErrorState state={state} />;
  return <>{children}</>;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <button className="dialog-close" type="button" onClick={onClose} aria-label="关闭">
          <X size={18} />
        </button>
        <div className="dialog-icon"><AlertTriangle size={18} /></div>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="dialog-actions">
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </section>
    </div>
  );
}
