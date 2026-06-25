"use client";

import { Download, Play, Save } from "lucide-react";
import { useMemo, useState } from "react";
import type { DataState } from "@adflow/shared";
import { rowsToCsv } from "@adflow/shared";
import type { ToastKind } from "@/lib/app-types";
import { Button, PageHeader, StateGate } from "@/components/ui";

type MetricKey = "spend" | "impressions" | "clicks" | "purchases" | "value" | "roas";
type BreakdownKey = "publisher_platform" | "device_platform" | "country";
type ChartType = "line" | "bar";

type ReportConfig = {
  account: string;
  level: "Ad" | "Ad Set" | "Campaign";
  dateRange: "近 7 天" | "近 14 天" | "近 30 天";
  granularity: "按天" | "按周" | "按月";
  metrics: MetricKey[];
  breakdowns: BreakdownKey[];
  filter: "有效广告" | "ROAS 小于 1.5" | "花费大于 100000";
  attribution: "使用账户归因设置" | "7-day click" | "1-day click";
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
  publisher_platform: "Publisher platform",
  device_platform: "Device platform",
  country: "Country"
};

const metricOptions = Object.keys(metricLabels) as MetricKey[];
const breakdownOptions = Object.keys(breakdownLabels) as BreakdownKey[];

const baseConfig: ReportConfig = {
  account: "Seoul Beauty KR",
  level: "Ad",
  dateRange: "近 30 天",
  granularity: "按天",
  metrics: ["spend", "impressions", "clicks", "purchases", "value", "roas"],
  breakdowns: ["publisher_platform"],
  filter: "有效广告",
  attribution: "使用账户归因设置",
  chartType: "line"
};

const initialPresets: Preset[] = [
  { name: "近 30 天 Ad 平台效果", config: baseConfig },
  { name: "Campaign ROAS 监控", config: { ...baseConfig, level: "Campaign", metrics: ["spend", "purchases", "roas"], breakdowns: ["country"], filter: "ROAS 小于 1.5", chartType: "bar" } },
  { name: "素材疲劳诊断", config: { ...baseConfig, dateRange: "近 14 天", metrics: ["impressions", "clicks", "roas"], breakdowns: ["device_platform"], attribution: "1-day click" } }
];

