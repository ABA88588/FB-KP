"use client";

import { Check, ChevronLeft, ChevronRight, Save, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AdAccount, CreatedAdBundle } from "@adflow/meta-client";
import { Button, ConnectionStateNotice } from "@/components/ui";
import type { ToastKind } from "@/lib/app-types";
import { useDemoContext } from "@/lib/demo-context";
import { useAppRuntime } from "@/lib/app-runtime";
import { writeBlockedMessage, type ClientApiConnection } from "@/lib/client-api-adapter";

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
  { id: "summer", title: "夏季焕亮", file: "summer_glow_hero_01.jpg", meta: "1080 × 1350 · 已在素材库", className: "thumb-1" },
  { id: "serum", title: "新款精华", file: "new_serum_video_15s.mp4", meta: "1080 × 1920 · 已在素材库", className: "thumb-2" },
  { id: "bundle", title: "护理套装", file: "beauty_set_offer.jpg", meta: "1080 × 1350 · 已在素材库", className: "thumb-5" }
] as const;

const previewPlacements = ["Instagram 信息流", "Instagram 快拍", "Facebook 信息流", "Reels"] as const;

function initialDraftForAccount(account: AdAccount): Draft {
  const isUsd = account.currency === "USD";
  return {
    campaignName: isUsd ? "US｜焕亮护理｜销售｜广泛受众" : "KR｜夏季焕亮｜销售｜广泛受众",
    objective: "销售",
    specialCategory: "不属于特殊广告类别",
    budgetMode: "Campaign 预算",
    conversionLocation: "网站",
    event: "Purchase",
    pixel: isUsd ? "Glow US Web Pixel · 7184••••" : "Seoul Beauty Web Pixel · 9342••••",
    budget: isUsd ? "120" : "260000",
    schedule: "2026-06-26 09:00 起 · 持续投放",
    audience: isUsd ? "United States · 25–44 · Women" : "韩国 · 23–45 · Women",
    placement: "Advantage+ 版位",
    attribution: "7-day click or 1-day view",
    page: isUsd ? "Glow US DTC" : "Seoul Beauty Official",
    instagram: isUsd ? "@glowusdtc" : "@seoulbeauty.kr",
    format: "单图或视频",
    primaryText: isUsd ? "Build a bright daily routine with a focused skincare set. Limited-time bundle offer." : "夏日透亮肌，从一套高效护理开始。限时组合优惠，立即查看。",
    title: isUsd ? "Glow Routine Skincare Set" : "夏季焕亮护理组合",
    description: "SKINCARE SET",
    url: isUsd ? "https://glowusdtc.com/summer-glow" : "https://example.com/summer-glow",
    cta: isUsd ? "Shop Now" : "立即购买",
    urlParams: isUsd ? "utm_source=meta&utm_campaign=us_glow" : "utm_source=meta&utm_campaign=summer_glow",
    assetId: "summer",
    previewPlacement: "Instagram 信息流"
  };
}

