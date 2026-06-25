"use client";

import { Check, ChevronLeft, ChevronRight, Save, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import type { ToastKind } from "@/lib/app-types";

type WizardStep = 1 | 2 | 3 | 4;

type Draft = {
  campaignName: string;
  objective: string;
  specialCategory: string;
  budgetMode: string;
  conversionLocation: string;
  event: string;
  pixel: string;
  budget: string;
  schedule: string;
  audience: string;
  placement: string;
  attribution: string;
  page: string;
  instagram: string;
  format: string;
  primaryText: string;
  title: string;
  description: string;
  url: string;
  cta: string;
  urlParams: string;
  assetId: string;
  previewPlacement: string;
};

const creativeAssets = [
  { id: "summer", title: "SUMMER GLOW", file: "summer_glow_hero_01.jpg", meta: "1080 × 1350 · 已在素材库", className: "thumb-1" },
  { id: "serum", title: "NEW SERUM", file: "new_serum_video_15s.mp4", meta: "1080 × 1920 · 已在素材库", className: "thumb-2" },
  { id: "bundle", title: "BEAUTY SET", file: "beauty_set_offer.jpg", meta: "1080 × 1350 · 已在素材库", className: "thumb-5" }
] as const;

const previewPlacements = ["Instagram Feed", "Instagram Story", "Facebook Feed", "Reels"] as const;

const initialDraft: Draft = {
  campaignName: "KR｜Summer Glow｜Sales｜Broad",
  objective: "Sales",
  specialCategory: "不属于特殊广告类别",
  budgetMode: "Campaign 预算",
  conversionLocation: "网站",
  event: "Purchase",
  pixel: "Seoul Beauty Web Pixel · 9342••••",
  budget: "260000",
  schedule: "2026-06-26 09:00 起 · 持续投放",
  audience: "韩国 · 23–45 · Women",
  placement: "Advantage+ 版位",
  attribution: "7-day click or 1-day view",
  page: "Seoul Beauty Official",
  instagram: "@seoulbeauty.kr",
  format: "单图或视频",
  primaryText: "夏日透亮肌，从一套高效护理开始。限时组合优惠，立即查看。",
  title: "Summer Glow 护理组合",
  description: "SKINCARE SET",
  url: "https://example.com/summer-glow",
  cta: "立即购买",
  urlParams: "utm_source=meta&utm_campaign=summer_glow",
  assetId: "summer",
  previewPlacement: "Instagram Feed"
};

export function CreateWizard({ showToast }: { showToast: (text: string, kind?: ToastKind) => void }) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [draftStatus, setDraftStatus] = useState("草稿已保存");
  const [published, setPublished] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = Number(params.get("step"));
    if (requested === 1 || requested === 2 || requested === 3 || requested === 4) setStep(requested);
    const saved = window.localStorage.getItem("adflow.createDraft");
    if (saved) {
      try {
        setDraft({ ...initialDraft, ...JSON.parse(saved) as Partial<Draft> });
      } catch {
        window.localStorage.removeItem("adflow.createDraft");
      }
    }
  }, []);

  const canAdvance = useMemo(() => draft.campaignName.trim().length > 0 && draft.url.startsWith("https://"), [draft]);

  const updateDraft = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDraftStatus("有未保存更改");
  };

  const saveDraft = () => {
    setDraftStatus("保存中…");
    window.setTimeout(() => {
      window.localStorage.setItem("adflow.createDraft", JSON.stringify(draft));
      setDraftStatus("草稿刚刚保存");
      showToast("草稿已保存", "success");
    }, 300);
  };

  const next = () => {
    if (!canAdvance) {
      showToast("请先填写名称，并使用 https 网站 URL", "warning");
      return;
    }
    if (step < 4) {
      const nextStep = (step + 1) as WizardStep;
      setStep(nextStep);
      router.replace(`/campaigns/new?step=${nextStep}`);
      return;
    }
    setPublished(true);
    showToast("模拟发布成功：已创建 4 个演示对象，状态均为 PAUSED", "success");
  };

  const back = () => {
    if (step === 1) {
      router.push("/campaigns?level=campaign");
      return;
    }
    const previous = (step - 1) as WizardStep;
    setStep(previous);
    router.replace(`/campaigns/new?step=${previous}`);
  };

  return (
    <section className="wizard-screen">
      <header className="wizard-header inline">
        <div>
          <div className="eyebrow">新建广告 · 草稿自动保存</div>
          <h1>创建销售广告</h1>
        </div>
        <div className="draft-state"><Check size={14} /> {draftStatus}</div>
        <button type="button" onClick={() => router.push("/campaigns?level=campaign")} aria-label="关闭向导"><X size={18} /></button>
      </header>

      <WizardStepper step={step} setStep={(nextStep) => { setStep(nextStep); router.replace(`/campaigns/new?step=${nextStep}`); }} />

      <div className="wizard-body inline">
        <div className="wizard-form">
          {step === 1 ? <CampaignStep draft={draft} updateDraft={updateDraft} /> : null}
          {step === 2 ? <AdSetStep draft={draft} updateDraft={updateDraft} /> : null}
          {step === 3 ? <CreativeStep draft={draft} updateDraft={updateDraft} /> : null}
          {step === 4 ? <ReviewStep draft={draft} published={published} /> : null}
        </div>
        <AdPreview draft={draft} updateDraft={updateDraft} />
      </div>

      <footer className="wizard-footer inline">
        <Button onClick={back}><ChevronLeft size={14} /> {step === 1 ? "取消" : "上一步"}</Button>
        <div>
          <Button onClick={saveDraft}><Save size={14} /> 保存草稿</Button>
          <Button variant="primary" onClick={next}>
            {step < 4 ? <>下一步 <ChevronRight size={14} /></> : <><Send size={14} /> 模拟发布（不会写入 Meta）</>}
          </Button>
        </div>
      </footer>
    </section>
  );
}

