"use client";

import { Download, Play, Save } from "lucide-react";
import { useState } from "react";
import type { DataState } from "@adflow/shared";
import { demoProvider } from "@adflow/meta-client";
import type { ToastKind } from "@/lib/app-types";
import { Button, PageHeader, StateGate } from "@/components/ui";

export function ReportsPage({
  dataState,
  showToast
}: {
  dataState: DataState;
  showToast: (text: string, kind?: ToastKind) => void;
}) {
  const rows = demoProvider.listReportRows();
  const [progress, setProgress] = useState(100);
  const [stage, setStage] = useState("异步报表已完成");
  const [note, setNote] = useState("640 行 · 生成于 2 分钟前");

  const runReport = () => {
    setProgress(0);
    setStage("排队中");
    setNote("正在创建内部异步报表任务…");
    const steps = [
      ["Meta 正在生成报表", 28, "页面轮询内部任务，不直接轮询 Meta"],
      ["正在下载分页结果", 58, "已保存 cursor checkpoint"],
      ["正在写入本地报表", 84, "正在校验行和汇总数据"],
      ["异步报表已完成", 100, "640 行 · 刚刚生成"]
    ] as const;
    steps.forEach(([nextStage, nextProgress, nextNote], index) => {
      window.setTimeout(() => {
        setStage(nextStage);
        setProgress(nextProgress);
        setNote(nextNote);
        if (nextProgress === 100) showToast("报表完成，可导出 CSV", "success");
      }, 420 * (index + 1));
    });
  };

  const exportCsv = () => {
    const csv = demoProvider.exportReportCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "adflow-demo-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("CSV 已导出，公式注入字段已转义", "success");
  };

  return (
    <StateGate state={dataState}>
      <PageHeader
        eyebrow="广告账户 / Seoul Beauty KR"
        title="自定义报表"
        description="使用允许的指标和 Breakdown 构建报表"
        actions={
          <>
            <Button onClick={() => showToast("已打开预设列表", "info")}>打开预设</Button>
            <Button onClick={() => showToast("当前配置已保存为演示预设", "success")}><Save size={14} /> 保存预设</Button>
          </>
        }
      />

      <div className="report-layout three">
        <aside className="report-builder panel">
          <div className="builder-heading"><h2>查询配置</h2><span>已保存</span></div>
          <label>广告账户<select><option>Seoul Beauty KR</option></select></label>
          <label>层级<select><option>广告 Ad</option><option>广告组 Ad Set</option><option>广告系列 Campaign</option></select></label>
          <label>日期范围<button className="field-button" type="button">2026/05/27 – 2026/06/25 <span>▾</span></button></label>
          <label>时间粒度<select><option>按天</option><option>按周</option><option>按月</option></select></label>
          <div className="builder-section">
            <div className="builder-label">指标 <button type="button">编辑</button></div>
            <div className="token-list"><span>花费 ×</span><span>曝光 ×</span><span>点击 ×</span><span>购买 ×</span><span>转化价值 ×</span><span>ROAS ×</span></div>
          </div>
          <div className="builder-section">
            <div className="builder-label">Breakdown <button type="button">添加</button></div>
            <div className="token-list"><span>Publisher platform ×</span></div>
            <div className="compatibility ok">✓ 当前组合受支持</div>
          </div>
          <label>筛选条件<select><option>有效广告</option><option>ROAS 小于 1.5</option></select></label>
          <label>归因窗口<select><option>使用账户归因设置</option></select></label>
          <div className="query-estimate"><span>预计规模</span><strong>中等 · 约 640 行</strong><small>将使用异步报表任务</small></div>
          <Button variant="primary" className="full" onClick={runReport}><Play size={14} /> 运行报表</Button>
        </aside>

        <section className="report-result panel">
          <div className="report-result-header">
            <div><h2>广告效果报表</h2><p>Ad · 日粒度 · Publisher platform</p></div>
            <div><Button size="compact">图表</Button><Button size="compact" onClick={exportCsv}><Download size={14} /> 导出 CSV</Button></div>
          </div>
          <div className="report-progress">
            <div><span>{stage}</span><strong>{progress}%</strong></div>
            <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
            <small>{note}</small>
          </div>
          <div className="report-chart">
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
            <div className="legend"><span><i className="legend-line value" />Facebook</span><span><i className="legend-line spend" />Instagram</span></div>
          </div>
          <div className="report-table">
            <div className="report-row head"><span>日期</span><span>平台</span><span>花费</span><span>曝光</span><span>点击</span><span>购买</span><span>ROAS</span></div>
            {rows.map((row) => (
              <div className="report-row" key={`${row.date}-${row.platform}`}>
                <span>{row.date}</span><span>{row.platform}</span><span>{row.spend}</span><span>{row.impressions}</span><span>{row.clicks}</span><span>{row.purchases}</span><strong>{row.roas}</strong>
              </div>
            ))}
          </div>
        </section>

        <aside className="report-side panel">
          <h2>字段与预设</h2>
          <button type="button">近 30 天 Ad 平台效果</button>
          <button type="button">Campaign ROAS 监控</button>
          <button type="button">素材疲劳诊断</button>
          <div className="field-catalog">
            <span>spend</span><span>impressions</span><span>clicks</span><span>purchase_roas</span><span>publisher_platform</span>
          </div>
        </aside>
      </div>
    </StateGate>
  );
}
