"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { demoProvider, type CreativeAsset } from "@adflow/meta-client";
import type { ToastKind } from "@/lib/app-types";
import { Button, PageHeader } from "@/components/ui";
import { useAppRuntime } from "@/lib/app-runtime";
import { useDemoContext } from "@/lib/demo-context";

type CreativeType = "全部" | CreativeAsset["type"];

export function CreativesPage({ showToast: providedShowToast }: { showToast?: (text: string, kind?: ToastKind) => void } = {}) {
  const runtime = useAppRuntime();
  const showToast = providedShowToast ?? runtime.showToast;
  const { account, accountLabel, revision, touchDemoData } = useDemoContext();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<CreativeType>("全部");
  const [recentFirst, setRecentFirst] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const visibleAssets = useMemo(() => (
    demoProvider
      .listCreatives(account.id, query, type)
      .sort((a, b) => recentFirst ? a.recent - b.recent : b.usage - a.usage)
  ), [account.id, query, recentFirst, revision, type]);

  const cycleType = () => {
    setType((current) => current === "全部" ? "图片" : current === "图片" ? "视频" : "全部");
  };

  const uploadDemoAsset = () => {
    demoProvider.createCreative(account.id);
    touchDemoData();
    showToast("演示模式：已新增本地素材记录，不会上传到 Meta", "success");
  };

  const duplicateAsset = (asset: CreativeAsset) => {
    demoProvider.duplicateCreative(account.id, asset.id);
    touchDemoData();
    setOpenMenuId(null);
    showToast("已复制素材到本地演示列表", "success");
  };

  const archiveAsset = (id: string) => {
    demoProvider.archiveCreative(account.id, id);
    touchDemoData();
    setOpenMenuId(null);
    showToast("已从演示列表归档该素材", "success");
  };

  return (
    <>
      <PageHeader
        eyebrow={accountLabel}
        title="素材中心"
        description="图片、视频和已创建 Creative"
        actions={<Button variant="primary" onClick={uploadDemoAsset}><Upload size={14} /> 上传素材</Button>}
      />
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
                    <button type="button" onClick={() => duplicateAsset(asset)}>复制素材</button>
                    <button type="button" onClick={() => archiveAsset(asset.id)}>归档素材</button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
          <button className="creative-card upload-card" type="button" onClick={uploadDemoAsset}>
            <div>+</div><strong>上传新素材</strong><span>JPG、PNG、MP4</span>
          </button>
        </div>
      </section>
    </>
  );
}