function WizardStepper({ step, setStep }: { step: WizardStep; setStep: (step: WizardStep) => void }) {
  const items: Array<{ step: WizardStep; title: string; sub: string }> = [
    { step: 1, title: "广告系列", sub: "目标与预算方式" },
    { step: 2, title: "广告组", sub: "受众、预算与版位" },
    { step: 3, title: "广告与素材", sub: "身份、文案和预览" },
    { step: 4, title: "审核发布", sub: "检查与确认" }
  ];
  return (
    <div className="wizard-stepper">
      {items.map((item, index) => (
        <div className="stepper-fragment" key={item.step}>
          <button className={`wizard-step ${step === item.step ? "active" : ""} ${step > item.step ? "done" : ""}`} type="button" onClick={() => setStep(item.step)}>
            <span>{step > item.step ? "✓" : item.step}</span>
            <div><strong>{item.title}</strong><small>{item.sub}</small></div>
          </button>
          {index < items.length - 1 ? <i /> : null}
        </div>
      ))}
    </div>
  );
}

function CampaignStep({ draft, updateDraft }: { draft: Draft; updateDraft: (patch: Partial<Draft>) => void }) {
  return (
    <section className="wizard-pane active">
      <div className="form-card">
        <h2>广告系列设置</h2>
        <p>创建后默认保持暂停，确认无误后再启用。</p>
        <label>名称 <em>*</em><input value={draft.campaignName} onChange={(event) => updateDraft({ campaignName: event.target.value })} /></label>
        <div className="form-grid">
          <label>目标<select value={draft.objective} onChange={(event) => updateDraft({ objective: event.target.value })}><option>Sales</option><option>Leads</option><option>Traffic</option></select></label>
          <label>特殊广告类别<select value={draft.specialCategory} onChange={(event) => updateDraft({ specialCategory: event.target.value })}><option>不属于特殊广告类别</option><option>就业</option><option>住房</option><option>信贷</option></select></label>
        </div>
        <label>Campaign 预算模式<select value={draft.budgetMode} onChange={(event) => updateDraft({ budgetMode: event.target.value })}><option>Campaign 预算</option><option>广告组预算</option></select></label>
      </div>
      <div className="form-card">
        <h2>默认状态</h2>
        <label className="radio-card selected"><input type="radio" checked readOnly /><span><strong>PAUSED</strong><small>所有对象先创建为暂停状态</small></span></label>
      </div>
    </section>
  );
}

