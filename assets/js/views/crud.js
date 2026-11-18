import {
  state, html, raw, mount, $, $$, icon, api, get, qs, fmtDate, fmtMoney, fmtNum, fmtTime, fmtRange, fmtDateTime, carBadge, expiryBadge, bookingBadge, emptyHtml, pager,
  debounce, toast, toastError, confirmBox, modal, formHtml, readForm, enhanceCombos, invalidateLookup, fileUrl, setBusy, today, initials, lightbox,
  skeletonRows, skeletonBlock, plate, checkRequired, formError, clearFieldErrors, daysUntil,
} from '../core.js';

const LOOKUP_OF = { car: 'car', driver: 'driver', user: 'user', depart: 'depart', faculty: 'faculty', province: 'province', brand: 'brand',
  cartype: 'cartype', oil: 'oil', insurer: 'insurer', leasing: 'leasing', garage: 'garage' };
const PEOPLE = ['user', 'driver'];
const DESCRIPTIONS = {
  car: 'ทะเบียนรถทั้งหมด สถานะ และวันหมดอายุเอกสาร', carwork: 'บันทึกการออกใช้รถ เลขไมล์ น้ำมัน และค่าใช้จ่าย',
  carfix: 'ประวัติการซ่อมบำรุงและค่าใช้จ่าย', insurance: 'การชำระเบี้ยประกันภัยรถ — วันหมดอายุของรถจะอัปเดตอัตโนมัติ',
  tabian: 'การต่อภาษีทะเบียนรถ — วันหมดอายุของรถจะอัปเดตอัตโนมัติ', plb: 'การต่อ พ.ร.บ. — วันหมดอายุของรถจะอัปเดตอัตโนมัติ',
  payleasing: 'การชำระค่างวดรถกับบริษัทสินเชื่อ', driver: 'รายชื่อพนักงานขับรถและใบขับขี่', user: 'บัญชีผู้ใช้งานและสิทธิ์การเข้าถึง',
  userdepart: 'กำหนดผู้มีสิทธิ์อนุมัติการจองของแต่ละแผนก', company: 'ข้อมูลองค์กรที่แสดงบนระบบและรายงาน', docprefix: 'รูปแบบการรันเลขที่เอกสาร',
};

export async function render(ctx) {
  const name = ctx.route.res;
  const meta = state.meta.resources[name];
  if (!meta || !meta.canRead) throw new Error('ไม่มีสิทธิ์เข้าถึงหน้านี้');
  meta.name = name;
  const id = ctx.route.id;
  if (id === null) return renderList(ctx, meta);
  return renderPage(ctx, meta, id === 'new' ? null : id);
}

const useModal = (m) => m.group === 'master' || m.name === 'userdepart';
const addLabel = (meta) => `เพิ่ม${meta.title.replace(/^ข้อมูล/, '')}`;
const personName = (r) => `${r.title || ''}${r.firstname || ''} ${r.surname || ''}`.trim();

function cell(f, r, meta) {
  const v = r[f.name];
  if (meta.name === 'car' && f.name === 'code') return plate(v, r.prov_code__t);
  if (PEOPLE.includes(meta.name) && f.name === 'firstname') {
    const pic = r.picture1 ? fileUrl(meta.uploadType, r.picture1) : '';
    return html`<span class="person"><span class="avatar">${pic ? html`<img src="${pic}" alt="" loading="lazy">` : initials(r)}</span>
      <span><span style="color:var(--text);font-weight:500">${personName(r)}</span>${r.nickname ? html`<span class="sub">${r.nickname}</span>` : ''}</span></span>`;
  }
  switch (f.type) {
    case 'lookup': return r[`${f.name}__t`] || html`<span class="faint">-</span>`;
    case 'select':
      if (f.name === 'status' && f.options[3] === 'ยกเลิกใช้') return carBadge(v);
      if (f.name === 'status' || f.name === 'member_type') return html`<span class="badge ${String(v) === '0' ? (f.name === 'status' ? 'tone-success' : 'tone-gray') : (f.name === 'status' ? 'tone-danger' : 'tone-primary')}">${f.options[v] ?? ''}</span>`;
      return f.options[v] ?? '';
    case 'date': return /date_e_|^datee$|^datet$/.test(f.name) ? expiryBadge(v) : fmtDate(v);
    case 'money': return fmtMoney(v);
    case 'number': return fmtNum(v, 2);
    case 'time': return fmtTime(`2000-01-01 ${v}`);
    default: return v ?? '';
  }
}

