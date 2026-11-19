// GB CarSys 2.0 — shared helpers (no build step, plain ES modules)

export const state = { user: null, csrf: '', company: null, meta: null, counts: { approve: 0, return: 0 } };
const API = 'api/index.php';

/* ---------- safe HTML templates ---------- */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const raw = (s) => ({ __raw: String(s ?? '') });
function render(v) {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(render).join('');
  if (typeof v === 'object' && '__raw' in v) return v.__raw;
  return esc(v);
}
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s + (i < vals.length ? render(vals[i]) : ''); });
  return raw(out);
}
export function mount(el, tpl) { el.innerHTML = render(tpl); return el; }
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- icons (inline SVG, stroke style) ---------- */
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  car: '<path d="M5 17h14M3.5 17v-4.2c0-.5.1-1 .4-1.4L6.3 7.2A2 2 0 0 1 8 6h8a2 2 0 0 1 1.7 1.2l2.4 4.2c.3.4.4.9.4 1.4V17"/><path d="M3.5 12h17"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13l2.5 8v6H3v-6z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8-1.3-1.3a4 4 0 0 1-5-5L14 5z"/><path d="M3 21l6-6"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/>',
  doc: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5M4.5 10v8M9.5 10v8M14.5 10v8M19.5 10v8M3 20.5h18"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  steering: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M3.5 10.5 9.6 11M14.4 11l6.1-.5M12 14.5V21"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10M2.5 21h19M8 7h4M8 11h4M8 15h4"/>',
  sitemap: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-2h12v2"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10"/><path d="M14 8h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V8.5L18 6"/>',
  tag: '<path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  map: '<path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  hash: '<path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12.5A1.5 1.5 0 0 0 8 21h8a1.5 1.5 0 0 0 1.5-1.5L18.5 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout: '<path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15"/><path d="M10 16.5 14.5 12 10 7.5M14.5 12H4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>', chevD: '<path d="m6 9 6 6 6-6"/>',
  print: '<path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 4h16"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/>',
  install: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3M10.5 18.5h3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 3.5V8h4.5M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20.5V16h-4.5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
};
export const icon = (n, cls = '') => raw(`<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.doc}</svg>`);

/* ---------- API ---------- */
export class ApiError extends Error { constructor(msg, status, field) { super(msg); this.status = status; this.field = field; } }

export async function api(method, path, data, { retry = true } = {}) {
  const opt = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
  if (method !== 'GET') opt.headers['X-CSRF-Token'] = state.csrf;
  if (data instanceof FormData) opt.body = data;
  else if (data !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(data); }
  let res;
  try { res = await fetch(`${API}/${path}`, opt); }
  catch { throw new ApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (ออฟไลน์?)', 0); }
  let json = null;
  try { json = await res.json(); } catch { /* not json */ }
  if (res.status === 419 && retry) { await loadSession(); return api(method, path, data, { retry: false }); }
  if (res.status === 401 && path !== 'login') { state.user = null; window.dispatchEvent(new Event('auth:lost')); }
  if (!res.ok) throw new ApiError(json?.error || `เกิดข้อผิดพลาด (${res.status})`, res.status, json?.field);
  return json;
}
export const get = (p) => api('GET', p);
export const qs = (o) => Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

export async function loadSession() {
  const s = await api('GET', 'session', undefined, { retry: false });
  state.csrf = s.csrf; state.user = s.user; state.company = s.company;
  return s;
}

const lookupCache = new Map();
export async function lookup(name, fresh = false) {
  if (!fresh && lookupCache.has(name)) return lookupCache.get(name);
  const p = get(`lookup/${name}`);
  lookupCache.set(name, p);
  try { return await p; } catch (e) { lookupCache.delete(name); throw e; }
}
export const invalidateLookup = (name) => lookupCache.delete(name);

export const fileUrl = (type, name, orig) => name ? `${API}/file/${type}/${encodeURIComponent(name)}${orig ? '?name=' + encodeURIComponent(orig) : ''}` : '';

/* ---------- formatting (Thai, Buddhist era) ---------- */
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const TH_DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
export const parseDate = (s) => {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
};
export function fmtDate(s) {
  const d = s instanceof Date ? s : parseDate(s);
  if (!d || d.getFullYear() < 1900) return '';
  return `${d.getDate()} ${TH_M[d.getMonth()]} ${d.getFullYear() + 543}`;
}
export const fmtTime = (s) => { const d = s instanceof Date ? s : parseDate(s); return d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ''; };
export const fmtDateTime = (s) => { const d = parseDate(s); return d ? `${fmtDate(d)} ${fmtTime(d)}` : ''; };
export function fmtRange(a, b) {
  const x = parseDate(a), y = parseDate(b);
  if (!x) return '';
  if (!y) return fmtDateTime(a);
  if (x.toDateString() === y.toDateString()) return `${fmtDate(x)} ${fmtTime(x)}–${fmtTime(y)}`;
  return `${fmtDate(x)} ${fmtTime(x)} – ${fmtDate(y)} ${fmtTime(y)}`;
}
export const fmtMoney = (n) => (n === null || n === undefined || n === '') ? '' : Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtNum = (n, d = 0) => (n === null || n === undefined || n === '') ? '' : Number(n).toLocaleString('th-TH', { maximumFractionDigits: d });
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => ymd(new Date());
export const daysUntil = (s) => { const d = parseDate(s); if (!d) return null; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 86400000); };
export const fullName = (u) => u ? `${u.title || ''}${u.firstname || ''} ${u.surname || ''}`.trim() : '';
export const initials = (u) => (u?.firstname || u?.username || '?').trim().charAt(0).toUpperCase();

