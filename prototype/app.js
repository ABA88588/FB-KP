const campaignData = {
  campaign: [
    { id: '23840001912', name: 'Summer Glow｜转化', status: 'active', effective: '投放中', budget: '₩260,000 / 日', spend: '₩1,284,000', purchases: '122', cpa: '₩10,525', value: '₩4,930,100', roas: '3.84', impressions: '438,206', ctr: '2.88%', cpc: '₩246', updated: '今天 09:42' },
    { id: '23840001923', name: 'Retargeting｜7D', status: 'active', effective: '投放中', budget: '₩190,000 / 日', spend: '₩968,400', purchases: '88', cpa: '₩11,005', value: '₩3,205,400', roas: '3.31', impressions: '286,410', ctr: '3.42%', cpc: '₩222', updated: '今天 09:38' },
    { id: '23840001937', name: 'New Serum｜Broad', status: 'active', effective: '投放中', budget: '₩170,000 / 日', spend: '₩842,700', purchases: '61', cpa: '₩13,815', value: '₩2,073,200', roas: '2.46', impressions: '312,645', ctr: '2.51%', cpc: '₩268', updated: '今天 08:54' },
    { id: '23840001944', name: 'IG Reels｜Awareness', status: 'paused', effective: '已暂停', budget: '₩150,000 / 日', spend: '₩694,900', purchases: '32', cpa: '₩21,716', value: '₩1,195,200', roas: '1.72', impressions: '401,208', ctr: '1.94%', cpc: '₩311', updated: '昨天 18:10' },
    { id: '23840001958', name: 'Beauty Bundle｜Test', status: 'active', effective: '学习受限', budget: '₩120,000 / 日', spend: '₩511,600', purchases: '18', cpa: '₩28,422', value: '₩593,500', roas: '1.16', impressions: '164,402', ctr: '1.62%', cpc: '₩356', updated: '今天 07:21', warning: true },
    { id: '23840001967', name: 'Lookalike｜Purchasers 3%', status: 'active', effective: '投放中', budget: '₩110,000 / 日', spend: '₩286,300', purchases: '24', cpa: '₩11,929', value: '₩797,400', roas: '2.79', impressions: '94,811', ctr: '2.73%', cpc: '₩251', updated: '今天 06:48' },
    { id: '23840001972', name: 'Skincare Routine｜Video', status: 'paused', effective: '广告组已暂停', budget: '₩90,000 / 日', spend: '₩142,800', purchases: '7', cpa: '₩20,400', value: '₩218,100', roas: '1.53', impressions: '68,240', ctr: '1.88%', cpc: '₩297', updated: '6月23日' },
    { id: '23840001986', name: 'Existing Customer｜Cross-sell', status: 'active', effective: '投放中', budget: '₩85,000 / 日', spend: '₩78,900', purchases: '12', cpa: '₩6,575', value: '₩316,800', roas: '4.02', impressions: '28,930', ctr: '4.16%', cpc: '₩191', updated: '今天 08:02' },
    { id: '23840001995', name: 'Brand Search｜Always-on', status: 'active', effective: '投放中', budget: '₩60,000 / 日', spend: '₩12,000', purchases: '3', cpa: '₩4,000', value: '₩67,200', roas: '5.60', impressions: '4,512', ctr: '5.21%', cpc: '₩137', updated: '今天 09:02' },
    { id: '23840002002', name: 'Creative Test｜June 04', status: 'paused', effective: '已暂停', budget: '₩50,000 / 日', spend: '₩0', purchases: '—', cpa: '—', value: '—', roas: '—', impressions: '—', ctr: '—', cpc: '—', updated: '6月22日' }
  ],
  adset: [
    { id: '23841001101', name: 'Broad｜KR｜23–45', status: 'active', effective: '投放中', budget: '₩150,000 / 日', spend: '₩728,400', purchases: '71', cpa: '₩10,259', value: '₩2,774,300', roas: '3.81', impressions: '246,118', ctr: '2.92%', cpc: '₩243', updated: '今天 09:41' },
    { id: '23841001102', name: 'Interest｜K-Beauty', status: 'active', effective: '投放中', budget: '₩110,000 / 日', spend: '₩555,600', purchases: '51', cpa: '₩10,894', value: '₩2,155,800', roas: '3.88', impressions: '192,088', ctr: '2.83%', cpc: '₩250', updated: '今天 09:40' },
    { id: '23841001120', name: 'Website Visitors｜7D', status: 'active', effective: '投放中', budget: '₩100,000 / 日', spend: '₩508,200', purchases: '49', cpa: '₩10,371', value: '₩1,824,100', roas: '3.59', impressions: '141,208', ctr: '3.62%', cpc: '₩218', updated: '今天 09:36' },
    { id: '23841001121', name: 'Add to Cart｜14D', status: 'active', effective: '投放中', budget: '₩90,000 / 日', spend: '₩460,200', purchases: '39', cpa: '₩11,800', value: '₩1,381,300', roas: '3.00', impressions: '145,202', ctr: '3.21%', cpc: '₩236', updated: '今天 09:35' },
    { id: '23841001135', name: 'Broad｜New Serum', status: 'active', effective: '学习中', budget: '₩170,000 / 日', spend: '₩842,700', purchases: '61', cpa: '₩13,815', value: '₩2,073,200', roas: '2.46', impressions: '312,645', ctr: '2.51%', cpc: '₩268', updated: '今天 08:54', warning: true },
    { id: '23841001142', name: 'Reels｜Women 18–34', status: 'paused', effective: '已暂停', budget: '₩150,000 / 日', spend: '₩694,900', purchases: '32', cpa: '₩21,716', value: '₩1,195,200', roas: '1.72', impressions: '401,208', ctr: '1.94%', cpc: '₩311', updated: '昨天 18:10' }
  ],
  ad: [
    { id: '23842001401', name: 'UGC｜Routine｜V3', status: 'active', effective: '投放中', budget: '广告组预算', spend: '₩438,200', purchases: '46', cpa: '₩9,526', value: '₩1,841,400', roas: '4.20', impressions: '139,550', ctr: '3.18%', cpc: '₩232', updated: '今天 09:40' },
    { id: '23842001402', name: 'Static｜Summer Glow｜01', status: 'active', effective: '投放中', budget: '广告组预算', spend: '₩390,200', purchases: '37', cpa: '₩10,546', value: '₩1,420,500', roas: '3.64', impressions: '128,248', ctr: '2.79%', cpc: '₩248', updated: '今天 09:39' },
    { id: '23842001408', name: 'Static｜Summer Glow｜02', status: 'active', effective: '投放中', budget: '广告组预算', spend: '₩284,600', purchases: '24', cpa: '₩11,858', value: '₩952,200', roas: '3.35', impressions: '104,112', ctr: '2.49%', cpc: '₩270', updated: '今天 09:35' },
    { id: '23842001416', name: 'Video｜Serum Demo｜15s', status: 'active', effective: '学习中', budget: '广告组预算', spend: '₩441,900', purchases: '34', cpa: '₩12,997', value: '₩1,123,700', roas: '2.54', impressions: '161,890', ctr: '2.57%', cpc: '₩264', updated: '今天 08:50', warning: true },
    { id: '23842001417', name: 'Static｜Serum Benefit｜A', status: 'active', effective: '投放中', budget: '广告组预算', spend: '₩400,800', purchases: '27', cpa: '₩14,844', value: '₩949,500', roas: '2.37', impressions: '150,755', ctr: '2.44%', cpc: '₩271', updated: '今天 08:48' },
    { id: '23842001430', name: 'Reels｜UGC 03', status: 'paused', effective: '已暂停', budget: '广告组预算', spend: '₩318,600', purchases: '12', cpa: '₩26,550', value: '₩475,800', roas: '1.49', impressions: '191,040', ctr: '1.71%', cpc: '₩326', updated: '昨天 18:09' }
  ]
};

