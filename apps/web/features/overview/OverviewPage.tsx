"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DataState } from "@adflow/shared";
import { demoProvider, type CampaignEntity } from "@adflow/meta-client";
import type { ToastKind } from "@/lib/app-types";
import { Button, HealthPanel, KpiCard, PageHeader, StateGate, StatusDot, TrendChart } from "@/components/ui";
import { useDemoContext } from "@/lib/demo-context";
import { useAppRuntime } from "@/lib/app-runtime";

export function OverviewPage({
  dataState: providedDataState,
  showToast: providedShowToast
}: {
  dataState?: DataState;
  showToast?: (text: string, kind?: ToastKind) => void;
} = {}) {
  const runtime = useAppRuntime();
  const dataState = providedDataState ?? runtime.dataState;
  const showToast = providedShowToast ?? runtime.showToast;
  const router = useRouter();
  const { account, accountLabel, dateLabel, dateRange, compareRange, queryContext, revision } = useDemoContext();
  const kpis = demoProvider.getKpis(queryContext);
  const topRows = demoProvider.listEntities("campaign", account.id, "", queryContext).slice(0, 5);
  const trend = buildOverviewTrend(account.currency, dateRange, compareRange);
  const health = buildHealthData(account.name, account.currency, topRows);
  const referenceContext = account.id === "act_23840008291" && dateRange === "近 7 天" && compareRange === "上一周期";
  const [snapshotSavedAt, setSnapshotSavedAt] = useState<string | null>(null);
  void revision;

  const saveSnapshot = () => {
    const savedAt = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    window.localStorage.setItem("adflow.overviewSnapshot", JSON.stringify({ savedAt, kpiCount: kpis.length, topRows: topRows.length }));
    setSnapshotSavedAt(savedAt);
    showToast("快照已保存到本地演示视图", "success");
  };

  return (
    <StateGate state={dataState}>
      <PageHeader
        eyebrow={accountLabel}
        title="广告总览"
        description={`${dateLabel} · ${snapshotSavedAt ? `快照保存于 ${snapshotSavedAt}` : "报表更新于 6 分钟前"}`}
        actions={
          <>
            <Button onClick={saveSnapshot}>保存快照</Button>
            <Button variant="primary" onClick={() => router.push("/campaigns/new?step=1")}>+ 新建广告</Button>
          </>
        }
      />

      <div className="metric-grid">
        {kpis.map((metric) => <KpiCard key={metric.label} metric={metric} />)}
      </div>

      <div className="overview-grid">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>效果趋势</h2>
              <p>花费与转化价值 · 日粒度</p>
            </div>
            <div className="legend">
              <span><i className="legend-line spend" />花费</span>
              <span><i className="legend-line value" />转化价值</span>
            </div>
          </div>
          {referenceContext ? <TrendChart /> : <OverviewTrendChart points={trend.points} />}
          <div className="chart-summary">{referenceContext ? "本周期花费增长 12.4%，购买价值增长 18.9%，ROAS 提升 5.8%。" : trend.summary}</div>
        </article>

        {referenceContext ? <HealthPanel onOpenSync={() => router.push("/sync-center")} /> : <OverviewHealthPanel data={health} onOpenSync={() => router.push("/sync-center")} />}
      </div>

      <div className="overview-bottom">
        <article className="panel top-campaigns">
          <div className="panel-header">
            <div>
              <h2>广告系列表现</h2>
              <p>按花费排序的前 5 项</p>
            </div>
            <button className="text-button" type="button" onClick={() => router.push("/campaigns?level=campaign")}>
              查看全部 <ArrowRight size={13} />
            </button>
          </div>
          <div className="mini-table">
            <div className="mini-row mini-head">
              <span>广告系列</span><span>花费</span><span>购买</span><span>CPA</span><span>ROAS</span>
            </div>
            {topRows.map((row) => (
              <div className="mini-row" key={row.id}>
                <span><StatusDot tone={row.warning ? "warning" : row.status === "active" ? "success" : "muted"} />{row.name}</span>
                <span>{row.spend}</span>
                <span>{row.purchases}</span>
                <span>{row.cpa}</span>
                <strong>{row.roas}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel attention-panel">
          <div className="panel-header">
            <div>
              <h2>需要关注</h2>
              <p>基于固定规则，不是 AI 建议</p>
            </div>
          </div>
          {buildAttentionItems(account.name, account.currency, topRows).map((item) => (
            <Attention key={item.title} level={item.level} title={item.title} detail={item.detail} onClick={() => router.push(item.href)} />
          ))}
        </article>
      </div>
    </StateGate>
  );
}

function Attention({ level, title, detail, onClick }: { level: "高" | "中" | "低"; title: string; detail: string; onClick: () => void }) {
  const cls = level === "高" ? "high" : level === "中" ? "medium" : "low";
  return (
    <div className="attention-item">
      <span className={`attention-rank ${cls}`}>{level}</span>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <button type="button" onClick={onClick}>查看</button>
    </div>
  );
}

type TrendPoint = { label: string; spend: number; value: number };

function buildOverviewTrend(currency: "KRW" | "USD", dateRange: string, compareRange: string): { points: TrendPoint[]; summary: string } {
  const count = dateRange === "近 30 天" ? 10 : dateRange === "近 14 天" ? 7 : 5;
  const currencyFactor = currency === "USD" ? 0.072 : 1;
  const compareFactor = compareRange === "去年同期" ? 1.16 : compareRange === "不对比" ? 1 : 1.06;
  const points = Array.from({ length: count }, (_, index) => {
    const lift = (index + 3) * compareFactor;
    return {
      label: `6/${25 - count + index + 1}`,
      spend: Math.round(lift * 72000 * currencyFactor),
      value: Math.round(lift * 188000 * currencyFactor)
    };
  });
  const first = points[0] ?? { spend: 0, value: 0 };
  const last = points.at(-1) ?? first;
  const spendChange = percentChange(first.spend, last.spend);
  const valueChange = percentChange(first.value, last.value);
  const prefix = currency === "USD" ? "美元账户" : "韩元账户";
  const comparison = compareRange === "不对比" ? "当前未开启对比，变化值显示 —" : `花费 ${spendChange}，转化价值 ${valueChange}`;
  return { points, summary: `${prefix} · ${dateRange} · ${comparison}。` };
}

function OverviewTrendChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(...points.map((point) => Math.max(point.spend, point.value)), 1);
  return (
    <div className="chart-wrap" aria-label="动态效果趋势图">
      <svg viewBox="0 0 760 270" role="img">
        <g className="grid-lines">
          <line x1="54" y1="24" x2="735" y2="24" />
          <line x1="54" y1="78" x2="735" y2="78" />
          <line x1="54" y1="132" x2="735" y2="132" />
          <line x1="54" y1="186" x2="735" y2="186" />
          <line x1="54" y1="240" x2="735" y2="240" />
        </g>
        <path className="line-path value-path" d={trendPath(points, "value", max)} />
        <path className="line-path spend-path" d={trendPath(points, "spend", max)} />
        <g className="x-labels">
          {points.map((point, index) => <text key={point.label} x={42 + index * (658 / Math.max(1, points.length - 1))} y="264">{point.label}</text>)}
        </g>
      </svg>
    </div>
  );
}

function OverviewHealthPanel({ data, onOpenSync }: { data: ReturnType<typeof buildHealthData>; onOpenSync: () => void }) {
  return (
    <article className="panel health-panel">
      <div className="panel-header">
        <div>
          <h2>账户健康</h2>
          <p>{data.accountName} · 连接、投放与同步</p>
        </div>
        <button className="text-button" type="button" onClick={onOpenSync}>查看详情</button>
      </div>
      <div className="health-score">
        <div className="score-ring">{data.score}</div>
        <div>
          <strong>{data.status}</strong>
          <span>{data.detail}</span>
        </div>
      </div>
      <div className="health-list">
        {data.items.map((item) => (
          <div className="health-item" key={item.title}>
            <span className={`health-icon ${item.tone}`}>{item.tone === "success" ? "✓" : "!"}</span>
            <div><strong>{item.title}</strong><small>{item.detail}</small></div>
          </div>
        ))}
      </div>
    </article>
  );
}

function buildHealthData(accountName: string, currency: "KRW" | "USD", rows: CampaignEntity[]) {
  const warningRows = rows.filter((row) => row.warning || Number(row.roas) < 1.5);
  const score = Math.max(72, 92 - warningRows.length * 6);
  const symbol = currency === "USD" ? "$" : "₩";
  return {
    accountName,
    score,
    status: warningRows.length > 0 ? "有项目需要关注" : "整体正常",
    detail: `${warningRows.length} 项需要关注`,
    items: [
      { tone: "success" as const, title: "Meta 连接正常", detail: `${accountName} 权限有效` },
      { tone: "success" as const, title: "数据同步正常", detail: "最近更新 6 分钟前" },
      { tone: warningRows.length ? "warning" as const : "success" as const, title: `${warningRows.length} 个广告系列需检查`, detail: `当前账户阈值 ${symbol}${currency === "USD" ? "120" : "150,000"}` },
      { tone: "warning" as const, title: "素材频次监控", detail: currency === "USD" ? "US 素材最近 7 天频次偏高" : "近 7 天频次为 5.8" }
    ]
  };
}

function buildAttentionItems(accountName: string, currency: "KRW" | "USD", rows: CampaignEntity[]): Array<{ level: "高" | "中" | "低"; title: string; detail: string; href: string }> {
  const symbol = currency === "USD" ? "$" : "₩";
  const firstWarning = rows.find((row) => row.warning || Number(row.roas) < 1.5) ?? rows[0];
  return [
    { level: "高", title: firstWarning?.name ?? `${accountName} Campaign`, detail: `低 ROAS 或待检查对象，当前花费 ${firstWarning?.spend ?? `${symbol}0`}。`, href: "/campaigns?level=campaign" },
    { level: "中", title: `${accountName} 素材频次`, detail: currency === "USD" ? "US 账户使用美元数据，需检查疲劳素材。" : "近 7 天频次高于账户阈值。", href: "/creatives" },
    { level: "低", title: "同步任务", detail: "仅显示当前账户的同步和 API 错误。", href: "/sync-center" }
  ];
}

function trendPath(points: TrendPoint[], field: "spend" | "value", max: number): string {
  return points.map((point, index) => {
    const x = 55 + index * (679 / Math.max(1, points.length - 1));
    const y = 240 - (point[field] / max) * 216;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function percentChange(start: number, end: number): string {
  if (start <= 0) return "—";
  return `${(((end - start) / start) * 100).toFixed(1)}%`;
}