function AdSetStep({ draft, updateDraft }: { draft: Draft; updateDraft: (patch: Partial<Draft>) => void }) {
  return (
    <section className="wizard-pane active">
      <div className="form-card">
        <h2>转化与优化</h2>
        <div className="form-grid">
          <label>转化位置<select value={draft.conversionLocation} onChange={(event) => updateDraft({ conversionLocation: event.target.value })}><option>网站</option><option>App</option></select></label>
          <label>优化事件<select value={draft.event} onChange={(event) => updateDraft({ event: event.target.value })}><option>Purchase</option><option>Lead</option><option>CompleteRegistration</option></select></label>
        </div>
        <label>Pixel 或数据集<input value={draft.pixel} onChange={(event) => updateDraft({ pixel: event.target.value })} /></label>
      </div>
      <div className="form-card">
        <h2>预算、排期、受众和版位</h2>
        <div className="form-grid">
          <label>预算<input value={draft.budget} onChange={(event) => updateDraft({ budget: event.target.value })} /></label>
          <label>排期<input value={draft.schedule} onChange={(event) => updateDraft({ schedule: event.target.value })} /></label>
        </div>
        <div className="form-grid">
          <label>受众<input value={draft.audience} onChange={(event) => updateDraft({ audience: event.target.value })} /></label>
          <label>版位<select value={draft.placement} onChange={(event) => updateDraft({ placement: event.target.value })}><option>Advantage+ 版位</option><option>手动版位</option></select></label>
        </div>
        <label>归因窗口<select value={draft.attribution} onChange={(event) => updateDraft({ attribution: event.target.value })}><option>7-day click or 1-day view</option><option>1-day click</option></select></label>
      </div>
    </section>
  );
}