/* ======================= list ======================= */
async function renderList({ root, setTitle, setActions, alive }, meta) {
  setTitle(meta.title, DESCRIPTIONS[meta.name] || (meta.canWrite ? `จัดการข้อมูล${meta.title}` : 'ดูข้อมูลอย่างเดียว'));
  const people = PEOPLE.includes(meta.name);
  const isCar = meta.name === 'car';
  const skip = new Set([...(isCar ? ['prov_code'] : []), ...(people ? ['surname'] : [])]);
  const cols = meta.fields.filter((f) => f.list && !skip.has(f.name));
  const st = { q: '', page: 1, sort: '', dir: '', f: {} };
  const statusField = meta.fields.find((f) => f.name === 'status' && f.type === 'select');
  const hasThumb = isCar;
  const canAdd = meta.canWrite && !meta.noCreate;
  setActions(canAdd ? html`<button class="btn btn-primary" id="add">${icon('plus')} ${addLabel(meta)}</button>` : '');

  mount(root, html`<div class="card">
    <div class="toolbar">
      ${meta.searchable ? html`<div class="search">${icon('search')}<input class="input" id="q" type="search" placeholder="ค้นหา${meta.title}…" autocomplete="off" aria-label="ค้นหา"></div>` : ''}
      ${statusField ? html`<select class="input" id="fstatus" style="width:auto" aria-label="กรองสถานะ"><option value="">ทุกสถานะ</option>
        ${Object.entries(statusField.options).map(([k, t]) => html`<option value="${k}">${t}</option>`)}</select>` : ''}
      <span class="meta" id="count"></span>
    </div>
    <div id="list">${skeletonRows(8)}</div>
  </div>`);

  async function load() {
    const params = { q: st.q, page: st.page, sort: st.sort, dir: st.dir };
    for (const [k, v] of Object.entries(st.f)) params[`f[${k}]`] = v;
    const data = await get(`r/${meta.name}?${qs(params)}`);
    if (!alive()) return;
    mount($('#count', root), html`${fmtNum(data.total)} รายการ`);
    const box = $('#list', root);
    if (!data.rows.length) {
      mount(box, st.q || st.f.status ? emptyHtml('ไม่พบข้อมูลที่ค้นหา', 'search', 'ลองเปลี่ยนคำค้นหรือตัวกรอง')
        : emptyHtml(`ยังไม่มี${meta.title}`, meta.icon, canAdd ? html`<button class="btn btn-primary btn-sm" style="margin-top:12px" data-add>${icon('plus')} ${addLabel(meta)}</button>` : ''));
      return;
    }
    mount(box, html`<div class="table-wrap"><table class="table cards"><thead><tr>
      ${hasThumb ? html`<th style="width:64px"></th>` : ''}
      ${cols.map((f) => html`<th class="sortable ${['money', 'number'].includes(f.type) ? 'num' : ''}" data-sort="${f.name}" aria-sort="${st.sort === f.name ? (st.dir === 'desc' ? 'descending' : 'ascending') : 'none'}">${f.name === 'firstname' && people ? 'ชื่อ-นามสกุล' : f.label}${st.sort === f.name ? html`<span class="sort">${st.dir === 'desc' ? '↓' : '↑'}</span>` : ''}</th>`)}
      ${meta.canWrite ? html`<th></th>` : ''}</tr></thead><tbody>
      ${data.rows.map((r) => html`<tr class="click" data-id="${r.id}" tabindex="0">
        ${hasThumb ? html`<td data-label="" class="thumb-cell">${r.picture1 ? html`<img class="thumb" loading="lazy" src="${fileUrl('car', r.picture1)}" alt="">`
          : html`<span class="thumb" style="display:grid;place-items:center;color:var(--faint)">${icon('car')}</span>`}</td>` : ''}
        ${cols.map((f, i) => html`<td data-label="${f.label}" class="${i === 0 ? 'primary' : ''} ${['money', 'number'].includes(f.type) ? 'num' : ''}">${cell(f, r, meta)}</td>`)}
        ${meta.canWrite ? html`<td class="actions">${!meta.noCreate ? html`<button class="btn btn-sm btn-ghost btn-danger btn-icon" data-del="${r.id}" title="ลบ" aria-label="ลบ">${icon('trash')}</button>` : ''}</td>` : ''}
      </tr>`)}</tbody></table></div>${pager(data.total, data.page, data.per)}`);
  }

  const open = (rid) => { if (useModal(meta)) openModal(meta, rid, load); else location.hash = `#/r/${meta.name}/${rid ?? 'new'}`; };
  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-add]')) { open(null); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      if (!await confirmBox('ต้องการลบรายการนี้หรือไม่? การลบไม่สามารถย้อนกลับได้', { ok: 'ลบ', danger: true })) return;
      try { await api('DELETE', `r/${meta.name}/${del.dataset.del}`); toast('ลบแล้ว'); invalidateLookup(LOOKUP_OF[meta.name]); load(); } catch (err) { toastError(err); }
      return;
    }
    const th = e.target.closest('[data-sort]');
    if (th) { st.dir = st.sort === th.dataset.sort && st.dir !== 'desc' ? 'desc' : 'asc'; st.sort = th.dataset.sort; load(); return; }
    const p = e.target.closest('[data-page]');
    if (p && !p.disabled) { st.page = +p.dataset.page; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const tr = e.target.closest('tr[data-id]');
    if (tr) open(+tr.dataset.id);
  });
  root.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') open(+tr.dataset.id); });
  $('#add')?.addEventListener('click', () => open(null));
  $('#q', root)?.addEventListener('input', debounce((e) => { st.q = e.target.value; st.page = 1; load(); }));
  $('#fstatus', root)?.addEventListener('change', (e) => { st.f.status = e.target.value; st.page = 1; load(); });
  await load();
}