let currentLevel = 'campaign';
let selectedIds = new Set();
let wizardStep = 1;
let toastTimer;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function setPage(page, updateHash = true) {
  $$('.page').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  if (updateHash) history.replaceState(null, '', `#${page}`);
  window.scrollTo(0, 0);
}

function routeFromHash() {
  const page = location.hash.replace('#', '') || 'overview';
  if ($(`#page-${page}`)) setPage(page, false);
}

function renderCampaigns() {
  const tbody = $('#campaign-table-body');
  const query = ($('#campaign-search')?.value || '').trim().toLowerCase();
  const rows = campaignData[currentLevel].filter(row => `${row.name} ${row.id}`.toLowerCase().includes(query));
  const levelLabel = currentLevel === 'campaign' ? 'Campaign' : currentLevel === 'adset' ? 'Ad Set' : 'Ad';
  const nameHeader = $('.data-table .name-col');
  if (nameHeader) nameHeader.textContent = currentLevel === 'campaign' ? '广告系列' : currentLevel === 'adset' ? '广告组' : '广告';

  tbody.innerHTML = rows.map((row, index) => {
    const selected = selectedIds.has(row.id);
    const roasClass = row.roas === '—' ? '' : Number(row.roas) < 1.5 ? 'roas-low' : 'roas-good';
    const statusBadge = row.warning
      ? `<span class="status-badge warning"><i class="status-dot warning"></i>${row.effective}</span>`
      : row.status === 'active'
        ? `<span class="status-badge active"><i class="status-dot success"></i>${row.effective}</span>`
        : `<span class="status-badge paused"><i class="status-dot muted"></i>${row.effective}</span>`;
    return `
      <tr data-id="${row.id}" class="${selected ? 'selected' : ''}">
        <td class="check-col"><input class="row-check" type="checkbox" aria-label="选择 ${row.name}" ${selected ? 'checked' : ''}></td>
        <td class="switch-col"><button class="switch ${row.status === 'active' ? 'on' : ''}" type="button" aria-label="切换 ${row.name} 状态"></button></td>
        <td class="name-col"><div class="entity-name"><span class="entity-avatar">${String(index + 1).padStart(2, '0')}</span><span><strong>${row.name}</strong><small>${levelLabel} · ${row.id.slice(0, 5)}••••${row.id.slice(-3)}</small></span></div></td>
        <td>${statusBadge}</td>
        <td class="num">${row.budget}</td>
        <td class="num"><strong>${row.spend}</strong></td>
        <td class="num">${row.purchases}</td>
        <td class="num">${row.cpa}</td>
        <td class="num">${row.value}</td>
        <td class="num ${roasClass}">${row.roas}</td>
        <td class="num">${row.impressions}</td>
        <td class="num">${row.ctr}</td>
        <td class="num">${row.cpc}</td>
        <td>${row.updated}</td>
        <td class="more-col"><button class="row-more" type="button" aria-label="更多">⋯</button></td>
      </tr>`;
  }).join('');

  $$('.row-check', tbody).forEach(check => {
    check.addEventListener('change', event => {
      const row = event.target.closest('tr');
      if (event.target.checked) selectedIds.add(row.dataset.id); else selectedIds.delete(row.dataset.id);
      row.classList.toggle('selected', event.target.checked);
      updateBulkBar();
    });
  });

  $$('.switch', tbody).forEach(toggle => {
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      const row = event.target.closest('tr');
      const data = campaignData[currentLevel].find(item => item.id === row.dataset.id);
      const next = data.status === 'active' ? '暂停' : '启用';
      showToast(`${next}操作需要确认；原型未向 Meta 发送请求`);
      toggle.classList.toggle('on');
    });
  });

  $$('tr[data-id]', tbody).forEach(row => {
    row.addEventListener('click', event => {
      if (event.target.closest('input, button')) return;
      const data = campaignData[currentLevel].find(item => item.id === row.dataset.id);
      openDrawer(data);
    });
  });
}