function CreativeStep({ draft, updateDraft }: { draft: Draft; updateDraft: (patch: Partial<Draft>) => void }) {
  const [assetOpen, setAssetOpen] = useState(false);
  const asset = creativeAssets.find((item) => item.id === draft.assetId) ?? creativeAssets[0];
  return (
    <section className="wizard-pane active">
      <div className="form-card">
        <h2>身份与素材</h2>
        <div className="form-grid">
          <label>Facebook Page<input value={draft.page} onChange={(event) => updateDraft({ page: event.target.value })} /></label>
          <label>Instagram 账号<input value={draft.instagram} onChange={(event) => updateDraft({ instagram: event.target.value })} /></label>
        </div>
        <label>单图或视频<select value={draft.format} onChange={(event) => updateDraft({ format: event.target.value })}><option>单图或视频</option><option>视频</option></select></label>
        <div className="asset-picker-wrap">
          <button className="asset-picker" type="button" onClick={() => setAssetOpen((open) => !open)}>
            <span className={`asset-preview ${asset.className}`}>{asset.title}</span>
            <span><strong>{asset.file}</strong><small>{asset.meta}</small></span>
            <em>更换</em>
          </button>
          {assetOpen ? (
            <div className="asset-menu">
              {creativeAssets.map((item) => (
                <button key={item.id} type="button" className={draft.assetId === item.id ? "active" : ""} onClick={() => { updateDraft({ assetId: item.id }); setAssetOpen(false); }}>
                  <span className={`asset-preview ${item.className}`}>{item.title}</span>
                  <strong>{item.file}</strong>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="form-card">
        <h2>文案与链接</h2>
        <label>主文案<textarea value={draft.primaryText} onChange={(event) => updateDraft({ primaryText: event.target.value })} /></label>
        <label>标题<input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} /></label>
        <label>描述<input value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} /></label>
        <div className="form-grid">
          <label>网站 URL<input value={draft.url} onChange={(event) => updateDraft({ url: event.target.value })} /></label>
          <label>CTA<select value={draft.cta} onChange={(event) => updateDraft({ cta: event.target.value })}><option>立即购买</option><option>了解更多</option><option>注册</option></select></label>
        </div>
        <label>URL 参数<input value={draft.urlParams} onChange={(event) => updateDraft({ urlParams: event.target.value })} /></label>
      </div>
    </section>
  );
}

function ReviewStep({ draft, published }: { draft: Draft; published: boolean }) {
  return (
    <section className="wizard-pane active">
      <div className={published ? "review-alert published" : "review-alert"}>
        <span><Check size={15} /></span>
        <div>
          <strong>{published ? "演示发布已完成" : "基础检查通过"}</strong>
          <p>将创建 1 个 Campaign、1 个 Ad Set、1 个 Creative 和 1 个 Ad，全部为 PAUSED。</p>
        </div>
      </div>
      <ReviewCard title="Campaign" rows={[["名称", draft.campaignName], ["目标", draft.objective], ["特殊广告类别", draft.specialCategory], ["状态", "PAUSED"]]} />
      <ReviewCard title="Ad Set" rows={[["转化位置", draft.conversionLocation], ["优化事件", draft.event], ["日预算", `₩${Number(draft.budget).toLocaleString("en-US")}`], ["受众", `${draft.audience} · ${draft.placement}`], ["归因窗口", draft.attribution]]} />
      <ReviewCard title="Ad" rows={[["Facebook Page", draft.page], ["Instagram", draft.instagram], ["素材", creativeAssets.find((item) => item.id === draft.assetId)?.file ?? "—"], ["标题", draft.title], ["网站 URL", draft.url], ["CTA", draft.cta]]} />
      <ReviewCard title="发布前检查" rows={[["将创建对象", "4 个"], ["默认状态", "PAUSED"], ["权限是否完整", "演示权限完整"], ["阻塞错误", "无"], ["数据模式", "Demo Provider，不会写入 Meta"]]} />
    </section>
  );
}

function ReviewCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="review-card">
      <h2>{title}</h2>
      {rows.map(([label, value]) => (
        <div key={label}><span>{label}</span><strong>{value}</strong></div>
      ))}
    </div>
  );
}

function AdPreview({ draft, updateDraft }: { draft: Draft; updateDraft: (patch: Partial<Draft>) => void }) {
  const asset = creativeAssets.find((item) => item.id === draft.assetId) ?? creativeAssets[0];
  const placementIndex = previewPlacements.findIndex((item) => item === draft.previewPlacement);
  const nextPlacement = () => {
    const next = previewPlacements[(placementIndex + 1) % previewPlacements.length] ?? previewPlacements[0];
    updateDraft({ previewPlacement: next });
  };
  return (
    <aside className="wizard-preview">
      <div className="preview-heading">
        <div><strong>广告预览</strong><span>{draft.previewPlacement}</span></div>
        <button type="button" onClick={nextPlacement}>切换版位</button>
      </div>
      <div className={`phone-preview ${draft.previewPlacement.toLowerCase().replaceAll(" ", "-")}`}>
        <div className="social-head">
          <span className="profile-dot">S</span>
          <div><strong>seoulbeauty.kr</strong><small>赞助内容</small></div>
          <em>⋯</em>
        </div>
        <div className={`preview-image ${asset.className}`}>{asset.title}<small>{draft.description}</small></div>
        <div className="social-copy">
          <div className="social-icons">♡ ○ ↗</div>
          <p><strong>seoulbeauty.kr</strong> {draft.primaryText}</p>
          <div className="cta-row"><span>example.com</span><strong>{draft.cta} ›</strong></div>
        </div>
      </div>
      <p className="preview-disclaimer">本地布局示意，以 Meta 实际预览和投放展示为准。</p>
    </aside>
  );
}