/* ---------- status badges ---------- */
const BOOKING_TONE = { 9: 'gray', 0: 'warning', 1: 'info', 2: 'success', 3: 'danger', 4: 'gray', 5: 'violet', 6: 'primary' };
export const bookingTone = (s) => BOOKING_TONE[s] || 'gray';
export const bookingBadge = (s, text) => html`<span class="badge tone-${bookingTone(s)}">${text ?? state.meta?.bookingStatus?.[s] ?? s}</span>`;
const CAR_TONE = { 0: 'success', 1: 'warning', 2: 'info', 3: 'gray' };
export const carBadge = (s) => html`<span class="badge tone-${CAR_TONE[s] || 'gray'}">${state.meta?.carStatus?.[s] ?? ''}</span>`;
export function expiryBadge(date) {
  const d = daysUntil(date);
  if (d === null) return html`<span class="muted">-</span>`;
  const tone = d < 0 ? 'danger' : d <= 30 ? 'warning' : 'success';
  const txt = d < 0 ? `หมดอายุ ${-d} วัน` : d === 0 ? 'หมดวันนี้' : d <= 30 ? `อีก ${d} วัน` : fmtDate(date);
  return html`<span class="badge tone-${tone}" title="${fmtDate(date)}">${txt}</span>`;
}

/* ---------- toast / modal / confirm ---------- */
export function toast(msg, type = 'ok') {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.append(box); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  mount(t, html`${icon(type === 'err' ? 'alert' : 'check')}<span>${msg}</span>`);
  box.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, type === 'err' ? 5000 : 2800);
}
export const toastError = (e) => toast(e?.message || String(e), 'err');

export function modal({ title, body, footer, size = '', onClose } = {}) {
  const d = document.createElement('dialog');
  d.className = `modal ${size}`;
  mount(d, html`<div class="modal-h"><h2>${title}</h2><button class="icon-btn" data-close aria-label="ปิด">${icon('x')}</button></div>
    <div class="modal-b">${body}</div>${footer ? html`<div class="modal-f">${footer}</div>` : ''}`);
  document.body.append(d);
  const close = () => { if (d.open) d.close(); };
  d.addEventListener('close', () => { d.remove(); onClose?.(); });
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) close(); });
  d.showModal();
  return { el: d, close };
}

/**
 * Full-screen photo viewer. images: [{src, caption}]
 * ←/→ or swipe to browse, click photo to zoom, Esc to close.
 */
