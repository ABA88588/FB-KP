"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DataState } from "@adflow/shared";
import { demoProvider } from "@adflow/meta-client";
import type { ToastKind } from "@/lib/app-types";
import { Button, HealthPanel, KpiCard, PageHeader, StateGate, StatusDot, TrendChart } from "@/components/ui";
import { useDemoContext } from "@/lib/demo-context";

export function OverviewPage({
  dataState,
  showToast
}: {
  dataState: DataState;
  showToast: (text: string, kind?: ToastKind) => void;
}) {
  const router = useRouter();
  const { accountLabel, dateLabel, queryContext, revision } = useDemoContext();
  const kpis = demoProvider.getKpis(queryContext);
  const topRows = demoProvider.listEntities("campaign", "", queryContext).slice(0, 5);
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
          <TrendChart />
          <div className="chart-summary">本周期花费增长 12.4%，购买价值增长 18.9%，ROAS 提升 5.8%。</div>
        </article>

        <HealthPanel onOpenSync={() => router.push("/sync-center")} />
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
          <Attention level="高" title="Beauty Bundle｜Test" detail="近 3 天花费 ₩246,000，购买 2，ROAS 0.71。" onClick={() => router.push("/campaigns?level=campaign")} />
          <Attention level="中" title="Reels｜UGC 03" detail="频次 5.8，CTR 比前一周期下降 22%。" onClick={() => router.push("/campaigns?level=ad")} />
          <Attention level="低" title="同步错误 2 项" detail="报表任务限流，缓存数据仍可查看。" onClick={() => router.push("/sync-center")} />
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
