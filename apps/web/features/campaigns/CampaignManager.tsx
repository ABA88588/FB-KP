"use client";

import { ChevronDown, Columns3, Download, Filter, MoreHorizontal, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DataState } from "@adflow/shared";
import { cn, rowsToCsv } from "@adflow/shared";
import { demoProvider, type CampaignEntity, type EntityLevel } from "@adflow/meta-client";
import type { ToastKind } from "@/lib/app-types";
import { useDemoContext } from "@/lib/demo-context";
import { Button, ConfirmDialog, PageHeader, StateGate, StatusBadge } from "@/components/ui";
import { DetailDrawer } from "./DetailDrawer";

type ColumnId = "budget" | "spend" | "purchases" | "cpa" | "value" | "roas" | "impressions" | "ctr" | "cpc" | "updated";

const columnLabels: Record<ColumnId, string> = {
  budget: "预算",
  spend: "花费",
  purchases: "结果",
  cpa: "每次结果成本",
  value: "转化价值",
  roas: "ROAS",
  impressions: "曝光",
  ctr: "CTR",
  cpc: "CPC",
  updated: "更新时间"
};

const defaultColumns: ColumnId[] = ["budget", "spend", "purchases", "cpa", "value", "roas", "impressions", "ctr", "cpc", "updated"];

type ConfirmState =
  | { type: "single"; ids: string[]; status: "active" | "paused"; title: string }
  | { type: "bulk"; ids: string[]; status: "active" | "paused"; title: string }
  | null;

