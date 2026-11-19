import { state, html, raw, mount, $, $$, icon, api, get, qs, loadSession, lookup, toast, toastError, fullName, initials, fileUrl, setBusy, esc, bookingBadge, debounce } from './core.js';

const VIEWS = {
  dashboard: () => import('./views/dashboard.js'),
  calendar: () => import('./views/calendar.js'),
  booking: () => import('./views/booking.js'),
  crud: () => import('./views/crud.js'),
  reports: () => import('./views/reports.js'),
  profile: () => import('./views/profile.js'),
};
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

/* ---------- routing (hash based: works on any PHP host, no rewrite rules) ---------- */
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const seg = path.split('/').filter(Boolean);
  const q = Object.fromEntries(new URLSearchParams(query));
  const [a, b, c] = seg;
  if (!a) return { view: 'dashboard', nav: '' };
  if (a === 'calendar') return { view: 'calendar', nav: 'calendar', q };
  if (['booking', 'approve', 'return', 'bookings'].includes(a)) {
    if (a === 'booking' && b === 'new') return { view: 'booking', mode: 'form', nav: 'booking/new', q };
    if (a === 'booking' && b && c === 'edit') return { view: 'booking', mode: 'form', id: +b, nav: 'booking' };
    if (a === 'booking' && b) return { view: 'booking', mode: 'detail', id: +b, nav: 'booking' };
    return { view: 'booking', mode: 'list', scope: { booking: 'mine', approve: 'approve', return: 'return', bookings: 'all' }[a], nav: a, q };
  }
  if (a === 'r' && b) return { view: 'crud', res: b, id: c === 'new' ? 'new' : (c ? +c : null), nav: `r/${b}`, q };
  if (a === 'reports') return { view: 'reports', name: b || null, nav: 'reports', q };
  if (a === 'profile') return { view: 'profile', nav: 'profile' };
  return { view: 'dashboard', nav: '' };
}

let renderToken = 0;
async function route() {
  if (!state.user) return showLogin();
  const r = parseRoute();
  ensureShell();
  document.body.classList.remove('nav-open');
  markActive(r.nav);
  // fresh element per page so listeners from the previous view are dropped
  const old = $('#view');
  const root = old.cloneNode(false);
  old.replaceWith(root);
  mount($('#page-title'), ''); mount($('#page-sub'), ''); mount($('#page-actions'), '');
  const item = navIndex().find((n) => n.href === r.nav);
  const token = ++renderToken;
  const ctx = {
    root, route: r,
    // crumb: the last breadcrumb text when it should differ from the big page title
    setTitle: (t, sub = '', crumb = t) => {
      if (token !== renderToken) return;
      mount($('#page-title'), html`${t}`);
      mount($('#page-sub'), html`${sub}`);
      const deeper = item && item.label !== crumb;
      mount($('#crumbs'), html`${item ? html`<span class="hide-sm">${item.group}</span>${icon('chevR')}` : ''}<b class="truncate">${deeper ? html`<a href="#/${item.href}" style="color:inherit">${item.label}</a>` : crumb}</b>
        ${deeper ? html`${icon('chevR')}<span class="truncate">${crumb}</span>` : ''}`);
      document.title = `${t} · ${state.company?.webheader || 'GB CarSys'}`;
    },
    setActions: (tpl) => { if (token === renderToken) mount($('#page-actions'), tpl); return $('#page-actions'); },
    alive: () => token === renderToken,
  };
  try {
    const mod = await VIEWS[r.view]();
    if (token !== renderToken) return;
    await mod.render(ctx);
  } catch (e) {
    if (token !== renderToken) return;
    if (e.status === 401) return;
    mount(root, html`<div class="card"><div class="empty-state"><div class="ic">${icon('alert')}</div><b>${e.message}</b><div class="small"><a href="#/">กลับหน้าหลัก</a></div></div></div>`);
  }
  window.scrollTo(0, 0);
}

