import { state, html, raw, mount, $, $$, icon, api, get, loadSession, toast, toastError, fullName, initials, fileUrl, setBusy } from './core.js';

const VIEWS = {
  dashboard: () => import('./views/dashboard.js'),
  calendar: () => import('./views/calendar.js'),
  booking: () => import('./views/booking.js'),
  crud: () => import('./views/crud.js'),
  reports: () => import('./views/reports.js'),
  profile: () => import('./views/profile.js'),
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
  $$('.nav a, .bottom-nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#/${r.nav}`));
  // fresh element per page so listeners from the previous view are dropped
  const old = $('#view');
  const root = old.cloneNode(false);
  old.replaceWith(root);
  const token = ++renderToken;
  const ctx = {
    root, route: r,
    setTitle: (t, crumbs = '') => {
      if (token !== renderToken) return;
      mount($('#page-title'), html`${t}`);
      mount($('#page-crumbs'), html`${crumbs}`);
      document.title = `${t} · ${state.company?.webheader || 'GB CarSys'}`;
    },
    alive: () => token === renderToken,
  };
  try {
    const mod = await VIEWS[r.view]();
    if (token !== renderToken) return;
    await mod.render(ctx);
  } catch (e) {
    if (token !== renderToken) return;
    if (e.status === 401) return;
    mount(root, html`<div class="card"><div class="empty-state">${icon('alert')}<div>${e.message}</div></div></div>`);
  }
  window.scrollTo(0, 0);
}

/* ---------- shell ---------- */
function navItems() {
  const u = state.user;
  const admin = u.member_type === 1;
  const approver = u.approver;
  const c = state.counts;
  const R = state.meta.resources;
  const item = (href, ic, label, badge = 0) => html`<a href="#/${href}">${icon(ic)}<span>${label}</span>${badge ? html`<span class="count">${badge}</span>` : ''}</a>`;
  const res = (n) => item(`r/${n}`, R[n].icon, R[n].title);
  const groups = [
    ['หน้าหลัก', [item('', 'home', 'แดชบอร์ด'), item('calendar', 'calendar', 'ปฏิทินการใช้รถ'), item('r/car', 'car', 'ข้อมูลรถ')]],
    ['ประจำวัน', [
      item('booking/new', 'plus', 'จองใช้รถ'),
      item('booking', 'doc', 'รายการจองของฉัน'),
      approver && item('approve', 'inbox', 'งานรออนุมัติ', c.approve),
      approver && item('return', 'undo', 'รับคืนรถ', c.return),
      approver && item('bookings', 'archive', 'รายการจองทั้งหมด'),
      res('carwork'),
    ]],
    admin && ['เกี่ยวกับรถ', ['carfix', 'insurance', 'tabian', 'plb', 'payleasing'].map(res)],
    admin && ['บุคคล', ['driver', 'user', 'userdepart'].map(res)],
    admin && ['ข้อมูลพื้นฐาน', ['faculty', 'depart', 'oil', 'cartype', 'brand', 'insurer', 'leasing', 'garage', 'province'].map(res)],
    ['รายงาน', [item('reports', 'chart', 'รายงาน')]],
    admin && ['ตั้งค่าระบบ', ['company', 'docprefix'].map(res)],
  ].filter(Boolean);
  return groups.map(([t, items]) => html`<div class="nav-group"><span>${t}</span>${items.filter(Boolean)}</div>`);
}

function bottomNav() {
  const c = state.counts;
  const a = (href, ic, label, badge = 0, cls = '') => html`<a href="#/${href}" class="${cls}">${icon(ic)}<span>${label}</span>${badge ? html`<span class="count">${badge}</span>` : ''}</a>`;
  return html`${a('', 'home', 'หน้าหลัก')}${a('calendar', 'calendar', 'ปฏิทิน')}${a('booking/new', 'plus', 'จองรถ', 0, 'fab')}
    ${state.user.approver ? a('approve', 'inbox', 'อนุมัติ', c.approve) : a('booking', 'doc', 'การจอง')}
    <a href="javascript:void 0" data-open-nav>${icon('menu')}<span>เมนู</span></a>`;
}

function ensureShell() {
  if ($('#view')) { refreshNav(); return; }
  const u = state.user;
  const company = state.company || {};
  const pic = u.picture1 ? fileUrl('user', u.picture1) : '';
  mount(document.body, html`
    <div class="app">
      <aside class="sidebar">
        <div class="brand"><div class="brand-logo">${icon('car')}</div><div><b>${company.webheader || 'GB CarSys'}</b><small>${company.name || 'ระบบบริหารการใช้รถ'}</small></div></div>
        <nav class="nav" id="nav"></nav>
        <div class="sidebar-foot">GB CarSys 2.0 · PWA</div>
      </aside>
      <div class="scrim" data-close-nav></div>
      <div class="main">
        <div id="offline" class="offline-bar hidden">ออฟไลน์ — แสดงข้อมูลล่าสุดที่บันทึกไว้ในเครื่อง</div>
        <header class="topbar">
          <button class="icon-btn menu-btn" data-open-nav aria-label="เมนู">${icon('menu')}</button>
          <div class="grow" style="min-width:0"><h1 id="page-title"></h1><div class="crumbs" id="page-crumbs"></div></div>
          <button class="icon-btn" id="theme-btn" title="สลับโหมดสว่าง/มืด" aria-label="สลับธีม">${icon('moon')}</button>
          <div class="dropdown" id="user-menu">
            <button class="user-chip" aria-haspopup="true">
              <span class="avatar">${pic ? html`<img src="${pic}" alt="">` : initials(u)}</span>
              <span class="who">${u.firstname}<small>${u.member_type === 1 ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</small></span>
            </button>
            <div class="dropdown-menu">
              <div style="padding:8px 10px 10px;border-bottom:1px solid var(--border);margin-bottom:4px"><b>${fullName(u)}</b><div class="muted small">${u.username}</div></div>
              <a href="#/profile">${icon('user')} ข้อมูลส่วนตัว</a>
              <button id="install-btn" class="hidden">${icon('install')} ติดตั้งแอปบนเครื่อง</button>
              <button id="logout-btn">${icon('logout')} ออกจากระบบ</button>
            </div>
          </div>
        </header>
        <main class="content" id="view"></main>
      </div>
      <nav class="bottom-nav" id="bottom-nav"></nav>
    </div>`);
  refreshNav();
  updateThemeIcon();
  if (deferredInstall) $('#install-btn').classList.remove('hidden');
}

function refreshNav() {
  mount($('#nav'), html`${navItems()}`);
  mount($('#bottom-nav'), bottomNav());
  const r = parseRoute();
  $$('.nav a, .bottom-nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#/${r.nav}`));
}

export async function refreshCounts() {
  try { state.counts = await get('counts'); refreshNav(); } catch { /* ignore */ }
}
window.addEventListener('counts:refresh', refreshCounts);

document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-open-nav]')) { e.preventDefault(); document.body.classList.add('nav-open'); return; }
  if (e.target.closest('[data-close-nav]')) { document.body.classList.remove('nav-open'); return; }
  const dd = e.target.closest('.dropdown');
  $$('.dropdown.open').forEach((d) => { if (d !== dd) d.classList.remove('open'); });
  if (e.target.closest('.user-chip')) dd.classList.toggle('open');
  if (e.target.closest('#logout-btn')) {
    try { await api('POST', 'logout'); } catch { /* ignore */ }
    navigator.serviceWorker?.controller?.postMessage('clear-data');
    state.user = null; location.hash = ''; await loadSession().catch(() => {}); showLogin();
  }
  if (e.target.closest('#theme-btn')) toggleTheme();
  if (e.target.closest('#install-btn') && deferredInstall) {
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null; $('#install-btn')?.classList.add('hidden');
  }
});

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
  mount(document.body, html`
    <div class="login-wrap">
      <section class="login-art">
        <div class="brand" style="padding:0"><div class="brand-logo">${icon('car')}</div><div><b>${company.webheader || 'GB CarSys'}</b><small>${company.name || ''}</small></div></div>
        <div>
          <h1>ระบบบริหารการใช้รถ<br>จอง อนุมัติ ติดตาม ครบในที่เดียว</h1>
          <p class="hide-sm">จองรถได้ทุกที่จากมือถือ ดูปฏิทินรถว่าง อนุมัติงานทันที และแจ้งเตือนภาษี พ.ร.บ. ประกันภัยก่อนหมดอายุ</p>
        </div>
        <div class="muted small hide-sm" style="color:#7e8899">GB CarSys 2.0 · ติดตั้งเป็นแอปบนมือถือได้</div>
        <svg class="road" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width=".6">${raw('<path d="M5 17h14M3.5 17v-4.2c0-.5.1-1 .4-1.4L6.3 7.2A2 2 0 0 1 8 6h8a2 2 0 0 1 1.7 1.2l2.4 4.2c.3.4.4.9.4 1.4V17"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>')}</svg>
      </section>
      <section class="login-form">
        <form id="login" autocomplete="on">
          <div><h2 style="font-size:1.5rem">เข้าสู่ระบบ</h2><p class="muted" style="margin:.3rem 0 0">ใช้ชื่อผู้ใช้และรหัสผ่านเดิมจากระบบ CarSYS ได้ทันที</p></div>
          <div id="login-err"></div>
          <div class="field"><label for="u">ชื่อผู้ใช้</label><input class="input" id="u" name="username" autocomplete="username" required autofocus></div>
          <div class="field"><label for="p">รหัสผ่าน</label><input class="input" id="p" name="password" type="password" autocomplete="current-password" required></div>
          <button class="btn btn-primary" style="height:46px" type="submit">เข้าสู่ระบบ</button>
        </form>
      </section>
    </div>`);
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter || $('#login button');
    setBusy(btn, true, 'กำลังตรวจสอบ…');
    try {
      const s = await api('POST', 'login', { username: $('#u').value, password: $('#p').value });
      state.user = s.user; state.csrf = s.csrf; state.company = s.company;
      await boot();
    } catch (err) {
      mount($('#login-err'), html`<div class="alert err">${icon('alert')}<span>${err.message}</span></div>`);
      setBusy(btn, false);
    }
  });
}

/* ---------- boot ---------- */
async function boot() {
  state.meta = await get('meta');
  state.counts = await get('counts').catch(() => ({ approve: 0, return: 0 }));
  ensureShell();
  await route();
}

window.addEventListener('hashchange', route);
window.addEventListener('auth:lost', () => { if (!$('#login')) { toast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง', 'err'); showLogin(); } });
const setOnline = () => $('#offline')?.classList.toggle('hidden', navigator.onLine);
window.addEventListener('online', setOnline);
window.addEventListener('offline', setOnline);
setInterval(() => { if (state.user && document.visibilityState === 'visible') refreshCounts(); }, 60000);

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; $('#install-btn')?.classList.remove('hidden'); });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

(async () => {
  try {
    await loadSession();
    if (state.user) await boot(); else showLogin();
    setOnline();
  } catch (e) {
    mount(document.body, html`<div class="loading"><div class="card" style="max-width:520px"><div class="card-b"><h2>ไม่สามารถเชื่อมต่อระบบได้</h2><p class="muted">${e.message}</p><button class="btn btn-primary" onclick="location.reload()">${icon('refresh')} ลองใหม่</button></div></div></div>`);
  }
})();

export { toastError };