export function ReportsPage({
  dataState,
  showToast
}: {
  dataState: DataState;
  showToast: (text: string, kind?: ToastKind) => void;
}) {
  const [config, setConfig] = useState<ReportConfig>(baseConfig);
  const [presets, setPresets] = useState<Preset[]>(initialPresets);
  const [presetPanelOpen, setPresetPanelOpen] = useState(true);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(initialPresets[0]?.name ?? "近 30 天 Ad 平台效果");
  const [rows, setRows] = useState<ReportRow[]>(() => buildReportRows(baseConfig));
  const [progress, setProgress] = useState(100);
  const [stage, setStage] = useState("异步报表已完成");
  const [note, setNote] = useState(`${buildReportRows(baseConfig).length} 行 · 生成于 2 分钟前`);

  const activeBreakdownLabel = config.breakdowns.map((item) => breakdownLabels[item]).join(" + ") || "无 Breakdown";
  const resultColumns = useMemo(() => ["日期", activeBreakdownLabel, ...config.metrics.map((metric) => metricLabels[metric])], [activeBreakdownLabel, config.metrics]);
  const rowTemplate = `1fr 1.2fr repeat(${config.metrics.length}, 0.9fr)`;

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
          setNote(`${nextRows.length} 行 · ${config.level} · ${config.dateRange} · ${activeBreakdownLabel}`);
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
    setConfig(preset.config);
    setSelectedPreset(preset.name);
    setStage("已应用预设，等待运行");
    setNote(`当前配置来自：${preset.name}`);
  };

  const exportCsv = () => {
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
      <PageHeader
        eyebrow="广告账户 / Seoul Beauty KR"
        title="自定义报表"
        description="使用允许的指标和 Breakdown 构建报表"
        actions={
          <>
            <Button onClick={() => setPresetPanelOpen((open) => !open)}>{presetPanelOpen ? "收起预设" : "打开预设"}</Button>
            <Button onClick={savePreset}><Save size={14} /> 保存预设</Button>
          </>
        }
      />

      <div className="report-layout three">
        <aside className="report-builder panel">
          <div className="builder-heading"><h2>查询配置</h2><span>{selectedPreset}</span></div>
          <label>广告账户<select value={config.account} onChange={(event) => updateConfig({ account: event.target.value })}><option>Seoul Beauty KR</option><option>Glow US DTC</option></select></label>
          <label>层级<select value={config.level} onChange={(event) => updateConfig({ level: event.target.value as ReportConfig["level"] })}><option value="Ad">广告 Ad</option><option value="Ad Set">广告组 Ad Set</option><option value="Campaign">广告系列 Campaign</option></select></label>
          <label>日期范围<select value={config.dateRange} onChange={(event) => updateConfig({ dateRange: event.target.value as ReportConfig["dateRange"] })}><option>近 7 天</option><option>近 14 天</option><option>近 30 天</option></select></label>
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
          <label>筛选条件<select value={config.filter} onChange={(event) => updateConfig({ filter: event.target.value as ReportConfig["filter"] })}><option>有效广告</option><option>ROAS 小于 1.5</option><option>花费大于 100000</option></select></label>
          <label>归因窗口<select value={config.attribution} onChange={(event) => updateConfig({ attribution: event.target.value as ReportConfig["attribution"] })}><option>使用账户归因设置</option><option>7-day click</option><option>1-day click</option></select></label>
          <div className="query-estimate"><span>预计规模</span><strong>{estimateSize(config)}</strong><small>将使用异步报表任务</small></div>
          <Button variant="primary" className="full" onClick={runReport}><Play size={14} /> 运行报表</Button>
        </aside>

        <section className="report-result panel">
          <div className="report-result-header">
            <div><h2>广告效果报表</h2><p>{config.level} · {config.granularity} · {activeBreakdownLabel}</p></div>
            <div>
              <Button size="compact" onClick={() => updateConfig({ chartType: config.chartType === "line" ? "bar" : "line" })}>图表：{config.chartType === "line" ? "折线" : "柱状"}</Button>
              <Button size="compact" onClick={exportCsv}><Download size={14} /> 导出 CSV</Button>
            </div>
          </div>
          <div className="report-progress">
            <div><span>{stage}</span><strong>{progress}%</strong></div>
            <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
            <small>{note}</small>
          </div>
          <div className={`report-chart ${config.chartType}`}>
            {config.chartType === "line" ? <LineChart /> : <BarChart />}
            <div className="legend"><span><i className="legend-line value" />{rows[0]?.breakdown ?? "结果 A"}</span><span><i className="legend-line spend" />{rows[1]?.breakdown ?? "结果 B"}</span></div>
          </div>
          <div className="report-table">
            <div className="report-row head" style={{ gridTemplateColumns: rowTemplate }}>
              {resultColumns.map((column) => <span key={column}>{column}</span>)}
            </div>
            {rows.slice(0, 8).map((row) => (
              <div className="report-row" key={`${row.date}-${row.breakdown}`} style={{ gridTemplateColumns: rowTemplate }}>
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
    </StateGate>
  );
}

function buildReportRows(config: ReportConfig): ReportRow[] {
  const dayCount = config.dateRange === "近 7 天" ? 4 : config.dateRange === "近 14 天" ? 6 : 8;
  const groups = breakdownGroups(config.breakdowns);
  const levelFactor = config.level === "Campaign" ? 1.32 : config.level === "Ad Set" ? 1.12 : 1;
  const filterFactor = config.filter === "ROAS 小于 1.5" ? 0.58 : config.filter === "花费大于 100000" ? 1.24 : 1;
  return Array.from({ length: dayCount }, (_, dayIndex) => groups.map((group, groupIndex) => {
    const base = (dayIndex + 4) * (groupIndex + 2) * levelFactor * filterFactor;
    const spend = Math.round(base * 28500);
    const impressions = Math.round(base * 9200);
    const clicks = Math.round(impressions * (0.018 + groupIndex * 0.006));
    const purchases = Math.max(1, Math.round(clicks * (config.filter === "ROAS 小于 1.5" ? 0.006 : 0.012)));
    const value = Math.round(purchases * (config.filter === "ROAS 小于 1.5" ? 18000 : 42000));
    const roas = spend > 0 ? (value / spend).toFixed(2) : "0.00";
    return {
      date: `2026-06-${String(25 - dayIndex).padStart(2, "0")}`,
      breakdown: group,
      spend: `₩${spend.toLocaleString("en-US")}`,
      impressions: impressions.toLocaleString("en-US"),
      clicks: clicks.toLocaleString("en-US"),
      purchases: String(purchases),
      value: `₩${value.toLocaleString("en-US")}`,
      roas
    };
  })).flat();
}

function breakdownGroups(breakdowns: BreakdownKey[]): string[] {
  const primary = breakdowns[0] ?? "publisher_platform";
  if (primary === "device_platform") return ["Mobile", "Desktop"];
  if (primary === "country") return ["KR", "US"];
  return ["Facebook", "Instagram"];
}

function estimateSize(config: ReportConfig): string {
  const days = config.dateRange === "近 7 天" ? 7 : config.dateRange === "近 14 天" ? 14 : 30;
  const size = days * Math.max(1, config.metrics.length) * Math.max(1, config.breakdowns.length);
  if (size > 240) return "较大 · 约 1,200 行";
  if (size > 80) return "中等 · 约 640 行";
  return "较小 · 约 180 行";
}

function LineChart() {
  return (
    <svg viewBox="0 0 800 220">
      <g className="grid-lines">
        <line x1="40" y1="25" x2="780" y2="25" />
        <line x1="40" y1="80" x2="780" y2="80" />
        <line x1="40" y1="135" x2="780" y2="135" />
        <line x1="40" y1="190" x2="780" y2="190" />
      </g>
      <path className="report-line facebook" d="M42,162 C95,146 115,151 158,128 C210,101 238,116 280,91 C332,61 358,78 406,67 C452,55 488,78 530,53 C579,24 610,43 652,36 C704,25 742,34 778,22" />
      <path className="report-line instagram" d="M42,179 C92,169 116,172 158,156 C208,135 236,145 280,128 C330,108 362,121 406,103 C454,88 486,105 530,84 C578,65 610,77 652,61 C704,49 742,53 778,42" />
    </svg>
  );
}

function BarChart() {
  return (
    <svg viewBox="0 0 800 220">
      <g className="grid-lines">
        <line x1="40" y1="40" x2="780" y2="40" />
        <line x1="40" y1="96" x2="780" y2="96" />
        <line x1="40" y1="152" x2="780" y2="152" />
      </g>
      {[0, 1, 2, 3, 4, 5, 6].map((index) => (
        <g key={index}>
          <rect className="report-bar facebook" x={68 + index * 96} y={60 - index * 3} width="30" height={130 + index * 3} rx="5" />
          <rect className="report-bar instagram" x={103 + index * 96} y={88 - index * 5} width="30" height={102 + index * 5} rx="5" />
        </g>
      ))}
    </svg>
  );
}
