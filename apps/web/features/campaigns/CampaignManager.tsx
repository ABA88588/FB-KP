"use client";

import { ChevronDown, Columns3, Download, Filter, MoreHorizontal, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DataState } from "@adflow/shared";
import { cn } from "@adflow/shared";
import { demoProvider, type CampaignEntity, type EntityLevel } from "@adflow/meta-client";
import type { ToastKind } from "@/lib/app-types";
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
  const [level, setLevel] = useState<EntityLevel>("campaign");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(defaultColumns);
  const [columnOpen, setColumnOpen] = useState(false);
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [drawerEntity, setDrawerEntity] = useState<CampaignEntity | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [pageIndex, setPageIndex] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("level");
    if (requested === "adset" || requested === "ad" || requested === "campaign") {
      setLevel(requested);
    }
    const saved = window.localStorage.getItem("adflow.savedColumns");
    if (saved) {
      const parsed = saved.split(",").filter((item): item is ColumnId => item in columnLabels);
      if (parsed.length > 0) setVisibleColumns(parsed);
    }
  }, []);

  const rows = useMemo(() => {
    const filtered = demoProvider
      .listEntities(level, query)
      .filter((row) => statusFilter === "all" || row.status === statusFilter);
    const sorted = [...filtered].sort((a, b) => parseMoney(a.spend) - parseMoney(b.spend));
    return sortDirection === "desc" ? sorted.reverse() : sorted;
  }, [level, query, statusFilter, sortDirection]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);
  const selectedCount = selectedIds.size;
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));

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
    setSelectedIds(new Set());
    setConfirm(null);
    showToast(`演示模式已${status === "active" ? "启用" : "暂停"} ${ids.length} 项，本地数据已更新`, "success");
  };

  return (
    <StateGate state={dataState}>
      <PageHeader
        eyebrow="广告账户 / Seoul Beauty KR"
        title="广告管理"
        description="对象更新于 8 分钟前 · Insights 更新于 6 分钟前"
        actions={
          <>
            <Button onClick={() => showToast("草稿导入入口已打开", "info")}>导入草稿</Button>
            <Button variant="primary" onClick={() => router.push("/campaigns/new?step=1")}><Plus size={14} /> 新建广告</Button>
          </>
        }
      />

      <div className="entity-tabs" role="tablist">
        <LevelTab active={level === "campaign"} label="广告系列" count="12" onClick={() => changeLevel("campaign")} />
        <LevelTab active={level === "adset"} label="广告组" count="28" onClick={() => changeLevel("adset")} />
        <LevelTab active={level === "ad"} label="广告" count="42" onClick={() => changeLevel("ad")} />
      </div>

      <section className="table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={15} />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPageIndex(1); }} placeholder="搜索名称或 Meta ID" type="search" />
          </div>
          <Button size="compact" onClick={() => showToast("筛选条件已打开：状态 + 花费", "info")}><Filter size={14} /> 筛选 <span className="filter-count">2</span></Button>
          <Button size="compact" onClick={() => setStatusFilter((current) => current === "all" ? "active" : current === "active" ? "paused" : "all")}>
            状态：{statusFilter === "all" ? "全部" : statusFilter === "active" ? "投放中" : "已暂停"} <ChevronDown size={13} />
          </Button>
          <Button size="compact" onClick={() => { window.localStorage.setItem("adflow.savedColumns", visibleColumns.join(",")); showToast("当前列配置已保存为演示视图", "success"); }}>
            保存视图
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
          <Button variant="ghost" size="compact" onClick={() => showToast("CSV 已导出（演示数据）", "success")}><Download size={14} /> 导出</Button>
          <Button variant="ghost" size="compact"><MoreHorizontal size={15} /></Button>
        </div>

        <div className="filter-chips">
          <span className="filter-chip">有效状态 = 投放中 <button type="button" onClick={() => setStatusFilter("all")}>×</button></span>
          <span className="filter-chip">花费 &gt; ₩100,000 <button type="button">×</button></span>
          <button className="clear-filters" type="button" onClick={() => { setQuery(""); setStatusFilter("all"); }}>清除全部</button>
        </div>

        {selectedCount > 0 ? (
          <div className="bulk-bar visible">
            <strong>已选择 {selectedCount} 项</strong>
            <button type="button" onClick={() => setConfirm({ type: "bulk", ids: [...selectedIds], status: "active", title: `启用 ${selectedCount} 项` })}>启用</button>
            <button type="button" onClick={() => setConfirm({ type: "bulk", ids: [...selectedIds], status: "paused", title: `暂停 ${selectedCount} 项` })}>暂停</button>
            <button type="button" onClick={() => showToast("预算修改确认已打开：演示模式仅更新本地数据", "info")}>修改预算</button>
            <button type="button" onClick={() => showToast(`已复制 ${selectedCount} 项到演示草稿`, "success")}>复制</button>
            <button type="button">更多 <ChevronDown size={12} /></button>
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
                <tr key={row.id} className={selectedIds.has(row.id) ? "selected" : ""} onClick={() => setDrawerEntity(row)}>
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
                  <td className="more-col" onClick={(event) => event.stopPropagation()}><button className="row-more" type="button">⋯</button></td>
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

      <DetailDrawer entity={drawerEntity} level={level} readOnly={dataState === "permission-denied" || dataState === "connection-expired"} onClose={() => setDrawerEntity(null)} onToast={(message) => showToast(message, "info")} />
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
