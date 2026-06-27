"use client";

import { Download, Play, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DataState } from "@adflow/shared";
import { rowsToCsv } from "@adflow/shared";
import type { ToastKind } from "@/lib/app-types";
import { Button, DataSourceGate, DisabledReason, LiveEmptyState, PageHeader, StateGate } from "@/components/ui";
import { useDemoContext, type CompareRange } from "@/lib/demo-context";
import { useAppRuntime } from "@/lib/app-runtime";

type MetricKey = "spend" | "impressions" | "clicks" | "purchases" | "value" | "roas";
type BreakdownKey = "publisher_platform" | "device_platform" | "country";
type ChartType = "line" | "bar";

type ReportConfig = {
  account: string;
  currency: "KRW" | "USD";
  level: "Ad" | "Ad Set" | "Campaign";
  dateRange: "近 7 天" | "近 14 天" | "近 30 天";
  granularity: "按天" | "按周" | "按月";
  metrics: MetricKey[];
  breakdowns: BreakdownKey[];
  filter: "有效广告" | "ROAS 小于 1.5" | "花费大于 100000";
  attribution: "使用账户归因设置" | "7-day click" | "1-day click";
  compareRange: CompareRange;
  chartType: ChartType;
};

type Preset = {
  name: string;
  config: ReportConfig;
};

type ReportRow = {
  date: string;
  breakdown: string;
  spend: string;
  impressions: string;
  clicks: string;
  purchases: string;
  value: string;
  roas: string;
};

const metricLabels: Record<MetricKey, string> = {
  spend: "花费",
  impressions: "曝光",
  clicks: "点击",
  purchases: "购买",
  value: "转化价值",
  roas: "ROAS"
};

const breakdownLabels: Record<BreakdownKey, string> = {
  publisher_platform: "发布平台",
  device_platform: "设备平台",
  country: "国家/地区"
};

const metricOptions = Object.keys(metricLabels) as MetricKey[];
const breakdownOptions = Object.keys(breakdownLabels) as BreakdownKey[];

const baseConfig: ReportConfig = {
  account: "首尔美妆演示账户",
  currency: "KRW",
  level: "Ad",
  dateRange: "近 30 天",
  granularity: "按天",
  metrics: ["spend", "impressions", "clicks", "purchases", "roas"],
  breakdowns: ["publisher_platform"],
  filter: "有效广告",
  attribution: "使用账户归因设置",
  compareRange: "上一周期",
  chartType: "line"
};

const initialPresets: Preset[] = [
  { name: "近 30 天 Ad 平台效果", config: baseConfig },
  { name: "Campaign ROAS 监控", config: { ...baseConfig, level: "Campaign", metrics: ["spend", "purchases", "roas"], breakdowns: ["country"], filter: "ROAS 小于 1.5", chartType: "bar" } },
  { name: "素材疲劳诊断", config: { ...baseConfig, dateRange: "近 14 天", metrics: ["impressions", "clicks", "roas"], breakdowns: ["device_platform"], attribution: "1-day click" } }
];