function updateBulkBar() {
  $('#selected-count').textContent = selectedIds.size;
  $('#bulk-bar').classList.toggle('visible', selectedIds.size > 0);
  const allRows = $$('.row-check');
  $('#select-all').checked = allRows.length > 0 && allRows.every(el => el.checked);
  $('#select-all').indeterminate = selectedIds.size > 0 && !$('#select-all').checked;
}

function openDrawer(data) {
  $('#drawer-title').textContent = data.name;
  $('#drawer-meta').textContent = `${currentLevel === 'campaign' ? 'Campaign' : currentLevel === 'adset' ? 'Ad Set' : 'Ad'} · ${data.id.slice(0, 5)}••••${data.id.slice(-3)}`;
  $('#drawer-spend').textContent = data.spend;
  $('#drawer-purchases').textContent = data.purchases;
  $('#drawer-cpa').textContent = data.cpa;
  $('#drawer-roas').textContent = data.roas;
  const status = $('#drawer-status');
  status.textContent = data.effective;
  status.className = `badge ${data.status === 'active' && !data.warning ? 'success' : ''}`;
  $('#inspector-drawer').classList.add('open');
  $('#inspector-drawer').setAttribute('aria-hidden', 'false');
  $('#drawer-backdrop').classList.add('visible');
}