export function CreateWizard({ showToast: providedShowToast }: { showToast?: (text: string, kind?: ToastKind) => void } = {}) {
  const router = useRouter();
  const runtime = useAppRuntime();
  const showToast = providedShowToast ?? runtime.showToast;
  const { api, connection, account, accountLabel, touchDemoData } = useDemoContext();
  const routePrefix = connection.mode === "demo" ? "/demo" : "";
  const draftStorageKey = useMemo(() => createDraftKey(account.id), [account.id]);
  const [step, setStep] = useState<WizardStep>(1);
  const [draft, setDraft] = useState<Draft>(() => initialDraftForAccount(account));
  const [draftStatus, setDraftStatus] = useState("草稿已保存");
  const [published, setPublished] = useState(false);
  const [publishedIds, setPublishedIds] = useState<CreatedAdBundle | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = Number(params.get("step"));
    if (requested === 1 || requested === 2 || requested === 3 || requested === 4) setStep(requested);
  }, []);

  useEffect(() => {
    const baseDraft = initialDraftForAccount(account);
    const saved = window.localStorage.getItem(draftStorageKey);
    if (saved) {
      try {
        setDraft({ ...baseDraft, ...JSON.parse(saved) as Partial<Draft> });
      } catch {
        window.localStorage.removeItem(draftStorageKey);
        setDraft(baseDraft);
      }
    } else {
      setDraft(baseDraft);
    }
    setPublished(false);
    setPublishedIds(null);
    setDraftStatus("草稿已保存");
  }, [account, draftStorageKey]);

  const canAdvance = useMemo(() => draft.campaignName.trim().length > 0 && draft.url.startsWith("https://"), [draft]);

  const updateDraft = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDraftStatus("有未保存更改");
  };

  const saveDraft = () => {
    setDraftStatus("保存中…");
    window.setTimeout(() => {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
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
      router.replace(`${routePrefix}/campaigns/new?step=${nextStep}`);
      return;
    }
    if (publishedIds) {
      router.push(`${routePrefix}/campaigns?level=campaign&q=${encodeURIComponent(draft.campaignName)}&status=all&minSpend=0`);
      return;
    }
    const asset = creativeAssets.find((item) => item.id === draft.assetId) ?? creativeAssets[0];
    if (!connection.canWrite) {
      showToast(writeBlockedMessage(connection), "warning");
      return;
    }
    const ids = api.createAdBundle(account.id, {
      campaignName: draft.campaignName,
      objective: draft.objective,
      budget: draft.budget,
      audience: draft.audience,
      event: draft.event,
      title: draft.title,
      assetFile: asset.file
    });
    if (!ids.campaignId) {
      showToast("Live write adapter is not connected.", "warning");
      return;
    }
    setPublished(true);
    setPublishedIds(ids);
    touchDemoData();
    window.localStorage.setItem(`adflow.lastPublishedBundle.${account.id}`, JSON.stringify(ids));
    showToast(connection.mode === "demo" ? `模拟发布成功：Campaign ${ids.campaignId}，Ad ${ids.adId} 已写入 DemoProvider` : `Live 发布请求已提交：Campaign ${ids.campaignId}，Ad ${ids.adId}`, "success");
    window.setTimeout(() => router.push(`${routePrefix}/campaigns?level=campaign&q=${encodeURIComponent(draft.campaignName)}&status=all&minSpend=0`), 500);
  };

  const back = () => {
    if (step === 1) {
      router.push(`${routePrefix}/campaigns?level=campaign`);
      return;
    }
    const previous = (step - 1) as WizardStep;
    setStep(previous);
    router.replace(`${routePrefix}/campaigns/new?step=${previous}`);
  };

  return (
    <section className="wizard-screen">
      <header className="wizard-header inline">
        <div>
          <div className="eyebrow">{accountLabel} · 新建广告 · 草稿自动保存</div>
          <h1>创建销售广告</h1>
        </div>
        <div className="draft-state"><Check size={14} /> {draftStatus}</div>
        <button type="button" onClick={() => router.push(`${routePrefix}/campaigns?level=campaign`)} aria-label="关闭向导"><X size={18} /></button>
      </header>

      <WizardStepper step={step} setStep={(nextStep) => { setStep(nextStep); router.replace(`${routePrefix}/campaigns/new?step=${nextStep}`); }} />

      <div className="wizard-body inline">
        {connection.mode === "live" ? (
          <LiveCreateReadiness connection={connection} />
        ) : (
          <>
        <div className="wizard-form">
          <ConnectionStateNotice connection={connection} />
          {step === 1 ? <CampaignStep draft={draft} updateDraft={updateDraft} /> : null}
          {step === 2 ? <AdSetStep draft={draft} updateDraft={updateDraft} /> : null}
          {step === 3 ? <CreativeStep draft={draft} updateDraft={updateDraft} /> : null}
          {step === 4 ? <ReviewStep draft={draft} currency={account.currency} connection={connection} published={published} publishedIds={publishedIds} /> : null}
        </div>
        <AdPreview account={account} draft={draft} updateDraft={updateDraft} />
          </>
        )}
      </div>

      <footer className="wizard-footer inline">
        <Button onClick={back}><ChevronLeft size={14} /> {step === 1 ? "取消" : "上一步"}</Button>
        <div>
          {connection.mode === "live" ? (
            <>
              <Button onClick={() => router.push("/settings/write-controls")}>配置写入条件</Button>
              <Button variant="primary" disabled>发布不可用</Button>
            </>
          ) : (
            <>
              <Button onClick={saveDraft}><Save size={14} /> 保存草稿</Button>
              <Button variant="primary" onClick={next}>
                {step < 4 ? <>下一步 <ChevronRight size={14} /></> : <><Send size={14} /> 模拟发布（不会写入 Meta）</>}
              </Button>
            </>
          )}
        </div>
      </footer>
    </section>
  );
}