/* ======================= modal form (small tables) ======================= */
async function openModal(meta, id, after) {
  const data = id ? await get(`r/${meta.name}/${id}`).catch(toastError) : {};
  if (id && !data) return;
  const m = modal({
    title: `${id ? 'แก้ไข' : 'เพิ่ม'}${meta.title}`, size: meta.fields.length <= 3 ? 'sm' : '',
    body: html`<form id="mf" novalidate>${formHtml(meta.fields, data, { readonly: !meta.canWrite })}<button type="submit" hidden></button></form>`,
    footer: meta.canWrite ? html`${id && !meta.noCreate ? html`<button class="btn btn-danger" id="mdel" style="margin-right:auto">${icon('trash')} ลบ</button>` : ''}
      <button class="btn" data-close>ยกเลิก</button><button class="btn btn-primary" id="save">${icon('check')} บันทึก</button>` : html`<button class="btn" data-close>ปิด</button>`,
  });
  const form = $('#mf', m.el);
  await enhanceCombos(form, textsOf(meta, data));
  form.querySelector('input:not([type=hidden]):not([readonly]), select, textarea')?.focus();
  form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('invalid'));
  const save = async (e) => {
    e?.preventDefault();
    if (!checkRequired(form, meta.fields)) return;
    const btn = $('#save', m.el); setBusy(btn, true);
    try {
      await api(id ? 'PUT' : 'POST', `r/${meta.name}${id ? `/${id}` : ''}`, readForm(form, meta.fields));
      invalidateLookup(LOOKUP_OF[meta.name]);
      toast('บันทึกแล้ว'); m.close(); after?.();
    } catch (err) { formError(form, err); setBusy(btn, false); }
  };
  form.addEventListener('submit', save);
  $('#save', m.el)?.addEventListener('click', save);
  $('#mdel', m.el)?.addEventListener('click', async () => {
    if (!await confirmBox('ต้องการลบรายการนี้หรือไม่?', { ok: 'ลบ', danger: true })) return;
    try { await api('DELETE', `r/${meta.name}/${id}`); invalidateLookup(LOOKUP_OF[meta.name]); toast('ลบแล้ว'); m.close(); after?.(); } catch (err) { toastError(err); }
  });
}