export function ReportsPage({
  dataState: providedDataState,
  showToast: providedShowToast
}: {
  dataState?: DataState;
  showToast?: (text: string, kind?: ToastKind) => void;
} = {}) {
  const runtime = useAppRuntime();
  const dataState = providedDataState ?? runtime.dataState;
  const showToast = providedShowToast ?? runtime.showToast;
  const { connection, account, accountLabel, dateRange, compareRange } = useDemoContext();
  const [config, setConfig] = useState<ReportConfig>(baseConfig);
  const [presets, setPresets] = useState<Preset[]>(initialPresets);
  const [presetPanelOpen, setPresetPanelOpen] = useState(true);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(initialPresets[0]?.name ?? "近 30 天 Ad 平台效果");
  const [rows, setRows] = useState<ReportRow[]>(() => connection.mode === "live" ? [] : buildReportRows(baseConfig));
  const [progress, setProgress] = useState(100);
  const [stage, setStage] = useState("异步报表已完成");
  const [note, setNote] = useState("640 行 · 生成于 2 分钟前");

  const activeBreakdownLabel = config.breakdowns.map((item) => breakdownLabels[item]).join(" + ") || "无 Breakdown";
  const resultColumns = useMemo(() => ["日期", activeBreakdownLabel, ...config.metrics.map((metric) => metricLabels[metric])], [activeBreakdownLabel, config.metrics]);
  const rowTemplate = `1fr 1.2fr repeat(${config.metrics.length}, 0.9fr)`;
  const chartMetric = config.metrics[0] ?? "spend";
  const hasLiveRows = !(connection.mode === "live" && rows.length === 0);

  useEffect(() => {
    if (connection.mode === "live") {
      setRows([]);
      setStage("等待真实 Insights");
      setProgress(0);
      setNote("实时模式不会生成演示报表行，请先同步真实 Insights。");
      return;
    }
    setConfig((current) => {
      const next = { ...current, account: account.name, currency: account.currency, dateRange, compareRange };
      if (
        current.account === next.account &&
        current.currency === next.currency &&
        current.dateRange === next.dateRange &&
        current.compareRange === next.compareRange
      ) {
        return current;
      }
      setRows(buildReportRows(next));
      setStage("上下文已同步");
      setProgress(100);
      setNote(`${next.account} · ${next.dateRange} · ${next.compareRange} · ${estimateSize(next)}`);
      return next;
    });
  }, [account.currency, account.name, compareRange, connection.mode, dateRange]);

  const updateConfig = (patch: Partial<ReportConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
    setStage("配置已变更，等待运行");
    setNote("点击运行报表后将按当前配置生成结果。");
  };

  const toggleMetric = (metric: MetricKey) => {
    updateConfig({
      metrics: config.metrics.includes(metric)
        ? config.metrics.filter((item) => item !== metric)
        : [...config.metrics, metric]
    });
  };

  const toggleBreakdown = (breakdown: BreakdownKey) => {
    updateConfig({
      breakdowns: config.breakdowns.includes(breakdown)
        ? config.breakdowns.filter((item) => item !== breakdown)
        : [...config.breakdowns, breakdown]
    });
  };

  const runReport = () => {
    if (connection.mode === "live") {
      setRows([]);
      setProgress(0);
      setStage("等待真实 Insights");
      setNote("请先在同步中心同步真实 Insights，再运行报表。");
      showToast("暂无真实 Insights 数据，不能生成生产报表。", "warning");
      return;
    }
    if (config.metrics.length === 0) {
      showToast("至少选择 1 个指标", "warning");
      return;
    }
    setProgress(0);
    setStage("排队中");
    setNote("正在创建内部异步报表任务…");
    const steps = [
      ["Meta 正在生成报表", 28, "页面轮询内部任务，不直接轮询 Meta"],
      ["正在下载分页结果", 58, "已保存 cursor checkpoint"],
      ["正在写入本地报表", 84, "正在校验行和汇总数据"],
      ["异步报表已完成", 100, "done"]
    ] as const;
    steps.forEach(([nextStage, nextProgress, nextNote], index) => {
      window.setTimeout(() => {
        setStage(nextStage);
        setProgress(nextProgress);
        if (nextNote === "done") {
          const nextRows = buildReportRows(config);
          setRows(nextRows);
          setNote(`${nextRows.length} 行 · ${config.account} · ${config.level} · ${config.dateRange} · ${config.granularity} · ${config.attribution}`);
          showToast("报表完成，结果已按当前配置更新", "success");
          return;
        }
        setNote(nextNote);
      }, 420 * (index + 1));
    });
  };

  const savePreset = () => {
    const name = `自定义预设 ${presets.length + 1}`;
    setPresets((current) => [...current, { name, config }]);
    setSelectedPreset(name);
    setPresetPanelOpen(true);
    showToast("当前查询配置已保存为演示预设", "success");
  };

  const applyPreset = (preset: Preset) => {
    setConfig((current) => ({
      ...preset.config,
      account: current.account,
      currency: current.currency,
      dateRange: current.dateRange,
      compareRange: current.compareRange
    }));
    setSelectedPreset(preset.name);
    setStage("已应用预设，等待运行");
    setNote(`当前配置来自：${preset.name}`);
  };

  const exportCsv = () => {
    if (connection.mode === "live" && rows.length === 0) {
      showToast("Live report adapter returned no rows to export.", "warning");
      return;
    }
    const csv = rowsToCsv([
      resultColumns,
      ...rows.map((row) => [
        row.date,
        row.breakdown,
        ...config.metrics.map((metric) => row[metric])
      ])
    ]);
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `adflow-report-${config.level.toLowerCase().replace(" ", "-")}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("CSV 已导出，内容来自当前报表结果", "success");
  };

  return (
    <StateGate state={dataState}>
      <DataSourceGate connection={connection}>
      <PageHeader
        className="report-header"
        eyebrow={accountLabel}
        title="自定义报表"
        description={connection.mode === "live" && !hasLiveRows ? "等待同步真实 Insights 后再生成报表" : "使用允许的指标和 Breakdown 构建报表"}
        actions={
          <>
            <Button onClick={() => setPresetPanelOpen((open) => !open)}>打开预设</Button>
            <Button onClick={savePreset}><Save size={14} /> 保存预设</Button>
          </>
        }
      />

      {!hasLiveRows ? (
        <LiveEmptyState
          title="暂无真实 Insights 数据"
          detail="同步 Insights 后可按层级、日期、指标和 Breakdown 创建报表。生产 Live 模式不会生成模拟报表。"
          requirements={<DisabledReason>{connection.state === "unconfigured" ? "需要先配置 Meta App" : "需要先连接 Meta 账号并同步 Insights"}</DisabledReason>}
          actions={
            <>
              <Button variant="primary" disabled={!connection.canRead} title={!connection.canRead ? "请先配置 Meta App 并完成 Meta 授权" : undefined} onClick={() => showToast(connection.canRead ? "已提交同步 Insights 任务。" : connection.stateDetail, connection.canRead ? "success" : "warning")}>同步 Insights</Button>
              <Button onClick={() => window.location.assign("/ads/settings/meta-app")}>配置 Meta App</Button>
              <Button onClick={() => setPresetPanelOpen(true)}>配置报表</Button>
              <Button variant="ghost" onClick={() => window.location.assign("/ads/demo/reports")}>查看演示沙箱</Button>
            </>
          }
        />
      ) : (
        <>
      <div className="report-layout three">
        <aside className="report-builder panel">
          <div className="builder-heading"><h2>查询配置</h2><span>{selectedPreset}</span></div>
          <label>层级<select value={config.level} onChange={(event) => updateConfig({ level: event.target.value as ReportConfig["level"] })}><option value="Ad">广告 Ad</option><option value="Ad Set">广告组 Ad Set</option><option value="Campaign">广告系列 Campaign</option></select></label>
          <label>日期范围<select value={config.dateRange} onChange={(event) => updateConfig({ dateRange: event.target.value as ReportConfig["dateRange"] })}><option value="近 7 天">2026/06/19 – 2026/06/25</option><option value="近 14 天">2026/06/12 – 2026/06/25</option><option value="近 30 天">2026/05/27 – 2026/06/25</option></select></label>
          <label>时间粒度<select value={config.granularity} onChange={(event) => updateConfig({ granularity: event.target.value as ReportConfig["granularity"] })}><option>按天</option><option>按周</option><option>按月</option></select></label>
          <div className="builder-section">
            <div className="builder-label">指标 <button type="button" onClick={() => setMetricsOpen((open) => !open)}>编辑</button></div>
            <div className="token-list">
              {config.metrics.map((metric) => <span key={metric}>{metricLabels[metric]} <button type="button" onClick={() => toggleMetric(metric)}>×</button></span>)}
              {config.metrics.length === 0 ? <span>未选择</span> : null}
            </div>
            {metricsOpen ? (
              <div className="option-grid">
                {metricOptions.map((metric) => (
                  <button key={metric} className={config.metrics.includes(metric) ? "active" : ""} type="button" onClick={() => toggleMetric(metric)}>{metricLabels[metric]}</button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="builder-section">
            <div className="builder-label">Breakdown <button type="button" onClick={() => setBreakdownOpen((open) => !open)}>添加</button></div>
            <div className="token-list">
              {config.breakdowns.map((breakdown) => <span key={breakdown}>{breakdownLabels[breakdown]} <button type="button" onClick={() => toggleBreakdown(breakdown)}>×</button></span>)}
              {config.breakdowns.length === 0 ? <span>无 Breakdown</span> : null}
            </div>
            {breakdownOpen ? (
              <div className="option-grid">
                {breakdownOptions.map((breakdown) => (
                  <button key={breakdown} className={config.breakdowns.includes(breakdown) ? "active" : ""} type="button" onClick={() => toggleBreakdown(breakdown)}>{breakdownLabels[breakdown]}</button>
                ))}
              </div>
            ) : null}
            <div className="compatibility ok">✓ 当前组合受支持</div>
          </div>
          <div className="report-inline-fields">
            <label>筛选条件<select value={config.filter} onChange={(event) => updateConfig({ filter: event.target.value as ReportConfig["filter"] })}><option>有效广告</option><option>ROAS 小于 1.5</option><option>花费大于 100000</option></select></label>
            <label>归因窗口<select value={config.attribution} onChange={(event) => updateConfig({ attribution: event.target.value as ReportConfig["attribution"] })}><option>使用账户归因设置</option><option>7-day click</option><option>1-day click</option></select></label>
          </div>
          <div className="query-estimate"><span>预计规模</span><strong>{estimateSize(config)}</strong><small>将使用异步报表任务</small></div>
          <Button variant="primary" className="full" onClick={runReport}><Play size={14} /> 运行报表</Button>
        </aside>

        <section className="report-result panel">
          <div className="report-result-header">
            <div><h2>广告效果报表</h2><p>{config.level} · {config.granularity} · {activeBreakdownLabel}</p></div>
            <div>
              <Button size="compact" onClick={() => updateConfig({ chartType: config.chartType === "line" ? "bar" : "line" })}>图表</Button>
              <Button size="compact" onClick={exportCsv}><Download size={14} /> 导出 CSV</Button>
            </div>
          </div>
          <div className="report-progress">
            <div><span>{stage}</span><strong>{progress}%</strong></div>
            <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
            <small data-testid="report-note">{note}</small>
          </div>
          <div className={`report-chart ${config.chartType}`}>
            {config.chartType === "line" ? <LineChart rows={rows} metric={chartMetric} /> : <BarChart rows={rows} metric={chartMetric} />}
            <div className="legend">
              {[...new Set(rows.map((row) => row.breakdown))].slice(0, 2).map((group, index) => (
                <span key={group}><i className={`legend-line ${index === 0 ? "value" : "spend"}`} />{group}</span>
              ))}
            </div>
          </div>
          <div className="report-table">
            <div className="report-row head" style={{ gridTemplateColumns: rowTemplate }}>
              {resultColumns.map((column) => <span key={column}>{column}</span>)}
            </div>
            {rows.slice(0, 4).map((row) => (
              <div className="report-row" data-testid="report-row" key={`${row.date}-${row.breakdown}`} style={{ gridTemplateColumns: rowTemplate }}>
                <span>{row.date}</span>
                <span>{row.breakdown}</span>
                {config.metrics.map((metric) => metric === "roas" ? <strong key={metric}>{row[metric]}</strong> : <span key={metric}>{row[metric]}</span>)}
              </div>
            ))}
          </div>
        </section>

        {presetPanelOpen ? (
          <aside className="report-side panel">
            <h2>字段与预设</h2>
            {presets.map((preset) => (
              <button key={preset.name} className={selectedPreset === preset.name ? "active" : ""} type="button" onClick={() => applyPreset(preset)}>{preset.name}</button>
            ))}
            <div className="field-catalog">
              {metricOptions.map((metric) => <span key={metric}>{metric}</span>)}
              {breakdownOptions.map((breakdown) => <span key={breakdown}>{breakdown}</span>)}
            </div>
          </aside>
        ) : null}
      </div>
        </>
      )}
      </DataSourceGate>
    </StateGate>
  );
}

function buildReportRows(config: ReportConfig): ReportRow[] {
  const dayCount = config.granularity === "按月" ? 1 : config.granularity === "按周" ? (config.dateRange === "近 30 天" ? 4 : 2) : config.dateRange === "近 7 天" ? 4 : config.dateRange === "近 14 天" ? 6 : 8;
  const groups = breakdownGroups(config.breakdowns);
  const levelFactor = config.level === "Campaign" ? 1.32 : config.level === "Ad Set" ? 1.12 : 1;
  const filterFactor = config.filter === "ROAS 小于 1.5" ? 0.58 : config.filter === "花费大于 100000" ? 1.24 : 1;
  const accountFactor = config.account === "Glow 美国演示账户" ? 0.73 : 1;
  const attributionFactor = config.attribution === "7-day click" ? 0.94 : config.attribution === "1-day click" ? 0.82 : 1;
  const compareFactor = config.compareRange === "去年同期" ? 1.16 : config.compareRange === "不对比" ? 0.97 : 1;
  return Array.from({ length: dayCount }, (_, dayIndex) => groups.map((group, groupIndex) => {
    const base = (dayIndex + 4) * (groupIndex + 2) * levelFactor * filterFactor * accountFactor * attributionFactor * compareFactor;
    const dayCurve = [1, 0.934, 0.858, 0.801, 0.64, 0.47, 0.31, 0.17][dayIndex] ?? Math.max(0.12, 1 - dayIndex * 0.11);
    const isPublisher = config.breakdowns.length === 1 && config.breakdowns[0] === "publisher_platform";
    const publisherDefaults: Record<string, { spend: number; impressions: number; clicks: number; purchases: number; roas: number }> = {
      Facebook: { spend: 398400, impressions: 142830, clicks: 3418, purchases: 42, roas: 3.14 },
      Instagram: { spend: 316200, impressions: 118406, clicks: 2926, purchases: 31, roas: 2.67 }
    };
    const defaults = isPublisher ? publisherDefaults[group] : undefined;
    const spend = defaults ? Math.round(defaults.spend * dayCurve * levelFactor * filterFactor * accountFactor * attributionFactor * compareFactor) : Math.round(base * 28500);
    const impressions = defaults ? Math.round(defaults.impressions * dayCurve * levelFactor * filterFactor * accountFactor * attributionFactor * compareFactor) : Math.round(base * 9200);
    const clicks = defaults ? Math.round(defaults.clicks * dayCurve * levelFactor * filterFactor * accountFactor * attributionFactor * compareFactor) : Math.round(impressions * (0.018 + groupIndex * 0.006));
    const purchases = defaults ? Math.max(1, Math.round(defaults.purchases * dayCurve * levelFactor * filterFactor * accountFactor * attributionFactor * compareFactor)) : Math.max(1, Math.round(clicks * (config.filter === "ROAS 小于 1.5" ? 0.006 : 0.012)));
    const value = defaults ? Math.round(spend * defaults.roas * (config.filter === "ROAS 小于 1.5" ? 0.42 : 1)) : Math.round(purchases * (config.filter === "ROAS 小于 1.5" ? 18000 : 42000));
    const roas = spend > 0 ? (value / spend).toFixed(2) : "0.00";
    return {
      date: config.granularity === "按月" ? "2026-06" : config.granularity === "按周" ? `2026-W${String(26 - dayIndex).padStart(2, "0")}` : `2026-06-${String(25 - dayIndex).padStart(2, "0")}`,
      breakdown: group,
      spend: formatReportMoney(spend, config.currency),
      impressions: impressions.toLocaleString("en-US"),
      clicks: clicks.toLocaleString("en-US"),
      purchases: String(purchases),
      value: formatReportMoney(value, config.currency),
      roas
    };
  })).flat();
}

function breakdownGroups(breakdowns: BreakdownKey[]): string[] {
  const values: Record<BreakdownKey, string[]> = {
    publisher_platform: ["Facebook", "Instagram"],
    device_platform: ["Mobile", "Desktop"],
    country: ["KR", "US"]
  };
  if (breakdowns.length === 0) return ["全部"];
  const active = breakdowns.length > 0 ? breakdowns : ["publisher_platform" as const];
  return active.reduce<string[]>((groups, breakdown) => groups.flatMap((group) => values[breakdown].map((value) => group ? `${group} / ${value}` : value)), [""]);
}

function formatReportMoney(value: number, currency: ReportConfig["currency"]): string {
  return `${currency === "USD" ? "$" : "₩"}${Math.round(value).toLocaleString("en-US")}`;
}

function estimateSize(config: ReportConfig): string {
  const days = config.dateRange === "近 7 天" ? 7 : config.dateRange === "近 14 天" ? 14 : 30;
  const size = days * Math.max(1, config.metrics.length) * breakdownGroups(config.breakdowns).length;
  if (size > 240) return "较大 · 约 1,200 行";
  if (size > 80) return "中等 · 约 640 行";
  return "较小 · 约 180 行";
}

function LineChart({ rows, metric }: { rows: ReportRow[]; metric: MetricKey }) {
  const groups = [...new Set(rows.map((row) => row.breakdown))].slice(0, 2);
  const values = rows.map((row) => metricValue(row, metric));
  const max = Math.max(...values, 1);
  return (
    <svg viewBox="0 0 800 220">
      <g className="grid-lines">
        <line x1="40" y1="25" x2="780" y2="25" />
        <line x1="40" y1="80" x2="780" y2="80" />
        <line x1="40" y1="135" x2="780" y2="135" />
        <line x1="40" y1="190" x2="780" y2="190" />
      </g>
      {groups.map((group, index) => <path key={group} className={`report-line ${index === 0 ? "facebook" : "instagram"}`} d={linePath([...rows.filter((row) => row.breakdown === group)].reverse(), metric, max)} />)}
    </svg>
  );
}

function BarChart({ rows, metric }: { rows: ReportRow[]; metric: MetricKey }) {
  const groups = [...new Set(rows.map((row) => row.breakdown))].slice(0, 2);
  const values = rows.map((row) => metricValue(row, metric));
  const max = Math.max(...values, 1);
  const sample = rows.slice(0, 8);
  return (
    <svg viewBox="0 0 800 220">
      <g className="grid-lines">
        <line x1="40" y1="40" x2="780" y2="40" />
        <line x1="40" y1="96" x2="780" y2="96" />
        <line x1="40" y1="152" x2="780" y2="152" />
      </g>
      {sample.map((row, index) => {
        const height = Math.max(12, (metricValue(row, metric) / max) * 150);
        const groupIndex = groups.indexOf(row.breakdown);
        return (
        <g key={`${row.date}-${row.breakdown}`}>
          <rect className={`report-bar ${groupIndex === 0 ? "facebook" : "instagram"}`} x={68 + Math.floor(index / Math.max(1, groups.length)) * 96 + groupIndex * 35} y={190 - height} width="30" height={height} rx="5" />
        </g>
        );
      })}
    </svg>
  );
}

function metricValue(row: ReportRow, metric: MetricKey): number {
  return Number(row[metric].replace(/[^\d.-]/g, "")) || 0;
}

function linePath(rows: ReportRow[], metric: MetricKey, max: number): string {
  if (rows.length === 0) return "";
  const points = rows.map((row, index) => {
    const x = 42 + index * (736 / Math.max(1, rows.length - 1));
    const y = 190 - (metricValue(row, metric) / max) * 165;
    return { x, y };
  });
  return points.reduce((path, point, index) => {
    if (index === 0) return `M${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    const previous = points[index - 1] ?? point;
    const controlOffset = (point.x - previous.x) * 0.48;
    return `${path} C${(previous.x + controlOffset).toFixed(1)},${previous.y.toFixed(1)} ${(point.x - controlOffset).toFixed(1)},${point.y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }, "");
}
