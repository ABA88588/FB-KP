"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import type { CreativeAsset } from "@adflow/meta-client";
import type { ToastKind } from "@/lib/app-types";
import { Button, DataSourceGate, DisabledReason, LiveEmptyState, PageHeader } from "@/components/ui";
import { useAppRuntime } from "@/lib/app-runtime";
import { useDemoContext } from "@/lib/demo-context";
import { writeBlockedMessage } from "@/lib/client-api-adapter";

type CreativeType = "全部" | CreativeAsset["type"];

export function CreativesPage({ showToast: providedShowToast }: { showToast?: (text: string, kind?: ToastKind) => void } = {}) {
  const runtime = useAppRuntime();
  const showToast = providedShowToast ?? runtime.showToast;
  const { api, connection, account, accountLabel, revision, touchDemoData } = useDemoContext();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<CreativeType>("全部");
  const [recentFirst, setRecentFirst] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const visibleAssets = useMemo(() => (
    api
      .listCreatives(account.id, query, type)
      .sort((a, b) => recentFirst ? a.recent - b.recent : b.usage - a.usage)
  ), [account.id, api, query, recentFirst, revision, type]);
  const hasLiveAssets = !(connection.mode === "live" && visibleAssets.length === 0);

  const cycleType = () => {
    setType((current) => current === "全部" ? "图片" : current === "图片" ? "视频" : "全部");
  };

  const uploadDemoAsset = () => {
    if (!connection.canWrite) {
      showToast(writeBlockedMessage(connection), "warning");
      return;
    }
    const created = api.createCreative(account.id);
    if (!created) {
      showToast("Live creative write adapter is not connected.", "warning");
      return;
    }
    touchDemoData();
    showToast("演示模式：已新增本地素材记录，不会上传到 Meta", "success");
  };

  const duplicateAsset = (asset: CreativeAsset) => {
    if (!connection.canWrite) {
      showToast(writeBlockedMessage(connection), "warning");
      return;
    }
    const copy = api.duplicateCreative(account.id, asset.id);
    if (!copy) {
      showToast("Live creative write adapter is not connected.", "warning");
      return;
    }
    touchDemoData();
    setOpenMenuId(null);
    showToast("已复制素材到本地演示列表", "success");
  };

  const archiveAsset = (id: string) => {
    if (!connection.canWrite) {
      showToast(writeBlockedMessage(connection), "warning");
      return;
    }
    api.archiveCreative(account.id, id);
    touchDemoData();
    setOpenMenuId(null);
    showToast("已从演示列表归档该素材", "success");
  };

  return (
    <>
      <PageHeader
        eyebrow={accountLabel}
        title="素材中心"
        description={connection.mode === "live" && !hasLiveAssets ? "等待同步真实 Meta Creative、图片、视频和使用情况" : "图片、视频和已创建 Creative"}
        actions={<Button disabled={!connection.canWrite} variant="primary" onClick={uploadDemoAsset}><Upload size={14} /> 上传素材</Button>}
      />
      <DataSourceGate connection={connection}>
      {!hasLiveAssets ? (
        <LiveEmptyState
          title="暂无真实素材"
          detail="同步后将展示 Meta Creative、图片、视频和使用情况。未连接或写入关闭时，上传素材不可用。"
          requirements={<DisabledReason>{connection.canWrite ? "可以上传素材" : connection.canRead ? "写入当前关闭" : "需要先配置 Meta App 并连接 Meta 账号"}</DisabledReason>}
          actions={
            <>
              <Button variant="primary" disabled={!connection.canRead} title={!connection.canRead ? "请先完成 Meta 授权" : undefined} onClick={() => showToast(connection.canRead ? "已提交同步素材任务。" : connection.stateDetail, connection.canRead ? "success" : "warning")}>同步素材</Button>
              <Button disabled={!connection.canWrite} title={!connection.canWrite ? "写入当前关闭" : undefined} onClick={uploadDemoAsset}>上传素材</Button>
              <Button variant="ghost" onClick={() => window.location.assign("/ads/demo/creatives")}>查看演示沙箱</Button>
            </>
          }
        />
      ) : (
      <section className="panel creative-panel">
        <div className="table-toolbar">
          <div className="search-box"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索素材" /></div>
          <Button size="compact" onClick={cycleType}>类型：{type}</Button>
          <Button size="compact" onClick={() => setRecentFirst((current) => !current)}>{recentFirst ? "最近使用" : "使用次数"}</Button>
        </div>
        <div className="creative-grid">
          {visibleAssets.map((asset) => (
            <article className="creative-card" data-testid="creative-card" key={asset.id}>
              <div className={`creative-thumb thumb-${asset.thumb}`}><span>{asset.title}</span></div>
              <div className="creative-copy"><strong>{asset.file}</strong><span>1080 × 1350 · Demo · {asset.type}</span><span>使用于 {asset.usage} 个广告</span></div>
              <div className="creative-menu-wrap">
                <button type="button" onClick={() => setOpenMenuId((current) => current === asset.id ? null : asset.id)}>⋯</button>
                {openMenuId === asset.id ? (
                  <div className="row-action-menu creative">
                    <button type="button" disabled={!connection.canWrite} onClick={() => duplicateAsset(asset)}>复制素材</button>
                    <button type="button" disabled={!connection.canWrite} onClick={() => archiveAsset(asset.id)}>归档素材</button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
          <button className="creative-card upload-card" type="button" disabled={!connection.canWrite} onClick={uploadDemoAsset}>
            <div>+</div><strong>上传新素材</strong><span>JPG、PNG、MP4</span>
          </button>
        </div>
      </section>
      )}
      </DataSourceGate>
    </>
  );
}