/* ---------- navigation model ---------- */
let NAV = null;
function navIndex() {
  if (NAV) return NAV;
  const u = state.user;
  const admin = u.member_type === 1;
  const R = state.meta.resources;
  const res = (n, group) => ({ href: `r/${n}`, icon: R[n].icon, label: R[n].title, group });
  const g = (group, items) => items.filter(Boolean).map((i) => ({ ...i, group }));
  NAV = [
    ...g('ภาพรวม', [{ href: '', icon: 'home', label: 'แดชบอร์ด' }, { href: 'calendar', icon: 'calendar', label: 'ปฏิทินการใช้รถ' }, res('car')]),
    ...g('งานประจำวัน', [
      { href: 'booking/new', icon: 'plus', label: 'จองใช้รถ' },
      { href: 'booking', icon: 'doc', label: 'รายการจองของฉัน' },
      u.approver && { href: 'approve', icon: 'inbox', label: 'งานรออนุมัติ', badge: 'approve' },
      u.approver && { href: 'return', icon: 'undo', label: 'รับคืนรถ', badge: 'return' },
      u.approver && { href: 'bookings', icon: 'archive', label: 'รายการจองทั้งหมด' },
      res('carwork'),
    ]),
    ...(admin ? g('เกี่ยวกับรถ', ['carfix', 'insurance', 'tabian', 'plb', 'payleasing'].map((n) => res(n))) : []),
    ...(admin ? g('บุคคล', ['driver', 'user', 'userdepart'].map((n) => res(n))) : []),
    ...(admin ? g('ข้อมูลพื้นฐาน', ['faculty', 'depart', 'oil', 'cartype', 'brand', 'insurer', 'leasing', 'garage', 'province'].map((n) => res(n))) : []),
    ...g('รายงาน', [{ href: 'reports', icon: 'chart', label: 'รายงานทั้งหมด' }]),
    ...(admin ? g('ตั้งค่าระบบ', ['company', 'docprefix'].map((n) => res(n))) : []),
  ];
  return NAV;
}

function navHtml() {
  const closed = LS.get('navClosed', ['ข้อมูลพื้นฐาน', 'ตั้งค่าระบบ']);
  const groups = [];
  for (const it of navIndex()) {
    let grp = groups.find((x) => x.name === it.group);
    if (!grp) groups.push(grp = { name: it.group, items: [] });
    grp.items.push(it);
  }
  return groups.map((grp) => html`<div class="nav-group ${closed.includes(grp.name) ? 'closed' : ''}" data-group="${grp.name}">
    <button type="button" aria-expanded="${!closed.includes(grp.name)}">${grp.name}${icon('chevD')}</button>
    <div class="nav-items">${grp.items.map((it) => {
      const n = it.badge ? state.counts[it.badge] : 0;
      return html`<a href="#/${it.href}">${icon(it.icon)}<span class="truncate">${it.label}</span>${n ? html`<span class="count">${n}</span>` : ''}</a>`;
    })}</div></div>`);
}

function bottomNav() {
  const c = state.counts;
  const a = (href, ic, label, badge = 0, cls = '') => html`<a href="#/${href}" class="${cls}">${icon(ic)}<span>${label}</span>${badge ? html`<span class="count">${badge}</span>` : ''}</a>`;
  return html`${a('', 'home', 'หน้าหลัก')}${a('calendar', 'calendar', 'ปฏิทิน')}${a('booking/new', 'plus', 'จองรถ', 0, 'fab')}
    ${state.user.approver ? a('approve', 'inbox', 'อนุมัติ', c.approve) : a('booking', 'doc', 'การจอง')}
    <a href="javascript:void 0" data-open-nav>${icon('menu')}<span>เมนู</span></a>`;
}

