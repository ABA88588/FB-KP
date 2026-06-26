"use client";

import { Copy, Edit3, MoreHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CampaignEntity, EntityLevel } from "@adflow/meta-client";
import { Button, StatusBadge, TrendChart } from "@/components/ui";

const tabs = ["概览", "设置", "趋势", "活动"] as const;
type Currency = "KRW" | "USD";

export function DetailDrawer({
  entity,
  level,
  currency,
  sourceLabel,
  readOnly,
  onClose,
  onSave,
  onToast
}: {
  entity: CampaignEntity | null;
  level: EntityLevel;
  currency: Currency;
  sourceLabel: string;
  readOnly: boolean;
  onClose: () => void;
  onSave: (id: string, input: { name: string; status: "active" | "paused"; budget: string }) => CampaignEntity | null;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("概览");
  const [copied, setCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", status: "paused" as "active" | "paused", budget: "" });
  const levelLabel = level === "campaign" ? "Campaign" : level === "adset" ? "Ad Set" : "Ad";

  useEffect(() => {
    if (!entity) return;
    setEditForm({
      name: entity.name,
      status: entity.status,
      budget: String(Number(entity.budget.replace(/[^\d.-]/g, "")) || 0)
    });
    setEditMode(false);
    setCopied(false);
  }, [entity]);

  const copyEntity = async () => {
    if (!entity) return;
    await navigator.clipboard.writeText(JSON.stringify({
      id: entity.id,
      name: entity.name,
      level,
      status: entity.status,
      budget: entity.budget
    }, null, 2));
    setCopied(true);
    onToast("已复制演示对象配置到剪贴板");
  };

  const saveEdit = () => {
    if (!entity) return;
    if (!editForm.name.trim()) {
      onToast("名称不能为空");
      return;
    }
    const updated = onSave(entity.id, editForm);
    if (updated) {
      setEditForm({ name: updated.name, status: updated.status, budget: String(Number(updated.budget.replace(/[^\d.-]/g, "")) || 0) });
      setEditMode(false);
    }
  };

  const cancelEdit = () => {
    if (!entity) return;
    setEditForm({ name: entity.name, status: entity.status, budget: String(Number(entity.budget.replace(/[^\d.-]/g, "")) || 0) });
    setEditMode(false);
    onToast("已取消编辑");
  };

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
              {tab === "设置" ? <SettingsTab entity={entity} currency={currency} sourceLabel={sourceLabel} editMode={editMode} form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={cancelEdit} /> : null}
              {tab === "趋势" ? <TrendTab /> : null}
              {tab === "活动" ? <ActivityTab /> : null}
            </div>
            <div className="drawer-footer">
              <Button onClick={() => { void copyEntity(); }}>
                <Copy size={14} /> {copied ? "已复制" : "复制"}
              </Button>
              {!readOnly ? (
                <Button variant="primary" onClick={() => { setEditMode(true); setTab("设置"); onToast("已进入演示编辑状态"); }}>
                  <Edit3 size={14} /> {editMode ? "编辑中" : "编辑设置"}
                </Button>
              ) : null}
              <div className="drawer-more">
                <Button onClick={() => setMoreOpen((open) => !open)}>
                  <MoreHorizontal size={14} /> 更多
                </Button>
                {moreOpen ? (
                  <div className="row-action-menu drawer">
                    <button type="button" onClick={() => { setTab("活动"); setMoreOpen(false); }}>查看活动</button>
                    <button type="button" onClick={() => { setTab("趋势"); setMoreOpen(false); }}>查看趋势</button>
                    <button type="button" onClick={() => { setCopied(false); setMoreOpen(false); }}>重置复制状态</button>
                  </div>
                ) : null}
              </div>
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

function SettingsTab({
  entity,
  currency,
  sourceLabel,
  editMode,
  form,
  setForm,
  onSave,
  onCancel
}: {
  entity: CampaignEntity;
  currency: Currency;
  sourceLabel: string;
  editMode: boolean;
  form: { name: string; status: "active" | "paused"; budget: string };
  setForm: (form: { name: string; status: "active" | "paused"; budget: string }) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="drawer-section">
      <h3>对象配置摘要</h3>
      {editMode ? (
        <div className="drawer-edit-form">
          <label>名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>状态<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as "active" | "paused" })}><option value="active">ACTIVE</option><option value="paused">PAUSED</option></select></label>
          <label>日预算 {currency} ({currencySymbol(currency)})<input value={form.budget} inputMode="numeric" onChange={(event) => setForm({ ...form, budget: event.target.value.replace(/\D/g, "") })} /></label>
          <div><Button onClick={onCancel}>取消</Button><Button variant="primary" onClick={onSave}>保存设置</Button></div>
        </div>
      ) : null}
      <div className="setting-row"><span>名称</span><strong>{entity.name}</strong></div>
      <div className="setting-row"><span>Meta ID</span><strong>{entity.id}</strong></div>
      <div className="setting-row"><span>当前状态</span><strong>{entity.status === "active" ? "ACTIVE" : "PAUSED"}</strong></div>
      <div className="setting-row"><span>预算</span><strong>{entity.budget}</strong></div>
      <div className="setting-row"><span>默认创建状态</span><strong>PAUSED</strong></div>
      <div className="setting-row"><span>数据来源</span><strong>{sourceLabel}</strong></div>
    </section>
  );
}

function currencySymbol(currency: Currency): string {
  return currency === "USD" ? "$" : "₩";
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
