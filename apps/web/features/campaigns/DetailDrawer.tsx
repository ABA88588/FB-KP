"use client";

import { Copy, Edit3, MoreHorizontal, X } from "lucide-react";
import { useState } from "react";
import type { CampaignEntity, EntityLevel } from "@adflow/meta-client";
import { Button, StatusBadge, TrendChart } from "@/components/ui";

const tabs = ["概览", "设置", "趋势", "活动"] as const;

export function DetailDrawer({
  entity,
  level,
  readOnly,
  onClose,
  onToast
}: {
  entity: CampaignEntity | null;
  level: EntityLevel;
  readOnly: boolean;
  onClose: () => void;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("概览");
  const levelLabel = level === "campaign" ? "Campaign" : level === "adset" ? "Ad Set" : "Ad";

  return (
    <>
      <div className={`drawer-backdrop ${entity ? "visible" : ""}`} role="presentation" onClick={onClose} />
      <aside className={`inspector-drawer ${entity ? "open" : ""}`} aria-hidden={!entity}>
        {entity ? (
          <>
            <div className="drawer-header">
              <div>
                <StatusBadge status={entity.effective} />
                <h2>{entity.name}</h2>
                <p>{levelLabel} · {entity.id.slice(0, 5)}••••{entity.id.slice(-3)}</p>
              </div>
              <button className="drawer-close" type="button" onClick={onClose} aria-label="关闭详情">
                <X size={18} />
              </button>
            </div>
            <div className="drawer-tabs">
              {tabs.map((item) => (
                <button key={item} className={tab === item ? "active" : ""} type="button" onClick={() => setTab(item)}>
                  {item}
                </button>
              ))}
            </div>
            <div className="drawer-content">
              {tab === "概览" ? <OverviewTab entity={entity} /> : null}
              {tab === "设置" ? <SettingsTab entity={entity} /> : null}
              {tab === "趋势" ? <TrendTab /> : null}
              {tab === "活动" ? <ActivityTab /> : null}
            </div>
            <div className="drawer-footer">
              <Button onClick={() => onToast("已复制演示对象配置")}>
                <Copy size={14} /> 复制
              </Button>
              {!readOnly ? (
                <Button variant="primary" onClick={() => onToast("演示模式：编辑只会修改本地 Demo 数据")}>
                  <Edit3 size={14} /> 编辑设置
                </Button>
              ) : null}
              <Button>
                <MoreHorizontal size={14} /> 更多
              </Button>
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}

function OverviewTab({ entity }: { entity: CampaignEntity }) {
  return (
    <>
      <div className="drawer-metrics">
        <article><span>花费</span><strong>{entity.spend}</strong></article>
        <article><span>购买</span><strong>{entity.purchases}</strong></article>
        <article><span>CPA</span><strong>{entity.cpa}</strong></article>
        <article><span>ROAS</span><strong>{entity.roas}</strong></article>
      </div>
      <section className="drawer-section">
        <h3>投放状态</h3>
        <div className="setting-row"><span>已配置状态</span><strong>{entity.status === "active" ? "ACTIVE" : "PAUSED"}</strong></div>
        <div className="setting-row"><span>有效状态</span><strong className="success-text">{entity.effective}</strong></div>
        <div className="setting-row"><span>最近更新</span><strong>{entity.updated}</strong></div>
      </section>
      <section className="drawer-section">
        <h3>预算与排期</h3>
        <div className="setting-row"><span>预算方式</span><strong>Campaign 日预算</strong></div>
        <div className="setting-row"><span>预算</span><strong>{entity.budget}</strong></div>
        <div className="setting-row"><span>开始时间</span><strong>2026-06-01 00:00 KST</strong></div>
        <div className="setting-row"><span>结束时间</span><strong>持续投放</strong></div>
      </section>
      <section className="drawer-section">
        <h3>近 7 天趋势</h3>
        <TrendChart compact />
      </section>
    </>
  );
}

function SettingsTab({ entity }: { entity: CampaignEntity }) {
  return (
    <section className="drawer-section">
      <h3>对象配置摘要</h3>
      <div className="setting-row"><span>名称</span><strong>{entity.name}</strong></div>
      <div className="setting-row"><span>Meta ID</span><strong>{entity.id}</strong></div>
      <div className="setting-row"><span>默认创建状态</span><strong>PAUSED</strong></div>
      <div className="setting-row"><span>数据来源</span><strong>Demo Provider</strong></div>
    </section>
  );
}

function TrendTab() {
  return (
    <section className="drawer-section">
      <h3>趋势详情</h3>
      <TrendChart compact />
      <div className="setting-row"><span>本周趋势</span><strong className="success-text">花费与转化同步增长</strong></div>
    </section>
  );
}

function ActivityTab() {
  return (
    <section className="drawer-section">
      <h3>活动日志</h3>
      <div className="setting-row"><span>今天 09:42</span><strong>系统同步对象状态</strong></div>
      <div className="setting-row"><span>昨天 18:10</span><strong>演示用户保存视图</strong></div>
      <div className="setting-row"><span>6月23日</span><strong>预算修改进入队列</strong></div>
    </section>
  );
}