export function CampaignManager({
  dataState,
  showToast
}: {
  dataState: DataState;
  showToast: (text: string, kind?: ToastKind) => void;
}) {
  const router = useRouter();
  const { accountLabel, dateLabel, queryContext, revision, touchDemoData } = useDemoContext();
  const [level, setLevel] = useState<EntityLevel>("campaign");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("active");
  const [minSpend, setMinSpend] = useState("100000");
  const [warningOnly, setWarningOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(defaultColumns);
  const [columnOpen, setColumnOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [topMoreOpen, setTopMoreOpen] = useState(false);
  const [bulkMoreOpen, setBulkMoreOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [drawerEntity, setDrawerEntity] = useState<CampaignEntity | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [budgetDialog, setBudgetDialog] = useState<{ ids: string[]; amount: string } | null>(null);
  const [pageIndex, setPageIndex] = useState(1);
  const [dataVersion, setDataVersion] = useState(0);
  const [viewSavedAt, setViewSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("level");
    const requestedQuery = params.get("q");
    const requestedStatus = params.get("status");
    const requestedMin = params.get("minSpend");
    const savedView = loadSavedView();
    if (requested === "adset" || requested === "ad" || requested === "campaign") {
      setLevel(requested);
    } else if (savedView?.level) {
      setLevel(savedView.level);
    }
    if (savedView) {
      setQuery(savedView.query);
      setStatusFilter(savedView.statusFilter);
      setMinSpend(savedView.minSpend);
      setWarningOnly(savedView.warningOnly);
      setSortDirection(savedView.sortDirection);
      if (savedView.visibleColumns.length > 0) setVisibleColumns(savedView.visibleColumns);
      setViewSavedAt(savedView.savedAt);
    }
    if (requestedQuery) setQuery(requestedQuery);
    if (requestedStatus === "all" || requestedStatus === "active" || requestedStatus === "paused") setStatusFilter(requestedStatus);
    if (requestedMin !== null) setMinSpend(requestedMin);
    if (savedView) return;
    const savedColumns = window.localStorage.getItem("adflow.savedColumns");
    if (savedColumns) {
      const parsed = savedColumns.split(",").filter((item): item is ColumnId => item in columnLabels);
      if (parsed.length > 0) setVisibleColumns(parsed);
    }
  }, []);

  const rows = useMemo(() => {
    const minSpendValue = Number(minSpend || 0);
    const filtered = demoProvider
      .listEntities(level, query, queryContext)
      .filter((row) => statusFilter === "all" || row.status === statusFilter)
      .filter((row) => !minSpendValue || parseMoney(row.spend) >= minSpendValue)
      .filter((row) => !warningOnly || Boolean(row.warning));
    const sorted = [...filtered].sort((a, b) => parseMoney(a.spend) - parseMoney(b.spend));
    return sortDirection === "desc" ? sorted.reverse() : sorted;
  }, [dataVersion, level, minSpend, query, queryContext, revision, statusFilter, sortDirection, warningOnly]);

  const counts = useMemo(() => ({
    campaign: demoProvider.listEntities("campaign", "", queryContext).length,
    adset: demoProvider.listEntities("adset", "", queryContext).length,
    ad: demoProvider.listEntities("ad", "", queryContext).length
  }), [dataVersion, queryContext, revision]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);
  const selectedCount = selectedIds.size;
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));
  const activeFilterCount = [statusFilter !== "all", Number(minSpend || 0) > 0, warningOnly].filter(Boolean).length;

  useEffect(() => {
    if (pageIndex > totalPages) setPageIndex(totalPages);
  }, [pageIndex, totalPages]);

  const changeLevel = (next: EntityLevel) => {
    setLevel(next);
    setSelectedIds(new Set());
    setPageIndex(1);
    router.replace(`/campaigns?level=${next}`);
  };

  const toggleSelected = (id: string, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runStatusChange = (ids: string[], status: "active" | "paused") => {
    demoProvider.updateStatus(level, ids, status);
    setDataVersion((version) => version + 1);
    touchDemoData();
    setSelectedIds(new Set());
    setConfirm(null);
    showToast(`演示模式已${status === "active" ? "启用" : "暂停"} ${ids.length} 项，本地数据已更新`, "success");
  };

  const openBudgetDialog = (ids: string[]) => {
    const first = rows.find((row) => ids.includes(row.id));
    const current = first ? parseMoney(first.budget) || 100000 : 100000;
    setBudgetDialog({ ids, amount: String(current) });
    setBulkMoreOpen(false);
    setRowMenuId(null);
  };

  const applyBudget = () => {
    if (!budgetDialog) return;
    const amount = Number(budgetDialog.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("请输入有效的日预算金额", "warning");
      return;
    }
    demoProvider.updateBudget(level, budgetDialog.ids, Math.round(amount));
    setDataVersion((version) => version + 1);
    touchDemoData();
    setSelectedIds(new Set());
    setBudgetDialog(null);
    showToast(`已更新 ${budgetDialog.ids.length} 项预算，本地 Demo 数据已变化`, "success");
  };

  const duplicateRows = (ids: string[]) => {
    const copies = demoProvider.duplicateEntities(level, ids);
    setDataVersion((version) => version + 1);
    touchDemoData();
    setSelectedIds(new Set(copies.map((row) => row.id)));
    setBulkMoreOpen(false);
    setRowMenuId(null);
    setPageIndex(1);
    showToast(`已创建 ${copies.length} 个演示副本，默认暂停`, "success");
  };

  const markRows = (ids: string[], warning: boolean) => {
    demoProvider.markEntities(level, ids, warning);
    setDataVersion((version) => version + 1);
    touchDemoData();
    setBulkMoreOpen(false);
    setRowMenuId(null);
    showToast(warning ? "已标记为待检查" : "已取消待检查标记", "success");
  };

  const touchRows = (ids: string[]) => {
    demoProvider.touchEntities(level, ids);
    setDataVersion((version) => version + 1);
    touchDemoData();
    setBulkMoreOpen(false);
    setRowMenuId(null);
    showToast("已把更新时间设为刚刚", "success");
  };

  const saveView = () => {
    const savedAt = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    window.localStorage.setItem("adflow.campaignView", JSON.stringify({
      level,
      query,
      statusFilter,
      minSpend,
      warningOnly,
      sortDirection,
      visibleColumns,
      savedAt
    }));
    window.localStorage.setItem("adflow.savedColumns", visibleColumns.join(","));
    setViewSavedAt(savedAt);
    showToast("当前层级、筛选、排序和列配置已保存", "success");
  };

  const restoreSavedView = () => {
    const savedView = loadSavedView();
    if (!savedView) {
      showToast("暂无已保存视图", "warning");
      return;
    }
    setLevel(savedView.level);
    setQuery(savedView.query);
    setStatusFilter(savedView.statusFilter);
    setMinSpend(savedView.minSpend);
    setWarningOnly(savedView.warningOnly);
    setSortDirection(savedView.sortDirection);
    setVisibleColumns(savedView.visibleColumns);
    setViewSavedAt(savedView.savedAt);
    setPageIndex(1);
    router.replace(`/campaigns?level=${savedView.level}`);
    setTopMoreOpen(false);
    showToast("已恢复保存的演示视图", "success");
  };

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setMinSpend("");
    setWarningOnly(false);
    setPageIndex(1);
  };

  const exportCsv = () => {
    const csvRows = [
      ["层级", "ID", "名称", "配置状态", "投放状态", ...visibleColumns.map((column) => columnLabels[column])],
      ...rows.map((row) => [
        levelLabel(level),
        row.id,
        row.name,
        row.status === "active" ? "ACTIVE" : "PAUSED",
        row.effective,
        ...visibleColumns.map((column) => row[column])
      ])
    ];
    const blob = new Blob([`\ufeff${rowsToCsv(csvRows)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `adflow-${level}-filtered.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(`已下载 ${rows.length} 行 Campaign CSV`, "success");
  };

  const saveEntity = (id: string, input: { name: string; status: "active" | "paused"; budget: string }) => {
    const updated = demoProvider.updateEntity(level, id, input);
    if (!updated) {
      showToast("未找到对象，无法保存", "danger");
      return null;
    }
    setDataVersion((version) => version + 1);
    touchDemoData();
    const [contextRow] = demoProvider.listEntities(level, updated.name, queryContext).filter((row) => row.id === id);
    setDrawerEntity(contextRow ?? updated);
    showToast("设置已保存，本地 Demo 数据已更新", "success");
    return contextRow ?? updated;
  };

  return (
    <StateGate state={dataState}>
      <PageHeader
        eyebrow={accountLabel}
        title="广告管理"
        description={`${dateLabel} · 对象更新于 8 分钟前 · Insights 更新于 6 分钟前`}
        actions={
          <>
            <Button onClick={() => router.push("/campaigns/new?step=1&source=import")}>导入草稿</Button>
            <Button variant="primary" onClick={() => router.push("/campaigns/new?step=1")}><Plus size={14} /> 新建广告</Button>
          </>
        }
      />

      <div className="entity-tabs" role="tablist">
        <LevelTab active={level === "campaign"} label="广告系列" count={String(counts.campaign)} onClick={() => changeLevel("campaign")} />
        <LevelTab active={level === "adset"} label="广告组" count={String(counts.adset)} onClick={() => changeLevel("adset")} />
        <LevelTab active={level === "ad"} label="广告" count={String(counts.ad)} onClick={() => changeLevel("ad")} />
      </div>

      <section className="table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={15} />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPageIndex(1); }} placeholder="搜索名称或 Meta ID" type="search" />
          </div>
          <div className="filter-menu-wrap">
            <Button size="compact" onClick={() => setFilterOpen((open) => !open)}><Filter size={14} /> 筛选 <span className="filter-count">{activeFilterCount}</span></Button>
            {filterOpen ? (
              <div className="filter-popover">
                <label>最低花费<input value={minSpend} inputMode="numeric" onChange={(event) => { setMinSpend(event.target.value.replace(/\D/g, "")); setPageIndex(1); }} placeholder="100000" /></label>
                <label className="check-row"><input checked={warningOnly} type="checkbox" onChange={(event) => { setWarningOnly(event.target.checked); setPageIndex(1); }} />只看待检查</label>
                <div className="popover-actions">
                  <Button size="compact" onClick={() => setFilterOpen(false)}>应用</Button>
                  <Button size="compact" variant="ghost" onClick={clearFilters}>重置</Button>
                </div>
              </div>
            ) : null}
          </div>
          <Button size="compact" onClick={() => { setStatusFilter((current) => current === "all" ? "active" : current === "active" ? "paused" : "all"); setPageIndex(1); }}>
            状态：{statusFilter === "all" ? "全部" : statusFilter === "active" ? "投放中" : "已暂停"} <ChevronDown size={13} />
          </Button>
          <Button size="compact" onClick={saveView}>
            {viewSavedAt ? `保存视图 · ${viewSavedAt}` : "保存视图"}
          </Button>
          <div className="toolbar-spacer" />
          <div className="column-manager">
            <Button variant="ghost" size="compact" onClick={() => setColumnOpen((open) => !open)}><Columns3 size={14} /> 列</Button>
            {columnOpen ? (
              <div className="column-popover">
                {defaultColumns.map((column) => (
                  <label key={column}>
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(column)}
                      onChange={(event) => setVisibleColumns((current) => event.target.checked ? [...current, column] : current.filter((item) => item !== column))}
                    />
                    {columnLabels[column]}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <Button variant="ghost" size="compact" onClick={exportCsv}><Download size={14} /> 导出</Button>
          <div className="more-menu-wrap">
            <Button variant="ghost" size="compact" onClick={() => setTopMoreOpen((open) => !open)}><MoreHorizontal size={15} /></Button>
            {topMoreOpen ? (
              <div className="row-action-menu toolbar">
                <button type="button" onClick={restoreSavedView}>恢复保存视图</button>
                <button type="button" onClick={() => { setWarningOnly(true); setTopMoreOpen(false); }}>只看待检查</button>
                <button type="button" onClick={() => { clearFilters(); setTopMoreOpen(false); }}>清除筛选</button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="filter-chips">
          {query ? <span className="filter-chip">搜索 = {query} <button type="button" onClick={() => setQuery("")}>×</button></span> : null}
          {statusFilter !== "all" ? <span className="filter-chip">有效状态 = {statusFilter === "active" ? "投放中" : "已暂停"} <button type="button" onClick={() => setStatusFilter("all")}>×</button></span> : null}
          {Number(minSpend || 0) > 0 ? <span className="filter-chip">花费 ≥ ₩{Number(minSpend).toLocaleString("en-US")} <button type="button" onClick={() => setMinSpend("")}>×</button></span> : null}
          {warningOnly ? <span className="filter-chip">只看待检查 <button type="button" onClick={() => setWarningOnly(false)}>×</button></span> : null}
          {!query && statusFilter === "all" && !Number(minSpend || 0) && !warningOnly ? <span className="filter-chip muted">当前无筛选条件</span> : null}
          <button className="clear-filters" type="button" onClick={clearFilters}>清除全部</button>
        </div>

        {selectedCount > 0 ? (
          <div className="bulk-bar visible">
            <strong>已选择 {selectedCount} 项</strong>
            <button type="button" onClick={() => setConfirm({ type: "bulk", ids: [...selectedIds], status: "active", title: `启用 ${selectedCount} 项` })}>启用</button>
            <button type="button" onClick={() => setConfirm({ type: "bulk", ids: [...selectedIds], status: "paused", title: `暂停 ${selectedCount} 项` })}>暂停</button>
            <button type="button" onClick={() => openBudgetDialog([...selectedIds])}>修改预算</button>
            <button type="button" onClick={() => duplicateRows([...selectedIds])}>复制</button>
            <div className="bulk-more">
              <button type="button" onClick={() => setBulkMoreOpen((open) => !open)}>更多 <ChevronDown size={12} /></button>
              {bulkMoreOpen ? (
                <div className="row-action-menu bulk">
                  <button type="button" onClick={() => markRows([...selectedIds], true)}>标记待检查</button>
                  <button type="button" onClick={() => markRows([...selectedIds], false)}>取消待检查</button>
                  <button type="button" onClick={() => touchRows([...selectedIds])}>更新时间设为刚刚</button>
                </div>
              ) : null}
            </div>
            <span />
            <button type="button" onClick={() => setSelectedIds(new Set())}>取消选择</button>
          </div>
        ) : null}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="check-col">
                  <input
                    aria-label="全选"
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={(event) => {
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        pageRows.forEach((row) => event.target.checked ? next.add(row.id) : next.delete(row.id));
                        return next;
                      });
                    }}
                  />
                </th>
                <th className="switch-col">开关</th>
                <th className="name-col">{level === "campaign" ? "广告系列" : level === "adset" ? "广告组" : "广告"}</th>
                <th>投放状态</th>
                {visibleColumns.map((column) => (
                  <th key={column} className={column === "spend" ? "num sorted" : numericColumn(column) ? "num" : ""}>
                    <button className="header-sort" type="button" onClick={() => column === "spend" ? setSortDirection((dir) => dir === "desc" ? "asc" : "desc") : undefined}>
                      {columnLabels[column]} {column === "spend" ? (sortDirection === "desc" ? "↓" : "↑") : ""}
                    </button>
                  </th>
                ))}
                <th className="more-col" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => (
                <tr data-testid="campaign-row" key={row.id} className={selectedIds.has(row.id) ? "selected" : ""} onClick={() => setDrawerEntity(row)}>
                  <td className="check-col" onClick={(event) => event.stopPropagation()}>
                    <input aria-label={`选择 ${row.name}`} checked={selectedIds.has(row.id)} type="checkbox" onChange={(event) => toggleSelected(row.id, event.target.checked)} />
                  </td>
                  <td className="switch-col" onClick={(event) => event.stopPropagation()}>
                    <button
                      className={cn("switch", row.status === "active" && "on")}
                      type="button"
                      aria-label={`切换 ${row.name} 状态`}
                      onClick={() => setConfirm({ type: "single", ids: [row.id], status: row.status === "active" ? "paused" : "active", title: `${row.status === "active" ? "暂停" : "启用"} ${row.name}` })}
                    />
                  </td>
                  <td className="name-col">
                    <div className="entity-name">
                      <span className="entity-avatar">{String((pageIndex - 1) * pageSize + index + 1).padStart(2, "0")}</span>
                      <span><strong>{row.name}</strong><small>{levelLabel(level)} · {row.id.slice(0, 5)}••••{row.id.slice(-3)}</small></span>
                    </div>
                  </td>
                  <td><StatusBadge status={row.effective} /></td>
                  {visibleColumns.map((column) => (
                    <td key={column} className={numericColumn(column) ? cn("num", column === "roas" && roasClass(row.roas)) : ""}>{row[column]}</td>
                  ))}
                  <td className="more-col" onClick={(event) => event.stopPropagation()}>
                    <div className="row-menu-wrap">
                      <button className="row-more" type="button" onClick={() => setRowMenuId((current) => current === row.id ? null : row.id)}>⋯</button>
                      {rowMenuId === row.id ? (
                        <div className="row-action-menu">
                          <button type="button" onClick={() => openBudgetDialog([row.id])}>修改预算</button>
                          <button type="button" onClick={() => duplicateRows([row.id])}>复制</button>
                          <button type="button" onClick={() => markRows([row.id], !row.warning)}>{row.warning ? "取消待检查" : "标记待检查"}</button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>显示 {(pageIndex - 1) * pageSize + 1}–{Math.min(pageIndex * pageSize, rows.length)}，共 {rows.length} 项</span>
          <div>
            <button type="button" disabled={pageIndex === 1} onClick={() => setPageIndex((page) => Math.max(1, page - 1))}>‹</button>
            {Array.from({ length: totalPages }, (_, index) => (
              <button key={index + 1} className={pageIndex === index + 1 ? "active" : ""} type="button" onClick={() => setPageIndex(index + 1)}>{index + 1}</button>
            ))}
            <button type="button" disabled={pageIndex === totalPages} onClick={() => setPageIndex((page) => Math.min(totalPages, page + 1))}>›</button>
          </div>
        </div>
      </section>

      <DetailDrawer entity={drawerEntity} level={level} readOnly={dataState === "permission-denied" || dataState === "connection-expired"} onClose={() => setDrawerEntity(null)} onSave={saveEntity} onToast={(message) => showToast(message, "info")} />
      <BudgetDialog
        open={Boolean(budgetDialog)}
        amount={budgetDialog?.amount ?? ""}
        count={budgetDialog?.ids.length ?? 0}
        onAmountChange={(amount) => setBudgetDialog((current) => current ? { ...current, amount } : current)}
        onClose={() => setBudgetDialog(null)}
        onConfirm={applyBudget}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        description={`将影响 ${confirm?.ids.length ?? 0} 个对象。演示模式只修改本地 Demo 数据，不会写入 Meta。`}
        confirmLabel={confirm?.status === "active" ? "确认启用" : "确认暂停"}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm ? runStatusChange(confirm.ids, confirm.status) : undefined}
      />
    </StateGate>
  );
}

type SavedCampaignView = {
  level: EntityLevel;
  query: string;
  statusFilter: "all" | "active" | "paused";
  minSpend: string;
  warningOnly: boolean;
  sortDirection: "desc" | "asc";
  visibleColumns: ColumnId[];
  savedAt: string;
};

function loadSavedView(): SavedCampaignView | null {
  const raw = window.localStorage.getItem("adflow.campaignView");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedCampaignView>;
    const level = parsed.level === "adset" || parsed.level === "ad" || parsed.level === "campaign" ? parsed.level : "campaign";
    const statusFilter = parsed.statusFilter === "active" || parsed.statusFilter === "paused" || parsed.statusFilter === "all" ? parsed.statusFilter : "all";
    const sortDirection = parsed.sortDirection === "asc" ? "asc" : "desc";
    const visibleColumns = Array.isArray(parsed.visibleColumns)
      ? parsed.visibleColumns.filter((item): item is ColumnId => typeof item === "string" && item in columnLabels)
      : defaultColumns;
    return {
      level,
      query: parsed.query ?? "",
      statusFilter,
      minSpend: parsed.minSpend ?? "",
      warningOnly: Boolean(parsed.warningOnly),
      sortDirection,
      visibleColumns,
      savedAt: parsed.savedAt ?? "已保存"
    };
  } catch {
    window.localStorage.removeItem("adflow.campaignView");
    return null;
  }
}

function BudgetDialog({
  open,
  amount,
  count,
  onAmountChange,
  onClose,
  onConfirm
}: {
  open: boolean;
  amount: string;
  count: number;
  onAmountChange: (amount: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section className="confirm-dialog budget-dialog" role="dialog" aria-modal="true" aria-label="修改预算" onClick={(event) => event.stopPropagation()}>
        <h2>修改预算</h2>
        <p>将更新 {count} 个对象的本地 Demo 日预算，不会写入 Meta。</p>
        <label>日预算 KRW<input value={amount} inputMode="numeric" onChange={(event) => onAmountChange(event.target.value.replace(/\D/g, ""))} /></label>
        <div className="dialog-actions">
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={onConfirm}>保存预算</Button>
        </div>
      </section>
    </div>
  );
}

function LevelTab({ active, label, count, onClick }: { active: boolean; label: string; count: string; onClick: () => void }) {
  return (
    <button className={cn("entity-tab", active && "active")} type="button" role="tab" aria-selected={active} onClick={onClick}>
      {label} <span>{count}</span>
    </button>
  );
}

function parseMoney(value: string): number {
  const numeric = value.replace(/[^\d.-]/g, "");
  return Number(numeric || 0);
}

function numericColumn(column: ColumnId): boolean {
  return column !== "updated";
}

function roasClass(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return numeric < 1.5 ? "roas-low" : "roas-good";
}

function levelLabel(level: EntityLevel): string {
  if (level === "campaign") return "Campaign";
  if (level === "adset") return "Ad Set";
  return "Ad";
}