function closeDrawer() {
  $('#inspector-drawer').classList.remove('open');
  $('#inspector-drawer').setAttribute('aria-hidden', 'true');
  $('#drawer-backdrop').classList.remove('visible');
}

function openWizard(step = 1) {
  wizardStep = Number(step) || 1;
  updateWizard();
  $('#wizard-modal').classList.add('open');
  $('#wizard-modal').setAttribute('aria-hidden', 'false');
  $('#wizard-backdrop').classList.add('visible');
}

function closeWizard() {
  $('#wizard-modal').classList.remove('open');
  $('#wizard-modal').setAttribute('aria-hidden', 'true');
  $('#wizard-backdrop').classList.remove('visible');
  const url = new URL(location.href);
  url.searchParams.delete('wizard');
  history.replaceState(null, '', `${url.pathname}${url.search}${location.hash}`);
}

function updateWizard() {
  $$('.wizard-pane').forEach(pane => pane.classList.toggle('active', Number(pane.dataset.pane) === wizardStep));
  $$('.wizard-step').forEach(step => {
    const n = Number(step.dataset.step);
    step.classList.toggle('active', n === wizardStep);
    step.classList.toggle('done', n < wizardStep);
    step.querySelector('span').textContent = n < wizardStep ? '✓' : n;
  });
  const back = $('#wizard-back');
  const next = $('#wizard-next');
  back.textContent = wizardStep === 1 ? '取消' : '← 上一步';
  next.textContent = wizardStep === 1 ? '下一步：广告组 →' : wizardStep === 2 ? '下一步：广告与素材 →' : wizardStep === 3 ? '下一步：审核发布 →' : '模拟发布（不会写入 Meta）';
}

function runReportDemo() {
  const wrapper = $('#report-progress');
  const title = wrapper.querySelector('span');
  const percent = wrapper.querySelector('strong');
  const bar = wrapper.querySelector('.progress-track i');
  const note = wrapper.querySelector('small');
  let value = 0;
  title.textContent = '排队中';
  percent.textContent = '0%';
  bar.style.width = '0%';
  note.textContent = '正在创建异步报表任务…';
  const timer = setInterval(() => {
    value += 17;
    if (value >= 100) {
      value = 100;
      clearInterval(timer);
      title.textContent = '异步报表已完成';
      note.textContent = '640 行 · 刚刚生成';
      showToast('报表完成，可导出 CSV');
    } else if (value < 35) {
      title.textContent = 'Meta 正在生成报表';
      note.textContent = '页面轮询内部任务，不直接轮询 Meta';
    } else if (value < 75) {
      title.textContent = '正在下载分页结果';
      note.textContent = '已保存 cursor checkpoint';
    } else {
      title.textContent = '正在写入本地报表';
      note.textContent = '正在校验行和汇总数据';
    }
    percent.textContent = `${value}%`;
    bar.style.width = `${value}%`;
  }, 220);
}

