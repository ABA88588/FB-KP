"use client";

import { RefreshCcw } from "lucide-react";
import { useState } from "react";
import type { DataState } from "@adflow/shared";
import { cn } from "@adflow/shared";
import type { SyncJob } from "@adflow/meta-client";
import type { ToastKind } from "@/lib/app-types";
import { useDemoContext } from "@/lib/demo-context";
import { useAppRuntime } from "@/lib/app-runtime";
import { Button, DataSourceGate, LiveEmptyState, PageHeader, StateGate, StatusDot } from "@/components/ui";

const tabs = ["同步任务", "API 错误", "数据新鲜度", "审计日志"] as const;

export function SyncCenterPage({
  dataState: providedDataState,
  showToast: providedShowToast
}: {
  dataState?: DataState;
  showToast?: (text: string, kind?: ToastKind) => void;
} = {}) {
  const runtime = useAppRuntime();
  const dataState = providedDataState ?? runtime.dataState;
  const showToast = providedShowToast ?? runtime.showToast;
  const { api, connection, account, accountLabel, dateLabel, touchDemoData } = useDemoContext();
  const [tab, setTab] = useState<(typeof tabs)[number]>("同步任务");
  const [version, setVersion] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState("刚刚");
  const jobs = api.listSyncJobs(account.id);
  const errorJobs = jobs.filter((job) => Boolean(job.error));
  const visibleJobs = tab === "API 错误" ? errorJobs : jobs;
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;
  const detailJob = tab === "API 错误" ? selectedJob?.error ? selectedJob : errorJobs[0] : selectedJob?.error ? selectedJob : null;
  const summary = {
    running: jobs.filter((job) => job.status === "running").length,
    success: jobs.filter((job) => job.status === "success").length,
    queued: jobs.filter((job) => job.status === "queued").length,
    failed: jobs.filter((job) => job.status === "failed" || Boolean(job.error)).length
  };
  void version;

  const enqueueSync = () => {
    if (!connection.canRead) {
      showToast(connection.stateDetail, "warning");
      return;
    }
    const job = api.enqueueSyncJob(account.id);
    setTab("同步任务");
    setSelectedJobId(job.id);
    setVersion((current) => current + 1);
    if (connection.mode === "live") {
      showToast("Live sync adapter skeleton is selected; no Demo sync data was loaded.", "warning");
      return;
    }
    showToast("已新增立即同步任务，进度将在列表中更新", "success");
    [
      { delay: 500, progress: "34%", elapsed: "3s" },
      { delay: 1100, progress: "72%", elapsed: "8s" },
      { delay: 1800, progress: "100%", elapsed: "14s", status: "success" as const }
    ].forEach((step) => {
      window.setTimeout(() => {
        api.updateSyncJob(account.id, job.id, step);
        if ("status" in step && step.status === "success") touchDemoData();
        setVersion((current) => current + 1);
      }, step.delay);
    });
  };

  const checkConnection = () => {
    const checked = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    setCheckedAt(checked);
    showToast(connection.mode === "demo" ? "连接检查已完成：Demo Provider 正常" : connection.stateDetail, connection.canRead ? "success" : "warning");
  };

  return (
    <StateGate state={dataState}>
      <DataSourceGate connection={connection}>
      <PageHeader
        eyebrow="系统状态"
        title="同步与错误"
        description={`${accountLabel} · ${dateLabel} · 最近检查 ${checkedAt}`}
        actions={
          <>
            <Button onClick={checkConnection}>重新检查连接</Button>
            <Button disabled={!connection.canRead} variant="primary" onClick={enqueueSync}><RefreshCcw size={14} /> 立即同步</Button>
          </>
        }
      />

      {connection.mode === "live" && jobs.length === 0 ? (
        <LiveEmptyState title="Live sync data is not available" detail="The Live client adapter returned no sync jobs, so Demo sync fixtures are hidden." />
      ) : (
        <>
      <div className="entity-tabs">
        {tabs.map((item) => (
          <button key={item} className={cn("entity-tab", tab === item && "active")} type="button" onClick={() => setTab(item)}>
            {item} {item === "同步任务" ? <span>{jobs.length}</span> : item === "API 错误" ? <span className="danger-text">{errorJobs.length}</span> : null}
          </button>
        ))}
      </div>

      <section className="panel sync-panel">
        <div className="sync-summary">
          <article><span>运行中</span><strong>{summary.running}</strong></article>
          <article><span>已完成</span><strong>{summary.success}</strong></article>
          <article><span>等待中</span><strong>{summary.queued}</strong></article>
          <article><span>失败</span><strong className="danger-text">{summary.failed}</strong></article>
        </div>
        {tab === "同步任务" || tab === "API 错误" ? <SyncTable jobs={visibleJobs} accountName={account.name} selectedJobId={selectedJobId} onSelect={setSelectedJobId} /> : null}
        {tab === "数据新鲜度" ? <FreshnessPanel /> : null}
        {tab === "审计日志" ? <AuditPanel /> : null}
        {detailJob?.error ? <ErrorDetail job={detailJob} onFocus={() => { setTab("API 错误"); setSelectedJobId(detailJob.id); }} /> : null}
      </section>
        </>
      )}
      </DataSourceGate>
    </StateGate>
  );
}