function notifHtml() {
  const c = state.counts;
  const items = [
    state.user.approver && { href: 'approve', tone: 'warning', ic: 'inbox', n: c.approve, t: 'งานรออนุมัติ', d: 'คำขอใช้รถที่รอคุณพิจารณา' },
    state.user.approver && { href: 'return', tone: 'violet', ic: 'undo', n: c.return, t: 'รอยืนยันรับคืนรถ', d: 'ผู้ใช้ส่งคืนรถแล้ว' },
    { href: 'reports/car_expire?days=0', tone: 'danger', ic: 'alert', n: c.expired, t: 'เอกสารรถหมดอายุแล้ว', d: 'ภาษี / พ.ร.บ. / ประกันภัย' },
    { href: 'reports/car_expire?days=30', tone: 'info', ic: 'clock', n: c.expiring, t: 'ใกล้หมดอายุใน 30 วัน', d: 'ควรดำเนินการต่ออายุ' },
  ].filter((x) => x && x.n);
  return html`<div class="head"><b>การแจ้งเตือน</b><span class="muted small">${items.length ? '' : 'ไม่มีรายการใหม่'}</span></div>
    ${items.length ? items.map((x) => html`<a href="#/${x.href}"><span class="ic tone-${x.tone}">${icon(x.ic)}</span>
      <span class="grow"><b>${x.t}</b><span class="muted small">${x.d}</span></span><span class="badge tone-${x.tone} plain">${x.n}</span></a>`)
      : html`<div class="empty-state" style="padding:28px 16px"><div class="ic">${icon('check')}</div>เรียบร้อยดี</div>`}`;
}
const bellCount = () => (state.counts.approve || 0) + (state.counts.return || 0);

function ensureShell() {
  if ($('#view')) { refreshNav(); return; }
  const u = state.user;
  const company = state.company || {};
  const pic = u.picture1 ? fileUrl('user', u.picture1) : '';
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  mount(document.body, html`
    <div class="app">
      <aside class="sidebar" aria-label="เมนูหลัก">
        <a class="brand" href="#/"><div class="brand-logo"><img src="assets/icons/logo-128.png" alt=""></div><div class="grow"><b class="truncate">${company.webheader || 'GB CarSys'}</b><small class="truncate">${company.name || 'ระบบบริหารการใช้รถ'}</small></div></a>
        <nav class="nav" id="nav"></nav>
        <div class="sidebar-foot"><span>GB CarSys 2.0</span><span>PWA</span></div>
      </aside>
      <div class="scrim" data-close-nav></div>
      <div class="main">
        <div id="offline" class="offline-bar hidden">ออฟไลน์ — แสดงข้อมูลล่าสุดที่บันทึกไว้ในเครื่อง</div>
        <header class="topbar">
          <button class="icon-btn menu-btn" data-open-nav aria-label="เปิดเมนู">${icon('menu')}</button>
          <nav class="crumbs grow" id="crumbs" aria-label="ตำแหน่ง"></nav>
          <button class="search-trigger" id="search-btn" aria-label="ค้นหา">${icon('search')}<span>ค้นหาเมนู รถ ใบจอง…</span><kbd>${isMac ? '⌘' : 'Ctrl'} K</kbd></button>
          <button class="icon-btn" id="theme-btn" title="สลับโหมดสว่าง/มืด" aria-label="สลับธีม">${icon('moon')}</button>
          <div class="dropdown" id="notif-menu">
            <button class="icon-btn" data-toggle aria-label="การแจ้งเตือน" aria-haspopup="true">${icon('bell')}<span id="bell-dot"></span></button>
            <div class="dropdown-menu notif" id="notif-list"></div>
          </div>
          <div class="dropdown" id="user-menu">
            <button class="user-chip" data-toggle aria-haspopup="true">
              <span class="avatar">${pic ? html`<img src="${pic}" alt="">` : initials(u)}</span>
              <span class="who">${u.firstname}<small>${u.member_type === 1 ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</small></span>
            </button>
            <div class="dropdown-menu">
              <div class="head"><b>${fullName(u)}</b><div class="muted small">${u.username}${u.position_name ? ` · ${u.position_name}` : ''}</div></div>
              <a href="#/profile">${icon('user')} ข้อมูลส่วนตัว</a>
              <button id="install-btn" class="hidden">${icon('install')} ติดตั้งแอปบนเครื่อง</button>
              <button id="logout-btn">${icon('logout')} ออกจากระบบ</button>
            </div>
          </div>
        </header>
        <main class="content">
          <div class="page-head"><div class="titles"><h1 id="page-title"></h1><p id="page-sub"></p></div><div class="actions" id="page-actions"></div></div>
          <div id="view"></div>
        </main>
      </div>
      <nav class="bottom-nav" id="bottom-nav" aria-label="เมนูลัด"></nav>
    </div>`);
  refreshNav();
  updateThemeIcon();
  if (deferredInstall) $('#install-btn').classList.remove('hidden');
}