function LiveCreateReadiness({ connection }: { connection: ClientApiConnection }) {
  const missing = [
    "Meta App 未配置",
    "Meta 账号未连接或未完成 OAuth 授权",
    "广告账户未加入 allowed account IDs",
    "写入总开关未开启",
    "紧急只读仍处于开启状态",
    "Token 未确认包含 ads_management 权限"
  ];
  return (
    <div className="wizard-live-state">
      <ConnectionStateNotice connection={connection} />
      <section className="state-panel panel warning">
        <strong>真实发布条件尚未满足</strong>
        <span>生产 Live 流程不会执行模拟发布。请完成以下条件后再创建真实 Campaign、Ad Set、Creative 和 Ad，新对象会默认保持已暂停。</span>
        <div className="missing-meta-list">
          {missing.map((item) => (
            <div key={item}><strong>{item}</strong><span>需要在 Meta 配置、连接或写入控制中完成。</span></div>
          ))}
        </div>
      </section>
    </div>
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
          <label>目标<select value={draft.objective} onChange={(event) => updateDraft({ objective: event.target.value })}><option>销售</option><option>潜在客户</option><option>访问量</option></select></label>
          <label>特殊广告类别<select value={draft.specialCategory} onChange={(event) => updateDraft({ specialCategory: event.target.value })}><option>不属于特殊广告类别</option><option>就业</option><option>住房</option><option>信贷</option></select></label>
        </div>
        <label>Campaign 预算模式<select value={draft.budgetMode} onChange={(event) => updateDraft({ budgetMode: event.target.value })}><option>Campaign 预算</option><option>广告组预算</option></select></label>
      </div>
      <div className="form-card">
        <h2>默认状态</h2>
        <label className="radio-card selected"><input type="radio" checked readOnly /><span><strong>已暂停</strong><small>所有对象先创建为暂停状态</small></span></label>
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
          <label>CTA<select value={draft.cta} onChange={(event) => updateDraft({ cta: event.target.value })}><option>立即购买</option><option>了解更多</option><option>注册</option><option>Shop Now</option><option>Learn More</option><option>Sign Up</option></select></label>
        </div>
        <label>URL 参数<input value={draft.urlParams} onChange={(event) => updateDraft({ urlParams: event.target.value })} /></label>
      </div>
    </section>
  );
}

function ReviewStep({ draft, currency, connection, published, publishedIds }: { draft: Draft; currency: AdAccount["currency"]; connection: ClientApiConnection; published: boolean; publishedIds: CreatedAdBundle | null }) {
  return (
    <section className="wizard-pane active">
      <div className={published ? "review-alert published" : "review-alert"}>
        <span><Check size={15} /></span>
        <div>
          <strong>{published ? "演示发布已完成" : "基础检查通过"}</strong>
          <p>{publishedIds ? `Campaign ${publishedIds.campaignId} / Ad ${publishedIds.adId}` : "将创建 1 个广告系列、1 个广告组、1 个 Creative 和 1 个广告，全部为已暂停。"}</p>
        </div>
      </div>
      <ReviewCard title="Campaign" rows={[["名称", draft.campaignName], ["目标", draft.objective], ["特殊广告类别", draft.specialCategory], ["状态", "已暂停"]]} />
      <ReviewCard title="Ad Set" rows={[["转化位置", draft.conversionLocation], ["优化事件", draft.event], ["日预算", formatCurrency(Number(draft.budget), currency)], ["受众", `${draft.audience} · ${draft.placement}`], ["归因窗口", draft.attribution]]} />
      <ReviewCard title="Ad" rows={[["Facebook Page", draft.page], ["Instagram", draft.instagram], ["素材", creativeAssets.find((item) => item.id === draft.assetId)?.file ?? "—"], ["标题", draft.title], ["网站 URL", draft.url], ["CTA", draft.cta]]} />
      <ReviewCard title="发布前检查" rows={[["将创建对象", "4 个"], ["默认状态", "已暂停"], ["权限是否完整", connection.mode === "demo" ? "演示权限完整" : connection.stateLabel], ["阻塞错误", connection.canWrite ? "无" : connection.writeBlockedReason], ["数据模式", connection.mode === "demo" ? "演示数据源，不会写入 Meta" : connection.sourceLabel]]} />
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

function createDraftKey(accountId: string): string {
  return `adflow.createDraft.${accountId}`;
}

function formatCurrency(value: number, currency: AdAccount["currency"]): string {
  const amount = Number.isFinite(value) ? value : 0;
  return `${currency === "USD" ? "$" : "₩"}${Math.round(amount).toLocaleString("en-US")}`;
}

function previewProfile(account: AdAccount, draft: Draft): { identity: string; domain: string; avatar: string } {
  const fallbackDomain = account.currency === "USD" ? "glowusdtc.com" : "example.com";
  const handle = draft.instagram.trim().replace(/^@/, "");
  return {
    identity: handle || draft.page || account.name,
    domain: urlDomain(draft.url) || fallbackDomain,
    avatar: (draft.page || account.name).trim().slice(0, 1).toUpperCase() || "A"
  };
}

function urlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function AdPreview({ account, draft, updateDraft }: { account: AdAccount; draft: Draft; updateDraft: (patch: Partial<Draft>) => void }) {
  const asset = creativeAssets.find((item) => item.id === draft.assetId) ?? creativeAssets[0];
  const profile = previewProfile(account, draft);
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
          <span className="profile-dot">{profile.avatar}</span>
          <div><strong>{profile.identity}</strong><small>赞助内容</small></div>
          <em>⋯</em>
        </div>
        <div className={`preview-image ${asset.className}`}>{asset.title}<small>{draft.description}</small></div>
        <div className="social-copy">
          <div className="social-icons">♡ ○ ↗</div>
          <p><strong>{profile.identity}</strong> {draft.primaryText}</p>
          <div className="cta-row"><span>{profile.domain}</span><strong>{draft.cta} ›</strong></div>
        </div>
      </div>
      <p className="preview-disclaimer">本地布局示意，以 Meta 实际预览和投放展示为准。</p>
    </aside>
  );
}
