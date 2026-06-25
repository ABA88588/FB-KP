"use client";

import { Upload } from "lucide-react";
import type { ToastKind } from "@/lib/app-types";
import { Button, PageHeader } from "@/components/ui";

export function CreativesPage({ showToast }: { showToast: (text: string, kind?: ToastKind) => void }) {
  return (
    <>
      <PageHeader
        eyebrow="广告账户 / Seoul Beauty KR"
        title="素材中心"
        description="图片、视频和已创建 Creative"
        actions={<Button variant="primary" onClick={() => showToast("演示上传任务已创建", "success")}><Upload size={14} /> 上传素材</Button>}
      />
      <section className="panel creative-panel">
        <div className="table-toolbar">
          <div className="search-box"><input placeholder="搜索素材" /></div>
          <Button size="compact">类型：全部</Button>
          <Button size="compact">最近使用</Button>
        </div>
        <div className="creative-grid">
          {["SUMMER GLOW", "NEW SERUM", "20% OFF", "UGC ROUTINE", "BEAUTY SET"].map((title, index) => (
            <article className="creative-card" key={title}>
              <div className={`creative-thumb thumb-${index + 1}`}><span>{title}</span></div>
              <div className="creative-copy"><strong>{title.toLowerCase().replaceAll(" ", "_")}.jpg</strong><span>1080 × 1350 · Demo</span><span>使用于 {index + 2} 个广告</span></div>
              <button type="button">⋯</button>
            </article>
          ))}
          <article className="creative-card upload-card" onClick={() => showToast("演示上传面板已打开", "info")}>
            <div>+</div><strong>上传新素材</strong><span>JPG、PNG、MP4</span>
          </article>
        </div>
      </section>
    </>
  );
}