function markActive(nav) {
  $$('.nav a, .bottom-nav a').forEach((a) => {
    const on = a.getAttribute('href') === `#/${nav}`;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    if (on) a.closest('.nav-group')?.classList.remove('closed');
  });
}

function refreshNav() {
  mount($('#nav'), html`${navHtml()}`);
  mount($('#bottom-nav'), bottomNav());
  mount($('#notif-list'), notifHtml());
  const n = bellCount();
  mount($('#bell-dot'), n ? html`<span class="dot">${n > 99 ? '99+' : n}</span>` : '');
  markActive(parseRoute().nav);
}

export async function refreshCounts() {
  try { state.counts = await get('counts'); refreshNav(); } catch { /* ignore */ }
}
window.addEventListener('counts:refresh', refreshCounts);

document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-open-nav]')) { e.preventDefault(); document.body.classList.add('nav-open'); return; }
  if (e.target.closest('[data-close-nav]')) { document.body.classList.remove('nav-open'); return; }
  const grpBtn = e.target.closest('.nav-group > button');
  if (grpBtn) {
    const g = grpBtn.parentElement;
    g.classList.toggle('closed');
    grpBtn.setAttribute('aria-expanded', String(!g.classList.contains('closed')));
    LS.set('navClosed', $$('.nav-group.closed').map((x) => x.dataset.group));
    return;
  }
  const dd = e.target.closest('.dropdown');
  $$('.dropdown.open').forEach((d) => { if (d !== dd) d.classList.remove('open'); });
  if (e.target.closest('.dropdown [data-toggle]')) { dd.classList.toggle('open'); return; }
  if (e.target.closest('.dropdown-menu a')) dd?.classList.remove('open');
  if (e.target.closest('#search-btn')) openPalette();
  if (e.target.closest('#logout-btn')) {
    try { await api('POST', 'logout'); } catch { /* ignore */ }
    navigator.serviceWorker?.controller?.postMessage('clear-data');
    state.user = null; NAV = null; location.hash = ''; await loadSession().catch(() => {}); showLogin();
  }
  if (e.target.closest('#theme-btn')) toggleTheme();
  if (e.target.closest('#install-btn') && deferredInstall) {
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null; $('#install-btn')?.classList.add('hidden');
  }
});
document.addEventListener('keydown', (e) => {
  if (!state.user || !$('#view')) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openPalette(); }
  else if (e.key === '/' && !typing && !document.querySelector('dialog[open]')) { e.preventDefault(); openPalette(); }
  else if (e.key === 'Escape') $$('.dropdown.open').forEach((d) => d.classList.remove('open'));
});