function SyncTable({ jobs, accountName, selectedJobId, onSelect }: { jobs: SyncJob[]; accountName: string; selectedJobId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="sync-table">
      <div className="sync-row head">
        <span>类型</span><span>广告账户</span><span>状态</span><span>进度</span><span>开始时间</span><span>结束时间</span><span>重试次数</span><span>错误</span><span>requestId</span>
      </div>
      {jobs.map((job) => (
        <button data-testid="sync-job-row" className={cn("sync-row extended", job.status === "failed" && "error-row", selectedJobId === job.id && "selected")} key={job.id} type="button" onClick={() => onSelect(job.id)}>
          <span><strong>{job.type}</strong><small>meta-sync / {job.id}</small></span>
          <span>{accountName}</span>
          <span><StatusDot tone={jobTone(job.status)} />{jobStatusLabel(job.status)}</span>
          <span>{job.status === "running" ? <><div className="mini-progress"><i style={{ width: job.progress }} /></div>{job.progress}</> : job.progress}</span>
          <span>{job.startedAt}</span>
          <span>{job.status === "running" ? "—" : job.elapsed}</span>
          <span>{job.status === "partial" ? "1" : "0"}</span>
          <span>{job.error?.code ?? "—"}</span>
          <span className="mono">{job.requestId}</span>
        </button>
      ))}
    </div>
  );
}

function ErrorDetail({ job, onFocus }: { job: SyncJob; onFocus: () => void }) {
  if (!job.error) return null;
  return (
    <div className="error-detail">
      <div className="error-icon">!</div>
      <div>
        <strong>{job.error.title}</strong>
        <p>{job.error.message}</p>
        <div className="error-meta">
          <span>影响范围：{job.error.impact}</span>
          <span>可重试：{job.error.retryable ? "是" : "否"}</span>
          <span>Meta error code：{job.error.code}</span>
          <span>subcode：{job.error.subcode}</span>
          <span>fbtrace_id：{job.error.fbtraceId}</span>
        </div>
        <p className="error-action">推荐处理：{job.error.action}</p>
      </div>
      <Button size="compact" onClick={onFocus}>查看任务</Button>
    </div>
  );
}

function FreshnessPanel() {
  return (
    <div className="freshness-grid">
      <article><span>对象同步</span><strong>8 分钟前</strong><small>健康</small></article>
      <article><span>Insights</span><strong>6 分钟前</strong><small>健康</small></article>
      <article><span>报表缓存</span><strong>2 小时前</strong><small>部分过期</small></article>
    </div>
  );
}

function AuditPanel() {
  return (
    <div className="audit-list">
      <div><span>今天 09:42</span><strong>系统同步 Campaign 对象</strong><small>requestId req_27bc...</small></div>
      <div><span>今天 09:16</span><strong>王 操作批量暂停，部分失败</strong><small>requestId req_114f...</small></div>
      <div><span>昨天 18:10</span><strong>演示用户保存列视图</strong><small>requestId req_view...</small></div>
    </div>
  );
}

function jobTone(status: SyncJob["status"]): "success" | "warning" | "danger" | "info" {
  if (status === "success") return "success";
  if (status === "running" || status === "queued") return "info";
  if (status === "partial") return "warning";
  return "danger";
}

function jobStatusLabel(status: SyncJob["status"]): string {
  if (status === "running") return "运行中";
  if (status === "success") return "成功";
  if (status === "partial") return "部分失败";
  if (status === "queued") return "等待中";
  return "失败";
}