const textsOf = (meta, data) => Object.fromEntries(meta.fields.filter((f) => f.type === 'lookup').map((f) => [f.name, data[`${f.name}__t`]]));

/* ======================= full page form ======================= */
function galleryHtml(meta, data, ro) {
  return html`<div class="gallery" style="${meta.images.length === 1 ? 'grid-template-columns:160px' : ''}">
    ${meta.images.map((f, i) => html`<div class="slot ${data[f] ? 'has' : ''}" role="button" tabindex="0" data-img="${f}" data-src="${data[f] ? fileUrl(meta.uploadType, data[f]) : ''}" data-label="รูปที่ ${i + 1}"
        aria-label="${data[f] ? `ดูรูปที่ ${i + 1}` : `เพิ่มรูปที่ ${i + 1}`}" style="${data[f] ? `background-image:url('${fileUrl(meta.uploadType, data[f])}')` : ''}">
      ${data[f] ? html`<span>${icon('eye')} ดูรูปขนาดใหญ่</span>` : html`<div class="center">${icon(ro ? 'image' : 'upload')}<div>${ro ? `รูปที่ ${i + 1}` : `เพิ่มรูปที่ ${i + 1}`}</div></div>`}
      ${ro ? '' : html`<input type="file" accept="image/*" hidden data-upload="${f}">`}</div>`)}
  </div>`;
}

function carSummary(data) {
  const pics = ['picture1', 'picture2', 'picture3', 'picture4', 'picture5'].filter((k) => data[k]);
  const hero = pics[0] ? fileUrl('car', data[pics[0]]) : '';
  const s = data._stats || {};
  const exp = (label, d) => {
    const n = daysUntil(d);
    const tone = n === null ? 'gray' : n < 0 ? 'danger' : n <= 30 ? 'warning' : 'success';
    return html`<div class="fact"><small>${label}</small><b>${d ? fmtDate(d) : '-'}</b><div style="margin-top:4px">${d ? html`<span class="badge tone-${tone}">${n < 0 ? `หมดอายุ ${fmtNum(-n)} วัน` : n <= 30 ? `อีก ${n} วัน` : 'ปกติ'}</span>` : html`<span class="badge tone-gray">ไม่มีข้อมูล</span>`}</div></div>`;
  };
  return html`<div class="card summary">
    <div class="hero ${hero ? '' : 'empty'}" id="hero" style="${hero ? `background-image:url('${hero}')` : ''}" ${hero ? raw('role="button" tabindex="0" aria-label="ดูรูปรถขนาดใหญ่"') : ''}>
      ${hero ? html`<span class="cnt">${icon('image')} ${pics.length} รูป</span>` : icon('car')}</div>
    <div class="info">
      <div class="row" style="gap:14px">${plate(data.code, data.prov_code__t, 'lg')}
        <div class="grow"><div style="font-size:1.1rem;font-weight:600">${[data.brand_id__t, data.model].filter(Boolean).join(' ') || '-'}</div>
        <div class="muted small">${[data.cartype_id__t, data.carno && `รหัส ${data.carno}`, data.color && `สี${data.color}`, +data.seats ? `${data.seats} ที่นั่ง` : ''].filter(Boolean).join(' · ')}</div></div>
        ${carBadge(data.status)}</div>
      <div class="facts">
        ${exp('ภาษี / ทะเบียน', data.date_e_code)}${exp('พ.ร.บ.', data.date_e_cpi)}${exp('ประกันภัย', data.date_e_insure)}
        <div class="fact"><small>การใช้งาน</small><b>${fmtNum(s.bookings || 0)} ครั้ง</b><div class="muted xs" style="margin-top:4px">${s.last_used ? `ล่าสุด ${fmtDate(s.last_used)}` : 'ยังไม่เคยใช้'}${s.repairs ? ` · ซ่อม ${s.repairs} ครั้ง` : ''}</div></div>
      </div>
    </div></div>`;
}