/* ---------- command palette (Ctrl+K) ---------- */
function openPalette() {
  if ($('dialog.cmdk')) return;
  const d = document.createElement('dialog');
  d.className = 'cmdk';
  mount(d, html`<div class="cmdk-input">${icon('search')}<input id="cmdk-q" placeholder="พิมพ์ชื่อเมนู ทะเบียนรถ หรือเลขที่ใบจอง…" autocomplete="off" aria-label="ค้นหา"><kbd>Esc</kbd></div>
    <div class="cmdk-list" id="cmdk-list" role="listbox"></div>
    <div class="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> เลือก</span><span><kbd>Enter</kbd> เปิด</span><span><kbd>Esc</kbd> ปิด</span></div>`);
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.showModal();
  const inp = $('#cmdk-q', d);
  const list = $('#cmdk-list', d);
  let items = [];
  let hl = 0;
  let bookings = [];
  let cars = [];
  lookup('car').then((c) => { cars = c; draw(); }).catch(() => {});
  const actions = [
    { href: 'booking/new', icon: 'plus', label: 'จองใช้รถใหม่', group: 'คำสั่ง' },
    { run: toggleTheme, icon: 'moon', label: 'สลับโหมดสว่าง / มืด', group: 'คำสั่ง' },
  ];
  function draw() {
    const q = inp.value.trim().toLowerCase();
    const match = (s) => !q || String(s).toLowerCase().includes(q);
    const pages = navIndex().filter((n) => match(`${n.label} ${n.group}`)).slice(0, q ? 8 : 6).map((n) => ({ ...n, group: 'เมนู', meta: n.group }));
    const carHits = q ? cars.filter((c) => match(c.text)).slice(0, 6).map((c) => ({ href: `r/car/${c.id}`, icon: 'car', label: c.text, group: 'รถ', meta: state.meta.carStatus[c.status] })) : [];
    const bk = bookings.map((b) => ({ href: `booking/${b.id}`, icon: 'doc', label: `${b.docno} · ${b.working}`, group: 'ใบจอง', meta: b.status_text }));
    items = [...pages, ...carHits, ...bk, ...actions.filter((a) => match(a.label))];
    hl = Math.min(hl, Math.max(0, items.length - 1));
    let last = '';
    mount(list, items.length ? html`${items.map((it, k) => {
      const head = it.group !== last ? html`<div class="cmdk-group">${it.group}</div>` : '';
      last = it.group;
      return html`${head}<a class="cmdk-item ${k === hl ? 'hl' : ''}" data-k="${k}" role="option" ${it.href !== undefined ? raw(`href="#/${esc(it.href)}"`) : ''}>${icon(it.icon)}<span class="truncate">${it.label}</span>${it.meta ? html`<span class="meta">${it.meta}</span>` : ''}</a>`;
    })}` : html`<div class="empty-state" style="padding:32px">ไม่พบ “${inp.value}”</div>`);
    list.querySelector('.hl')?.scrollIntoView({ block: 'nearest' });
  }
  const searchBookings = debounce(async () => {
    const q = inp.value.trim();
    if (q.length < 2) { bookings = []; draw(); return; }
    try { bookings = (await get(`booking?${qs({ scope: state.user.approver ? 'all' : 'mine', q, per: 5 })}`)).rows; } catch { bookings = []; }
    if (d.open) draw();
  }, 250);
  const go = (it) => { if (!it) return; d.close(); if (it.run) it.run(); else location.hash = `#/${it.href}`; };
  inp.addEventListener('input', () => { hl = 0; draw(); searchBookings(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { hl = Math.min(items.length - 1, hl + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { hl = Math.max(0, hl - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(items[hl]); }
  });
  list.addEventListener('click', (e) => { const a = e.target.closest('[data-k]'); if (a) { e.preventDefault(); go(items[+a.dataset.k]); } });
  draw();
  inp.focus();
}

/* ---------- theme ---------- */
function currentTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch { /* ignore */ }
  updateThemeIcon();
}
function updateThemeIcon() { const b = $('#theme-btn'); if (b) mount(b, icon(currentTheme() === 'dark' ? 'sun' : 'moon')); }

/* ---------- login ---------- */
function showLogin() {
  const company = state.company || {};
  document.title = `เข้าสู่ระบบ · ${company.webheader || 'GB CarSys'}`;
  const owner = company.name || 'บริษัท เอ็น.ซี.เอส.โกลด์เบรด จำกัด';
  let saved = '';
  try { saved = localStorage.getItem('loginUser') || ''; } catch { /* storage blocked */ }
  mount(document.body, html`
    <div class="login">
      <section class="login-brand">
        ${raw(`<svg class="login-road wide" viewBox="0 0 700 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M-40 760 C 140 700, 180 560, 330 540 S 560 600, 620 430 S 560 180, 760 120" fill="none" stroke="#24314D" stroke-width="56" stroke-linecap="round"/>
          <path d="M-40 760 C 140 700, 180 560, 330 540 S 560 600, 620 430 S 560 180, 760 120" fill="none" stroke="#E3A22B" stroke-width="3" stroke-dasharray="14 16" stroke-linecap="round" opacity=".85"/>
          <path d="M120 980 C 220 860, 420 820, 470 700 S 400 470, 520 360" fill="none" stroke="#1F2A42" stroke-width="34" stroke-linecap="round"/>
          <circle cx="620" cy="430" r="11" fill="#172033" stroke="#E3A22B" stroke-width="4"/>
          <circle cx="620" cy="430" r="26" fill="none" stroke="#E3A22B" stroke-width="2" opacity=".35"/></svg>
        <svg class="login-road narrow" viewBox="0 0 390 320" preserveAspectRatio="xMinYMin slice" aria-hidden="true">
          <path d="M-20 300 C 80 250, 120 180, 210 170 S 340 200, 410 60" fill="none" stroke="#24314D" stroke-width="34" stroke-linecap="round"/>
          <path d="M-20 300 C 80 250, 120 180, 210 170 S 340 200, 410 60" fill="none" stroke="#E3A22B" stroke-width="2.5" stroke-dasharray="10 12" stroke-linecap="round" opacity=".85"/>
          <circle cx="210" cy="170" r="8" fill="#172033" stroke="#E3A22B" stroke-width="3"/></svg>`)}
        <div class="login-mark">
          <img src="assets/icons/logo-128.png" alt="">
          <div><b>GB CarSys</b><small>N.C.S. Gold Bread</small></div>
        </div>
        <div class="login-pitch">
          <span class="login-pill">ระบบบริหารการใช้รถ</span>
          <h1>จอง อนุมัติ ติดตามรถ<span class="wide"><br>ครบจบในที่เดียว</span></h1>
          <p class="wide">จัดการการใช้รถของบริษัทได้ง่าย ทั้งบนคอมพิวเตอร์และมือถือ</p>
          <p class="narrow">ระบบบริหารการใช้รถ</p>
        </div>
        <div class="login-chips">
          <span>${icon('calendar')} จองรถ</span>
          <span>${icon('checkCircle')} อนุมัติออนไลน์</span>
          <span>${icon('pin')} ติดตามรถ</span>
        </div>
      </section>
      <main class="login-main">
        <form id="login" class="login-form" autocomplete="on" novalidate>
          <div class="login-head">
            <h2>เข้าสู่ระบบ</h2>
            <p class="wide">ยินดีต้อนรับกลับมา กรุณากรอกข้อมูลเพื่อใช้งาน</p>
          </div>
          <div id="login-err" aria-live="polite"></div>
          <div class="login-fields">
            <div class="login-field">
              <label for="u">ชื่อผู้ใช้</label>
              <div class="login-input">${icon('user')}<input id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="ชื่อผู้ใช้ของคุณ" required value="${saved}"></div>
            </div>
            <div class="login-field">
              <label for="p">รหัสผ่าน</label>
              <div class="login-input">${icon('lock')}<input id="p" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required>
                <button type="button" class="login-eye" id="pw-eye" aria-label="แสดงรหัสผ่าน" aria-pressed="false">${icon('eye')}</button></div>
            </div>
            <div class="login-row">
              <label class="login-check"><input type="checkbox" id="remember" ${saved ? 'checked' : ''}> <span class="wide">จดจำชื่อผู้ใช้ในเครื่องนี้</span><span class="narrow">จดจำชื่อผู้ใช้</span></label>
              <button type="button" class="login-link" id="forgot">ลืมรหัสผ่าน?</button>
            </div>
          </div>
          <button class="login-submit" type="submit">เข้าสู่ระบบ ${icon('arrowR')}</button>
          <div class="login-note wide">${icon('info')}<span>ยังไม่มีบัญชีหรือเข้าระบบไม่ได้ ติดต่อฝ่ายไอที</span></div>
          <div class="login-foot">
            <span class="narrow">เข้าระบบไม่ได้? ติดต่อฝ่ายไอที</span>
            <span>© ${owner}</span>
          </div>
        </form>
      </main>
    </div>`);

  const showMsg = (kind, text) => mount($('#login-err'), html`<div class="alert ${kind}">${icon(kind === 'err' ? 'alert' : 'info')}<span>${text}</span></div>`);
  $('#pw-eye').addEventListener('click', (e) => {
    const p = $('#p'), btn = e.currentTarget, show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
    mount(btn, icon(show ? 'eyeOff' : 'eye'));
    p.focus();
  });
  ['#u', '#p'].forEach((s) => $(s).addEventListener('input', (e) => e.target.removeAttribute('aria-invalid')));
  $('#forgot').addEventListener('click',() => showMsg('info', 'ระบบยังไม่มีการตั้งรหัสผ่านใหม่ด้วยตนเอง กรุณาติดต่อฝ่ายไอทีหรือผู้ดูแลระบบเพื่อตั้งรหัสผ่านใหม่'));
  // focus the first empty field on desktop only (avoids popping the keyboard on phones)
  if (matchMedia('(pointer: fine)').matches) (saved ? $('#p') : $('#u')).focus();

  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = $('#u').value.trim(), p = $('#p').value;
    $('#u').toggleAttribute('aria-invalid', !u);
    $('#p').toggleAttribute('aria-invalid', !p);
    if (!u || !p) { showMsg('err', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'); (u ? $('#p') : $('#u')).focus(); return; }
    const btn = e.submitter || $('#login .login-submit');
    setBusy(btn, true, 'กำลังตรวจสอบ…');
    try {
      const s = await api('POST', 'login', { username: u, password: p });
      try { if ($('#remember').checked) localStorage.setItem('loginUser', u); else localStorage.removeItem('loginUser'); } catch { /* storage blocked */ }
      state.user = s.user; state.csrf = s.csrf; state.company = s.company; NAV = null;
      await boot();
    } catch (err) {
      showMsg('err', err.message);
      setBusy(btn, false);
      $('#p').select();
    }
  });
}

/* ---------- boot ---------- */
async function boot() {
  state.meta = await get('meta');
  state.counts = await get('counts').catch(() => ({ approve: 0, return: 0, expired: 0, expiring: 0 }));
  NAV = null;
  ensureShell();
  await route();
}

window.addEventListener('hashchange', route);
window.addEventListener('auth:lost', () => { if (!$('#login')) { toast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง', 'err'); NAV = null; showLogin(); } });
const setOnline = () => $('#offline')?.classList.toggle('hidden', navigator.onLine);
window.addEventListener('online', setOnline);
window.addEventListener('offline', setOnline);
setInterval(() => { if (state.user && document.visibilityState === 'visible') refreshCounts(); }, 60000);

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; $('#install-btn')?.classList.remove('hidden'); });

if ('serviceWorker' in navigator) {
  // when a new release takes over, reload once so all modules come from the same version
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js').then((reg) => reg.update()).catch(() => {});
}

(async () => {
  try {
    await loadSession();
    if (state.user) await boot(); else showLogin();
    setOnline();
  } catch (e) {
    mount(document.body, html`<div class="loading" style="min-height:100vh"><div class="card" style="max-width:520px"><div class="card-b stack sm"><h2>ไม่สามารถเชื่อมต่อระบบได้</h2><p class="muted" style="margin:0">${e.message}</p><div><button class="btn btn-primary" onclick="location.reload()">${icon('refresh')} ลองใหม่</button></div></div></div></div>`);
  }
})();

export { toastError, bookingBadge };
