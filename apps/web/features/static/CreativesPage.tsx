"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import type { ToastKind } from "@/lib/app-types";
import { Button, PageHeader } from "@/components/ui";

type CreativeType = "全部" | "图片" | "视频";

type CreativeAsset = {
  id: string;
  title: string;
  file: string;
  type: Exclude<CreativeType, "全部">;
  usage: number;
  recent: number;
  thumb: number;
};

const initialAssets: CreativeAsset[] = [
  { id: "asset-1", title: "SUMMER GLOW", file: "summer_glow.jpg", type: "图片", usage: 2, recent: 5, thumb: 1 },
  { id: "asset-2", title: "NEW SERUM", file: "new_serum.mp4", type: "视频", usage: 3, recent: 4, thumb: 2 },
  { id: "asset-3", title: "20% OFF", file: "20_off.jpg", type: "图片", usage: 4, recent: 3, thumb: 3 },
  { id: "asset-4", title: "UGC ROUTINE", file: "ugc_routine.jpg", type: "图片", usage: 5, recent: 2, thumb: 4 },
  { id: "asset-5", title: "BEAUTY SET", file: "beauty_set.jpg", type: "图片", usage: 6, recent: 1, thumb: 5 }
];

export function CreativesPage({ showToast }: { showToast: (text: string, kind?: ToastKind) => void }) {
  const [assets, setAssets] = useState(initialAssets);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<CreativeType>("全部");
  const [recentFirst, setRecentFirst] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return assets
      .filter((asset) => type === "全部" || asset.type === type)
      .filter((asset) => `${asset.title} ${asset.file}`.toLowerCase().includes(normalized))
      .sort((a, b) => recentFirst ? a.recent - b.recent : b.usage - a.usage);
  }, [assets, query, recentFirst, type]);

  const cycleType = () => {
    setType((current) => current === "全部" ? "图片" : current === "图片" ? "视频" : "全部");
  };

  const uploadDemoAsset = () => {
    const nextIndex = assets.length + 1;
    const next: CreativeAsset = {
      id: `asset-demo-${nextIndex}`,
      title: `DEMO ASSET ${nextIndex}`,
      file: `demo_asset_${nextIndex}.jpg`,
      type: "图片",
      usage: 0,
      recent: 0,
      thumb: ((nextIndex - 1) % 5) + 1
    };
    setAssets((current) => [next, ...current.map((asset) => ({ ...asset, recent: asset.recent + 1 }))]);
    showToast("演示模式：已新增本地素材记录，不会上传到 Meta", "success");
  };

  const duplicateAsset = (asset: CreativeAsset) => {
    setAssets((current) => [{ ...asset, id: `${asset.id}-copy`, title: `${asset.title} COPY`, file: asset.file.replace(".", "_copy.") }, ...current]);
    setOpenMenuId(null);
    showToast("已复制素材到本地演示列表", "success");
  };

  const archiveAsset = (id: string) => {
    setAssets((current) => current.filter((asset) => asset.id !== id));
    setOpenMenuId(null);
    showToast("已从演示列表归档该素材", "success");
  };

  return (
    <>
      <PageHeader
        eyebrow="广告账户 / Seoul Beauty KR"
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
            <article className="creative-card" key={asset.id}>
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