async function renderPage({ root, setTitle, setActions, alive, route }, meta, id) {
  mount(root, html`<div class="stack">${skeletonBlock(meta.name === 'car' && id ? 210 : 60)}${skeletonBlock(360)}</div>`);
  let data = {};
  if (id) data = await get(`r/${meta.name}/${id}`);
  else {
    for (const f of meta.fields) if (f.default === 'today') data[f.name] = today();
    if (meta.name === 'carwork' && route.q?.booking) data = { ...data, ...(await prefillFromBooking(route.q.booking)) };
  }
  if (!alive()) return;
  const ro = !meta.canWrite;
  const isCar = meta.name === 'car';
  const titleText = id ? (data.docno || (data.firstname ? personName(data) : '') || data.code || data.name || data.docname || `#${id}`) : addLabel(meta);
  setTitle(titleText, id ? (isCar ? 'ข้อมูลรถ เอกสาร และประวัติการใช้งาน' : `${ro ? 'ดู' : 'แก้ไข'}${meta.title}`) : DESCRIPTIONS[meta.name] || '');
  setActions(isCar && id ? html`<a class="btn" href="#/calendar?car=${id}">${icon('calendar')} ปฏิทินรถคันนี้</a><a class="btn btn-primary" href="#/booking/new?car=${id}">${icon('plus')} จองรถคันนี้</a>`
    : !id || ro ? '' : html`<a class="btn" href="#/r/${meta.name}/new">${icon('plus')} ${addLabel(meta)}</a>`);

  const showGallery = meta.images?.length && id;
  const nPics = (meta.images || []).filter((k) => data[k]).length;
  const tabs = isCar && id ? [
    ['info', 'layers', 'ข้อมูลรถ', ''], ['photos', 'image', 'รูปภาพ', nPics], ['files', 'file', 'เอกสาร', data._files.length], ['history', 'history', 'ประวัติการจอง', data._bookings.length],
  ] : null;

  const formCard = html`<div class="card" data-pane="info">
      ${tabs ? '' : html`<div class="card-h"><h2 class="grow">${meta.title}</h2>${data.docno ? html`<span class="badge tone-gray plain">${data.docno}</span>` : ''}</div>`}
      ${showGallery && !tabs ? html`<div class="card-b" style="border-bottom:1px solid var(--border)"><p class="section-title">รูปภาพ</p>${galleryHtml(meta, data, ro)}</div>` : ''}
      <div class="card-b">${formHtml(meta.fields, data, { readonly: ro })}</div>
      ${meta.children ? html`<div class="card-b" style="border-top:1px solid var(--border)">
        <div class="row between" style="margin-bottom:12px"><h3>${meta.childrenTitle}</h3>${ro ? '' : html`<button type="button" class="btn btn-sm" id="add-item">${icon('plus')} เพิ่มรายการ</button>`}</div>
        <div class="table-wrap" style="border:1px solid var(--border);border-radius:10px"><table class="table items-table"><thead><tr>${meta.children.map((f) => html`<th>${f.label}</th>`)}<th class="num">รวม</th><th></th></tr></thead>
        <tbody id="items"></tbody><tfoot><tr><td colspan="${meta.children.length}" class="right">รวมทั้งสิ้น</td><td class="num" id="items-total"></td><td></td></tr></tfoot></table></div></div>` : ''}
      <div class="card-f sticky">
        ${id && !ro && !meta.noCreate ? html`<button type="button" class="btn btn-danger" id="del">${icon('trash')} ลบ</button>` : ''}
        <span class="grow muted xs" id="dirty"></span>
        <a class="btn" href="#/r/${meta.name}">${ro ? 'กลับ' : 'ยกเลิก'}</a>
        ${ro ? '' : html`<button class="btn btn-primary" type="submit">${icon('check')} ${id ? 'บันทึกการเปลี่ยนแปลง' : 'บันทึก'}</button>`}
      </div>
    </div>`;

  mount(root, html`<form id="pf" class="stack" novalidate>
    ${isCar && id ? carSummary(data) : ''}
    ${tabs ? html`<div class="card" style="overflow:hidden"><div class="tabline" role="tablist">${tabs.map(([k, ic, label, n], i) => html`<button type="button" role="tab" data-tab="${k}" class="${i === 0 ? 'on' : ''}" aria-selected="${i === 0}">${icon(ic)} ${label}${n !== '' ? html`<span class="n">${n}</span>` : ''}</button>`)}</div></div>` : ''}
    ${formCard}
    ${tabs ? html`
      <div class="card hidden" data-pane="photos"><div class="card-h"><h2 class="grow">รูปภาพรถ</h2><span class="muted small">คลิกรูปเพื่อดูขนาดใหญ่${ro ? '' : ' · คลิกช่องว่างเพื่ออัปโหลด'}</span></div><div class="card-b">${galleryHtml(meta, data, ro)}</div></div>
      <div class="card hidden" data-pane="files"><div class="card-h"><h2 class="grow">ไฟล์เอกสารรถ</h2>
          ${ro ? '' : html`<label class="btn btn-sm btn-primary">${icon('upload')} อัปโหลดไฟล์<input type="file" hidden id="carfile" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"></label>`}</div>
        <div class="list">${data._files.length ? data._files.map((f) => html`<div class="list-item">
          <span class="ic tone-info">${icon('file')}</span>
          <div class="grow"><a href="${fileUrl('car', f.filename, f.oldfilename)}" target="_blank" rel="noopener" class="truncate" style="display:block">${f.oldfilename || f.filename}</a><div class="meta">${f.comment || ''}</div></div>
          ${ro ? '' : html`<button type="button" class="btn btn-sm btn-ghost btn-danger btn-icon" data-delfile="${f.id}" aria-label="ลบไฟล์">${icon('trash')}</button>`}</div>`) : emptyHtml('ยังไม่มีไฟล์เอกสาร', 'file', 'เช่น เล่มทะเบียน กรมธรรม์ ใบเสร็จภาษี')}</div></div>
      <div class="card hidden" data-pane="history"><div class="card-h"><h2 class="grow">ประวัติการจองล่าสุด</h2><a class="btn btn-sm btn-ghost" href="#/calendar?car=${id}">ดูบนปฏิทิน ${icon('chevR')}</a></div>
        <div class="list">${data._bookings.length ? data._bookings.map((b) => html`<a class="list-item" href="#/booking/${b.id}">
          <div class="grow"><div class="truncate"><b>${b.docno}</b> · ${b.working}</div><div class="meta">${fmtRange(b.start_date, b.end_date)}${b.person_name ? ` · ${b.person_name}` : ''}${b.depart ? ` · ${b.depart}` : ''}</div></div>
          ${bookingBadge(b.status)}</a>`) : emptyHtml('ยังไม่มีประวัติการจอง', 'history')}</div></div>` : ''}
  </form>`);

  const form = $('#pf', root);
  await enhanceCombos(form, textsOf(meta, data));

  /* tabs */
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    $$('[data-tab]', root).forEach((b) => { b.classList.toggle('on', b === t); b.setAttribute('aria-selected', String(b === t)); });
    $$('[data-pane]', root).forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== t.dataset.tab));
  });
  $('#hero', root)?.addEventListener('click', () => {
    const pics = (meta.images || []).filter((k) => data[k]);
    lightbox(pics.map((k, i) => ({ src: fileUrl('car', data[k]), caption: `${titleText} · รูปที่ ${i + 1}` })), 0);
  });

  /* dirty indicator */
  let dirty = false;
  form.addEventListener('input', (e) => {
    e.target.closest('.field')?.classList.remove('invalid');
    e.target.closest('.field')?.querySelector('.field-error')?.remove();
    if (!dirty && !ro && e.target.closest('[data-pane="info"]')) { dirty = true; mount($('#dirty', root), html`มีการแก้ไขที่ยังไม่บันทึก`); }
  });

  /* child items (carfix) */
  const items = [...(data._items || [])];
  const num = (v) => +String(v ?? 0).replace(/,/g, '') || 0;
  const drawItems = () => {
    if (!meta.children) return;
    mount($('#items', root), items.length ? html`${items.map((it, k) => html`<tr data-k="${k}">
      ${meta.children.map((f) => html`<td><input class="input" data-f="${f.name}" value="${it[f.name] ?? ''}" aria-label="${f.label}" ${ro ? raw('readonly') : ''} ${['money', 'number'].includes(f.type) ? raw('inputmode="decimal" style="text-align:right;width:110px"') : ''}></td>`)}
      <td class="num">${fmtMoney(num(it.qty) * num(it.price))}</td>
      <td>${ro ? '' : html`<button type="button" class="btn btn-sm btn-ghost btn-danger btn-icon" data-rm="${k}" aria-label="ลบรายการ">${icon('x')}</button>`}</td></tr>`)}`
      : html`<tr><td colspan="${meta.children.length + 2}" class="muted center" style="padding:20px">ยังไม่มีรายการ${ro ? '' : ' — กด “เพิ่มรายการ”'}</td></tr>`);
    $('#items-total', root).textContent = fmtMoney(items.reduce((s, it) => s + num(it.qty) * num(it.price), 0));
  };
  if (meta.children) {
    drawItems();
    $('#add-item', root)?.addEventListener('click', () => { items.push({ qty: 1 }); drawItems(); $('#items tr:last-child input', root)?.focus(); });
    $('#items', root).addEventListener('input', (e) => {
      const inp = e.target.closest('[data-f]'); if (!inp) return;
      const k = +inp.closest('tr').dataset.k; items[k][inp.dataset.f] = inp.value;
      if (['qty', 'price'].includes(inp.dataset.f)) {
        inp.closest('tr').children[meta.children.length].textContent = fmtMoney(num(items[k].qty) * num(items[k].price));
        $('#items-total', root).textContent = fmtMoney(items.reduce((s, it) => s + num(it.qty) * num(it.price), 0));
      }
    });
    $('#items', root).addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { items.splice(+b.dataset.rm, 1); drawItems(); } });
  }

  /* carwork: auto calculate */
  if (meta.name === 'carwork') {
    const calc = () => {
      const g = (n) => form.querySelector(`[name="${n}"]`);
      const s = g('start_date').value, e = g('end_date').value;
      const rate = num(g('car_rate').value);
      if (s && e && rate) {
        const st = new Date(`${s}T${g('start_time').value || '00:00'}`), en = new Date(`${e}T${g('end_time').value || '00:00'}`);
        g('car_money').value = (rate * Math.max(0, Math.round((en - st) / 60000))).toFixed(2);
      }
    };
    ['start_date', 'end_date', 'start_time', 'end_time', 'car_rate'].forEach((n) => form.querySelector(`[name="${n}"]`)?.addEventListener('change', calc));
    form.querySelector('.combo[data-name="car_id"]')?.addEventListener('change', (e) => {
      if (e.detail && e.detail.rate !== undefined) { form.querySelector('[name="car_rate"]').value = e.detail.rate; calc(); }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (ro) return;
    if (tabs) $('[data-tab="info"]', root).click();
    if (!checkRequired(form, meta.fields)) { toast('กรุณากรอกข้อมูลที่จำเป็นให้ครบ', 'err'); return; }
    const payload = readForm(form, meta.fields);
    if (meta.name === 'carwork' && data.booking_id) payload.booking_id = data.booking_id;
    if (meta.children) payload._items = items;
    const btn = e.submitter || $('button[type=submit]', form); setBusy(btn, true);
    try {
      const saved = await api(id ? 'PUT' : 'POST', `r/${meta.name}${id ? `/${id}` : ''}`, payload);
      invalidateLookup(LOOKUP_OF[meta.name]);
      clearFieldErrors(form);
      dirty = false; mount($('#dirty', root), html`บันทึกล่าสุดเวลา ${fmtTime(new Date())} น.`);
      toast(saved.docno && !id ? `บันทึกแล้ว เลขที่ ${saved.docno}` : 'บันทึกแล้ว');
      if (!id) location.hash = `#/r/${meta.name}/${saved.id}`; else setBusy(btn, false);
    } catch (err) { formError(form, err); setBusy(btn, false); }
  });
  $('#del', root)?.addEventListener('click', async () => {
    if (!await confirmBox('ต้องการลบรายการนี้หรือไม่? การลบไม่สามารถย้อนกลับได้', { ok: 'ลบ', danger: true })) return;
    try { await api('DELETE', `r/${meta.name}/${id}`); invalidateLookup(LOOKUP_OF[meta.name]); toast('ลบแล้ว'); location.hash = `#/r/${meta.name}`; } catch (err) { toastError(err); }
  });

  /* image uploads */
  root.addEventListener('change', async (e) => {
    const up = e.target.closest('[data-upload]');
    if (up && up.files[0]) {
      const fd = new FormData(); fd.append('file', await shrinkImage(up.files[0]));
      const slot = up.closest('.slot'); slot.style.opacity = '.5';
      try {
        const r = await api('POST', `r/${meta.name}/${id}/image/${up.dataset.upload}`, fd);
        const src = fileUrl(meta.uploadType, r.file);
        slot.style.backgroundImage = `url('${src}')`; slot.dataset.src = src; slot.classList.add('has');
        slot.querySelector('.center')?.replaceWith(Object.assign(document.createElement('span'), { innerHTML: `${icon('eye').__raw} ดูรูปขนาดใหญ่` }));
        toast('อัปโหลดรูปแล้ว');
      } catch (err) { toastError(err); }
      slot.style.opacity = '';
      up.value = '';
    }
    if (e.target.id === 'carfile' && e.target.files[0]) {
      const r = await confirmBox(`อัปโหลด “${e.target.files[0].name}”`, { ok: 'อัปโหลด', input: 'คำอธิบายไฟล์ เช่น เล่มทะเบียน, กรมธรรม์' });
      if (!r) { e.target.value = ''; return; }
      const fd = new FormData(); fd.append('file', e.target.files[0]); fd.append('comment', r.value);
      try { await api('POST', `carfile/${id}`, fd); toast('อัปโหลดแล้ว'); renderPage({ root, setTitle, setActions, alive, route }, meta, id); } catch (err) { toastError(err); }
    }
  });
  /* gallery: photo -> large popup, empty slot -> upload */
  const openSlot = (slot) => {
    const input = slot.querySelector('[data-upload]');
    if (!slot.dataset.src) { input?.click(); return; }
    const slots = $$('.slot[data-src]', slot.parentElement).filter((s) => s.dataset.src);
    lightbox(slots.map((s) => ({ src: s.dataset.src, caption: `${titleText} · ${s.dataset.label}` })), slots.indexOf(slot), {
      onReplace: ro ? null : (i) => slots[i].querySelector('[data-upload]')?.click(),
    });
  };
  root.addEventListener('keydown', (e) => {
    const slot = e.target.closest('.slot[data-img]');
    if (slot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openSlot(slot); }
    if (e.target.id === 'hero' && e.key === 'Enter') e.target.click();
  });
  root.addEventListener('click', async (e) => {
    const slot = e.target.closest('.slot[data-img]');
    if (slot && !e.target.closest('input')) { openSlot(slot); return; }
    const b = e.target.closest('[data-delfile]');
    if (!b) return;
    if (!await confirmBox('ลบไฟล์นี้?', { ok: 'ลบ', danger: true })) return;
    try { await api('DELETE', `carfile/${b.dataset.delfile}`); b.closest('.list-item').remove(); toast('ลบไฟล์แล้ว'); } catch (err) { toastError(err); }
  });
}

async function prefillFromBooking(bid) {
  try {
    const b = await get(`booking/${bid}`);
    const [sd, stime] = String(b.start_date).split(' ');
    const [ed, etime] = String(b.end_date).split(' ');
    return {
      booking_id: b.id, car_id: b.car_id, car_id__t: b.car_id__t, working: b.working, start_date: sd, start_time: stime?.slice(0, 5),
      end_date: ed, end_time: etime?.slice(0, 5), driver_id: b.driver_id, driver_id__t: b.driver_id__t, depart_id: b.depart_id, depart_id__t: b.depart_id__t,
      person_name: b.person_name, tel: b.tel, address: b.address, province: b.province, passenger_amount: b.passenger_amount, passenger_name: b.passenger_name,
      car_rate: b.car_rate, car_money: b.car_money, docref: b.docno,
    };
  } catch { return {}; }
}

/** Resize big phone photos before upload (max 1600px, JPEG). */
async function shrinkImage(file) {
  if (!file.type.startsWith('image/') || file.size < 600 * 1024 || !window.createImageBitmap) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