export function lightbox(images, start = 0, { onReplace } = {}) {
  if (!images.length) return;
  let i = Math.max(0, start);
  const d = document.createElement('dialog');
  d.className = 'lightbox';
  mount(d, html`
    <div class="lb-top"><span class="lb-cap"></span><span class="lb-count"></span>
      ${onReplace ? html`<button class="lb-btn" data-lb="replace" title="เปลี่ยนรูปนี้">${icon('upload')}<span>เปลี่ยนรูป</span></button>` : ''}
      <a class="lb-btn" data-lb="open" target="_blank" rel="noopener" title="เปิดรูปต้นฉบับ">${icon('download')}<span>ต้นฉบับ</span></a>
      <button class="lb-btn" data-lb="close" title="ปิด (Esc)" aria-label="ปิด">${icon('x')}</button></div>
    <div class="lb-stage"><img alt=""><div class="spinner"></div></div>
    ${images.length > 1 ? html`<button class="lb-nav prev" data-lb="prev" aria-label="รูปก่อนหน้า">${icon('chevL')}</button>
      <button class="lb-nav next" data-lb="next" aria-label="รูปถัดไป">${icon('chevR')}</button>
      <div class="lb-thumbs">${images.map((im, k) => html`<button data-k="${k}" style="background-image:url('${im.src}')" aria-label="รูปที่ ${k + 1}"></button>`)}</div>` : ''}`);
  document.body.append(d);
  const img = $('img', d);
  const show = () => {
    const im = images[i];
    d.classList.remove('zoom');
    d.classList.add('loading');
    img.onload = () => d.classList.remove('loading');
    img.onerror = () => d.classList.remove('loading');
    img.src = im.src;
    $('.lb-cap', d).textContent = im.caption || '';
    $('.lb-count', d).textContent = images.length > 1 ? `${i + 1} / ${images.length}` : '';
    $('[data-lb="open"]', d).href = im.src;
    $$('.lb-thumbs button', d).forEach((b, k) => b.classList.toggle('on', k === i));
  };
  const go = (n) => { i = (i + n + images.length) % images.length; show(); };
  const close = () => d.close();
  d.addEventListener('close', () => { document.removeEventListener('keydown', onKey); d.remove(); });
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  };
  document.addEventListener('keydown', onKey);
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lb]');
    const t = e.target.closest('[data-k]');
    if (t) { i = +t.dataset.k; show(); return; }
    if (e.target === img) { d.classList.toggle('zoom'); return; }
    if (!b) { if (e.target.classList.contains('lb-stage') || e.target === d) close(); return; }
    const a = b.dataset.lb;
    if (a === 'close') close();
    if (a === 'prev') go(-1);
    if (a === 'next') go(1);
    if (a === 'replace') { close(); onReplace(i); }
  });
  let sx = null;
  d.addEventListener('touchstart', (e) => { sx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  d.addEventListener('touchend', (e) => {
    if (sx === null || d.classList.contains('zoom')) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    sx = null;
  });
  d.showModal();
  show();
}

export function confirmBox(message, { ok = 'ยืนยัน', danger = false, input = null } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const m = modal({
      title: 'ยืนยัน', size: 'sm',
      body: html`<p style="margin-top:0">${message}</p>${input ? html`<textarea class="input" id="cf-input" placeholder="${input}"></textarea>` : ''}`,
      footer: html`<button class="btn" data-close>ยกเลิก</button><button class="btn ${danger ? 'btn-danger solid' : 'btn-primary'}" id="cf-ok">${ok}</button>`,
      onClose: () => resolve(result),
    });
    $('#cf-ok', m.el).onclick = () => { result = input ? { value: $('#cf-input', m.el).value } : true; m.close(); };
  });
}

/* ---------- forms ---------- */
export function fieldHtml(f, value, { readonly = false } = {}) {
  const id = `f-${f.name}`;
  const req = f.required ? html`<span class="req">*</span>` : '';
  const ro = readonly || f.readonly;
  const v = value ?? '';
  let input;
  switch (f.type) {
    case 'textarea':
      input = html`<textarea class="input" id="${id}" name="${f.name}" ${ro ? raw('readonly') : ''}>${v}</textarea>`; break;
    case 'select':
      input = html`<select class="input" id="${id}" name="${f.name}" ${ro ? raw('disabled') : ''}>
        ${Object.entries(f.options).map(([k, t]) => html`<option value="${k}" ${String(v) === k ? raw('selected') : ''}>${t}</option>`)}</select>`; break;
    case 'lookup':
      input = html`<div class="combo" data-lookup="${f.lookup}" data-name="${f.name}" data-value="${v}" ${ro ? raw('data-readonly="1"') : ''}></div>`; break;
    case 'password':
      input = html`<input class="input" type="password" id="${id}" name="${f.name}" autocomplete="new-password" ${ro ? raw('readonly') : ''}>`; break;
    case 'money':
    case 'number':
      input = html`<input class="input" type="text" inputmode="decimal" id="${id}" name="${f.name}" value="${v}" ${ro ? raw('readonly') : ''} style="text-align:right">`; break;
    default: {
      const t = { date: 'date', time: 'time', datetime: 'datetime-local', email: 'email', tel: 'tel' }[f.type] || 'text';
      const val = f.type === 'datetime' && v ? String(v).replace(' ', 'T').slice(0, 16) : (f.type === 'time' && v ? String(v).slice(0, 5) : v);
      input = html`<input class="input" type="${t}" id="${id}" name="${f.name}" value="${val}" ${ro ? raw('readonly') : ''}>`;
    }
  }
  return html`<div class="field c${f.col || 2}"><label for="${id}">${f.label}${req}</label>${input}${f.help ? html`<div class="help">${f.help}</div>` : ''}</div>`;
}