function init() {
  routeFromHash();
  renderCampaigns();

  $$('.nav-item').forEach(button => button.addEventListener('click', () => setPage(button.dataset.page)));
  $$('[data-nav]').forEach(button => button.addEventListener('click', () => setPage(button.dataset.nav)));
  window.addEventListener('hashchange', routeFromHash);

  $$('.entity-tab[data-level]').forEach(tab => tab.addEventListener('click', () => {
    currentLevel = tab.dataset.level;
    selectedIds.clear();
    $$('.entity-tab[data-level]').forEach(item => item.classList.toggle('active', item === tab));
    renderCampaigns();
    updateBulkBar();
  }));

  $('#campaign-search').addEventListener('input', renderCampaigns);
  $('#select-all').addEventListener('change', event => {
    selectedIds.clear();
    $$('.row-check').forEach(check => {
      check.checked = event.target.checked;
      const row = check.closest('tr');
      row.classList.toggle('selected', event.target.checked);
      if (event.target.checked) selectedIds.add(row.dataset.id);
    });
    updateBulkBar();
  });
  $('#clear-selection').addEventListener('click', () => {
    selectedIds.clear();
    renderCampaigns();
    updateBulkBar();
  });
  $$('[data-bulk]').forEach(button => button.addEventListener('click', () => showToast(`将对 ${selectedIds.size} 项执行${button.dataset.bulk === 'active' ? '启用' : '暂停'}；真实产品需确认并进入队列`)));

  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer-backdrop').addEventListener('click', closeDrawer);

  $$('.open-wizard').forEach(button => button.addEventListener('click', () => openWizard(1)));
  $('#wizard-close').addEventListener('click', closeWizard);
  $('#wizard-backdrop').addEventListener('click', closeWizard);
  $$('.wizard-step').forEach(step => step.addEventListener('click', () => { wizardStep = Number(step.dataset.step); updateWizard(); }));
  $('#wizard-back').addEventListener('click', () => {
    if (wizardStep === 1) closeWizard(); else { wizardStep -= 1; updateWizard(); }
  });
  $('#wizard-next').addEventListener('click', () => {
    if (wizardStep < 4) { wizardStep += 1; updateWizard(); }
    else showToast('模拟发布成功：已创建 4 个演示对象，状态均为 PAUSED');
  });
  $('#save-draft').addEventListener('click', () => {
    $('#draft-state').textContent = '保存中…';
    setTimeout(() => { $('#draft-state').textContent = '✓ 草稿刚刚保存'; showToast('草稿已保存'); }, 450);
  });
  $$('input, select, textarea', $('#wizard-modal')).forEach(input => input.addEventListener('input', () => {
    $('#draft-state').textContent = '有未保存更改';
  }));

  $('#run-report').addEventListener('click', runReportDemo);
  $('#refresh-button').addEventListener('click', event => {
    event.currentTarget.textContent = '⟳';
    showToast('已创建手动刷新任务');
    setTimeout(() => event.currentTarget.textContent = '↻', 800);
  });
  $('#sync-now').addEventListener('click', () => showToast('同步任务已排队，页面不会阻塞'));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if ($('#wizard-modal').classList.contains('open')) closeWizard();
      else if ($('#inspector-drawer').classList.contains('open')) closeDrawer();
    }
  });

  const params = new URLSearchParams(location.search);
  if (params.get('wizard')) openWizard(Number(params.get('wizard')) || 1);
}

document.addEventListener('DOMContentLoaded', init);
