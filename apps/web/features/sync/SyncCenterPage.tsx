"use client";

import { RefreshCcw } from "lucide-react";
import { useState } from "react";
import type { DataState } from "@adflow/shared";
import { cn } from "@adflow/shared";
import { demoProvider, type SyncJob } from "@adflow/meta-client";
import type { ToastKind } from "@/lib/app-types";
import { Button, PageHeader, StateGate, StatusDot } from "@/components/ui";

const tabs = ["同步任务", "API 错误", "数据新鲜度", "审计日志"] as const;

export function SyncCenterPage({
  dataState,
  showToast
}: {
  dataState: DataState;
  showToast: (text: string, kind?: ToastKind) => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("同步任务");
  const jobs = demoProvider.listSyncJobs();
  const failed = jobs.find((job) => job.status === "failed");

  return (
    <StateGate state={dataState}>
      <PageHeader
        eyebrow="系统状态"
        title="同步与错误"
        description="跟踪后台任务、API 错误和数据新鲜度"
        actions={
          <>
            <Button onClick={() => showToast("连接检查已完成：Demo Provider 正常", "success")}>重新检查连接</Button>
            <Button variant="primary" onClick={() => showToast("同步任务已排队，页面不会阻塞", "success")}><RefreshCcw size={14} /> 立即同步</Button>
          </>
        }
      />

      <div className="entity-tabs">
        {tabs.map((item) => (
          <button key={item} className={cn("entity-tab", tab === item && "active")} type="button" onClick={() => setTab(item)}>
            {item} {item === "同步任务" ? <span>8</span> : item === "API 错误" ? <span className="danger-text">2</span> : null}
          </button>
        ))}
      </div>

      <section className="panel sync-panel">
        <div className="sync-summary">
          <article><span>运行中</span><strong>1</strong></article>
          <article><span>已完成</span><strong>37</strong></article>
          <article><span>等待中</span><strong>1</strong></article>
          <article><span>失败</span><strong className="danger-text">2</strong></article>
        </div>
        {tab === "同步任务" || tab === "API 错误" ? <SyncTable jobs={jobs} /> : null}
        {tab === "数据新鲜度" ? <FreshnessPanel /> : null}
        {tab === "审计日志" ? <AuditPanel /> : null}
        {failed?.error ? <ErrorDetail job={failed} /> : null}
      </section>
    </StateGate>
  );
}

function SyncTable({ jobs }: { jobs: SyncJob[] }) {
  return (
    <div className="sync-table">
      <div className="sync-row head">
        <span>类型</span><span>广告账户</span><span>状态</span><span>进度</span><span>开始时间</span><span>结束时间</span><span>重试次数</span><span>错误</span><span>requestId</span>
      </div>
      {jobs.map((job) => (
        <div className={cn("sync-row extended", job.status === "failed" && "error-row")} key={job.id}>
          <span><strong>{job.type}</strong><small>meta-sync / {job.id}</small></span>
          <span>Seoul Beauty KR</span>
          <span><StatusDot tone={jobTone(job.status)} />{job.status === "running" ? "运行中" : job.status === "success" ? "成功" : job.status === "partial" ? "部分失败" : "失败"}</span>
          <span>{job.status === "running" ? <><div className="mini-progress"><i style={{ width: job.progress }} /></div>{job.progress}</> : job.progress}</span>
          <span>{job.startedAt}</span>
          <span>{job.status === "running" ? "—" : job.elapsed}</span>
          <span>{job.status === "partial" ? "1" : "0"}</span>
          <span>{job.error?.code ?? "—"}</span>
          <span className="mono">{job.requestId}</span>
        </div>
      ))}
    </div>
  );
}

function ErrorDetail({ job }: { job: SyncJob }) {
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
      <Button size="compact">查看任务</Button>
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