export function formHtml(fields, data = {}, opts = {}) {
  return html`<div class="form-grid">${fields.filter((f) => !f.hidden).map((f) => html`${f.section ? html`<div class="form-section">${f.section}</div>` : ''}${fieldHtml(f, data[f.name], opts)}`)}</div>`;
}

export function readForm(root, fields) {
  const out = {};
  for (const f of fields) {
    if (f.hidden || f.readonly) continue;
    const el = root.querySelector(`[name="${f.name}"]`);
    if (!el) continue;
    out[f.name] = el.value;
  }
  return out;
}

/** Searchable select backed by /api/lookup/<name>. */
export async function enhanceCombos(root, texts = {}) {
  const combos = $$('.combo[data-lookup]', root);
  await Promise.all(combos.map(async (c) => {
    if (c.dataset.ready) return;
    c.dataset.ready = '1';
    const name = c.dataset.name;
    const ro = c.dataset.readonly === '1';
    let items = [];
    try { items = await lookup(c.dataset.lookup); } catch { /* offline */ }
    const hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = name; hidden.value = c.dataset.value || '';
    const inp = document.createElement('input'); inp.className = 'input'; inp.autocomplete = 'off'; inp.id = `f-${name}`; inp.placeholder = ro ? '' : (c.dataset.placeholder || 'พิมพ์เพื่อค้นหา…');
    if (ro) inp.readOnly = true;
    const cur = items.find((i) => String(i.id) === hidden.value);
    inp.value = cur ? cur.text : (texts[name] || '');
    const list = document.createElement('div'); list.className = 'combo-list hidden';
    const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'clear'; clr.innerHTML = render(icon('x')); clr.tabIndex = -1;
    c.append(hidden, inp, list); if (!ro) c.append(clr);
    let hl = 0, shown = [];
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      const cur = items.find((i) => String(i.id) === hidden.value);
      shown = (!q || (cur && cur.text === inp.value) ? items : items.filter((i) => String(i.text).toLowerCase().includes(q))).slice(0, 80);
      hl = Math.max(0, shown.findIndex((i) => String(i.id) === hidden.value));
      list.innerHTML = shown.length ? shown.map((i, k) => `<div data-k="${k}" class="${k === hl ? 'hl' : ''}">${esc(i.text)}</div>`).join('') : '<div class="empty">ไม่พบข้อมูล</div>';
      list.classList.remove('hidden');
      list.querySelector('.hl')?.scrollIntoView({ block: 'nearest' });
    };
    const pick = (i) => {
      hidden.value = i ? i.id : ''; inp.value = i ? i.text : ''; list.classList.add('hidden');
      c.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: i }));
    };
    if (ro) return;
    inp.addEventListener('focus', () => { inp.select(); draw(); });
    inp.addEventListener('input', draw);
    inp.addEventListener('blur', () => setTimeout(() => {
      list.classList.add('hidden');
      const cur = items.find((i) => String(i.id) === hidden.value);
      if (!inp.value.trim()) { if (hidden.value) pick(null); } else if (cur) inp.value = cur.text;
      else if (!hidden.value) inp.value = '';
    }, 150));
    inp.addEventListener('keydown', (e) => {
      if (list.classList.contains('hidden')) return;
      if (e.key === 'ArrowDown') { hl = Math.min(shown.length - 1, hl + 1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { hl = Math.max(0, hl - 1); e.preventDefault(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown[hl]) pick(shown[hl]); return; }
      else if (e.key === 'Escape') { list.classList.add('hidden'); return; } else return;
      $$('div', list).forEach((d, k) => d.classList.toggle('hl', k === hl));
      list.children[hl]?.scrollIntoView({ block: 'nearest' });
    });
    list.addEventListener('mousedown', (e) => { const d = e.target.closest('[data-k]'); if (d) { e.preventDefault(); pick(shown[+d.dataset.k]); } });
    clr.addEventListener('click', () => { pick(null); inp.focus(); });
  }));
}

export function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> ${esc(label || 'กำลังบันทึก…')}`; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}

export const loadingHtml = () => html`<div class="loading"><div class="spinner"></div></div>`;
export const skeletonRows = (n = 6) => html`<div aria-busy="true">${Array.from({ length: n }, () => html`<div class="sk-row">${[1, 2, 3, 4, 5].map(() => html`<div class="skeleton sk-line"></div>`)}</div>`)}</div>`;
export const skeletonBlock = (h = 120) => html`<div class="skeleton" style="height:${h}px;border-radius:14px"></div>`;

/** Thai licence-plate chip: plate('3 ฒว 9217', 'กรุงเทพมหานคร') */
export const plate = (code, province = '', size = '') => code
  ? html`<span class="plate ${size}">${code}${province ? html`<small>${province}</small>` : ''}</span>`
  : html`<span class="muted">-</span>`;

/* ---------- inline form validation ---------- */
export function clearFieldErrors(root) {
  $$('.field-error', root).forEach((e) => e.remove());
  $$('.invalid', root).forEach((e) => e.classList.remove('invalid'));
}
export function showFieldError(root, name, msg) {
  const el = root.querySelector(`[name="${name}"]`);
  const field = el?.closest('.field');
  if (!field) return false;
  field.classList.add('invalid');
  field.querySelector('.field-error')?.remove();
  field.insertAdjacentHTML('beforeend', `<div class="field-error">${render(icon('alert'))}<span>${esc(msg)}</span></div>`);
  const focusEl = field.querySelector('input:not([type=hidden]), select, textarea');
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => focusEl?.focus({ preventScroll: true }), 250);
  return true;
}
/** Client-side check of required fields; returns true when the form is OK. */
export function checkRequired(root, fields) {
  clearFieldErrors(root);
  let first = null;
  for (const f of fields) {
    if (!f.required || f.hidden || f.readonly || f.type === 'password') continue;
    const el = root.querySelector(`[name="${f.name}"]`);
    if (el && !String(el.value).trim()) {
      const field = el.closest('.field');
      field?.classList.add('invalid');
      field?.insertAdjacentHTML('beforeend', `<div class="field-error">${render(icon('alert'))}<span>${['lookup', 'select', 'date', 'datetime', 'time'].includes(f.type) ? 'กรุณาเลือก' : 'กรุณากรอก'}${esc(f.label)}</span></div>`);
      first ||= f.name;
    }
  }
  if (first) { const el = root.querySelector(`[name="${first}"]`)?.closest('.field'); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.querySelector('input:not([type=hidden]), select, textarea')?.focus({ preventScroll: true }); }
  return !first;
}
/** Show an API error next to its field when the server says which one, else as a toast. */
export function formError(root, err) {
  if (!(err?.field && showFieldError(root, err.field, err.message))) toastError(err);
}
export const emptyHtml = (msg = 'ไม่พบข้อมูล', ic = 'inbox', sub = '') => html`<div class="empty-state"><div class="ic">${icon(ic)}</div><b>${msg}</b>${sub ? html`<div class="small">${sub}</div>` : ''}</div>`;

export function pager(total, page, per) {
  const pages = Math.max(1, Math.ceil(total / per));
  const from = total ? (page - 1) * per + 1 : 0;
  return html`<div class="pager"><span>แสดง ${fmtNum(from)}–${fmtNum(Math.min(total, page * per))} จาก ${fmtNum(total)} รายการ</span>
    <div class="row"><button class="btn btn-sm" data-page="${page - 1}" ${page <= 1 ? raw('disabled') : ''}>${icon('chevL')}</button>
    <span>หน้า ${page} / ${pages}</span>
    <button class="btn btn-sm" data-page="${page + 1}" ${page >= pages ? raw('disabled') : ''}>${icon('chevR')}</button></div></div>`;
}

export function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
