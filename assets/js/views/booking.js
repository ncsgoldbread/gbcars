import {
  state, html, raw, mount, $, $$, icon, api, get, qs, fmtDate, fmtDateTime, fmtRange, fmtMoney, fmtNum, bookingBadge, parseDate,
  loadingHtml, emptyHtml, pager, debounce, toast, toastError, confirmBox, modal, enhanceCombos, fileUrl, setBusy, fullName, today, lightbox,
} from '../core.js';

const SCOPES = {
  mine: { title: 'รายการจองของฉัน', crumbs: 'การจองที่คุณสร้าง' },
  approve: { title: 'งานรออนุมัติ', crumbs: 'คำขอใช้รถของแผนกที่คุณเป็นผู้อนุมัติ' },
  return: { title: 'รับคืนรถ', crumbs: 'รายการที่ผู้ใช้ส่งคืนรถแล้ว รอยืนยันรับคืน' },
  all: { title: 'รายการจองทั้งหมด', crumbs: 'ทุกการจองในแผนกที่คุณดูแล' },
};

export async function render(ctx) {
  const r = ctx.route;
  if (r.mode === 'form') return renderForm(ctx, r.id);
  if (r.mode === 'detail') return renderDetail(ctx, r.id);
  return renderList(ctx, r.scope);
}

/* ======================= list ======================= */
async function renderList({ root, setTitle, alive }, scope) {
  const s = SCOPES[scope];
  setTitle(s.title, s.crumbs);
  const f = { q: '', status: '', from: '', to: '', page: 1 };
  const statuses = state.meta.bookingStatus;
  mount(root, html`<div class="card">
    <div class="toolbar">
      <div class="search">${icon('search')}<input class="input" id="q" placeholder="ค้นหาเลขที่ ภารกิจ ผู้ขอ ทะเบียน…"></div>
      ${scope === 'mine' || scope === 'all' ? html`<select class="input" id="status" style="width:auto"><option value="">ทุกสถานะ</option>
        ${Object.entries(statuses).filter(([k]) => k !== '9').map(([k, t]) => html`<option value="${k}">${t}</option>`)}</select>` : ''}
      <input class="input" type="date" id="from" style="width:auto" title="ตั้งแต่วันที่">
      <input class="input" type="date" id="to" style="width:auto" title="ถึงวันที่">
      <span class="grow"></span>
      <a class="btn btn-primary" href="#/booking/new">${icon('plus')} จองรถ</a>
    </div>
    <div id="list">${loadingHtml()}</div>
  </div>`);

  async function load() {
    const data = await get(`booking?${qs({ scope, ...f })}`);
    if (!alive()) return;
    const box = $('#list', root);
    if (!data.rows.length) { mount(box, emptyHtml(scope === 'approve' ? 'ไม่มีงานรออนุมัติ 🎉' : 'ไม่พบรายการจอง')); return; }
    mount(box, html`<div class="table-wrap"><table class="table cards"><thead><tr>
        <th>เลขที่</th><th>ช่วงเวลา</th><th>รถ</th><th>ภารกิจ</th><th>แผนก / ผู้ขอ</th><th>สถานะ</th></tr></thead><tbody>
      ${data.rows.map((b) => html`<tr class="click" data-id="${b.id}">
        <td class="primary nowrap" data-label="เลขที่">${b.docno}</td>
        <td data-label="ช่วงเวลา">${fmtRange(b.start_date, b.end_date)}</td>
        <td data-label="รถ">${b.car_id__t || '-'}</td>
        <td data-label="ภารกิจ">${b.working}${b.province ? html`<div class="muted small">${icon('pin', 'sm')} ${b.province}</div>` : ''}</td>
        <td data-label="แผนก / ผู้ขอ">${b.depart_id__t || ''}<div class="muted small">${b.person_name || b.user_save_id__t || ''}</div></td>
        <td data-label="สถานะ">${bookingBadge(b.status)}</td></tr>`)}
      </tbody></table></div>${pager(data.total, data.page, data.per)}`);
  }
  root.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) location.hash = `#/booking/${tr.dataset.id}`;
    const p = e.target.closest('[data-page]');
    if (p && !p.disabled) { f.page = +p.dataset.page; load(); }
  });
  $('#q', root).addEventListener('input', debounce((e) => { f.q = e.target.value; f.page = 1; load(); }));
  ['status', 'from', 'to'].forEach((k) => $(`#${k}`, root)?.addEventListener('change', (e) => { f[k] = e.target.value; f.page = 1; load(); }));
  await load();
}

/* ======================= form ======================= */
async function renderForm({ root, setTitle, alive, route }, id) {
  setTitle(id ? 'แก้ไขการจอง' : 'จองใช้รถ', id ? '' : 'เลือกช่วงเวลา → เลือกรถที่ว่าง → กรอกรายละเอียด');
  mount(root, loadingHtml());
  const u = state.user;
  let b = {
    start_date: `${route.q?.date || today()} 08:00`, end_date: `${route.q?.date || today()} 17:00`,
    depart_id: u.depart_id || '', person_name: fullName(u), tel: u.tel || '', car_id: route.q?.car || '',
  };
  if (id) {
    b = await get(`booking/${id}`);
    if (!b._can.edit) { mount(root, html`<div class="alert warn">${icon('alert')} รายการนี้ไม่สามารถแก้ไขได้แล้ว</div>`); return; }
  }
  if (!alive()) return;
  const dt = (v) => (v ? String(v).replace(' ', 'T').slice(0, 16) : '');

  mount(root, html`<form id="bf" class="stack" novalidate>
    <div class="card">
      <div class="card-h"><span class="badge tone-primary plain">1</span><h2>ช่วงเวลาที่ต้องการใช้รถ</h2></div>
      <div class="card-b"><div class="form-grid">
        <div class="field c1"><label for="start">เริ่ม<span class="req">*</span></label><input class="input" type="datetime-local" id="start" name="start_date" value="${dt(b.start_date)}" required></div>
        <div class="field c1"><label for="end">สิ้นสุด<span class="req">*</span></label><input class="input" type="datetime-local" id="end" name="end_date" value="${dt(b.end_date)}" required></div>
        <div class="field c2"><label>ระยะเวลา</label><div id="dur" class="input" style="display:flex;align-items:center;background:var(--surface-2)"></div></div>
      </div></div>
    </div>
    <div class="card">
      <div class="card-h"><span class="badge tone-primary plain">2</span><h2 class="grow">เลือกรถ</h2>
        <div class="search" style="width:min(260px,100%)">${icon('search')}<input class="input" id="carq" placeholder="ค้นหาทะเบียน/รุ่น"></div>
        <label class="row small" style="gap:6px"><input type="checkbox" id="onlyfree" checked> เฉพาะรถว่าง</label></div>
      <div class="card-b"><input type="hidden" name="car_id" id="car_id" value="${b.car_id || ''}"><div id="cars">${loadingHtml()}</div></div>
    </div>
    <div class="card">
      <div class="card-h"><span class="badge tone-primary plain">3</span><h2>รายละเอียดการใช้รถ</h2></div>
      <div class="card-b"><div class="form-grid">
        <div class="field c4"><label for="working">ภารกิจ / วัตถุประสงค์<span class="req">*</span></label><input class="input" id="working" name="working" value="${b.working || ''}" required placeholder="เช่น ส่งสินค้า, ติดต่อลูกค้า, ประชุม"></div>
        <div class="field c2"><label>แผนก<span class="req">*</span></label><div class="combo" data-lookup="depart" data-name="depart_id" data-value="${b.depart_id || ''}"></div></div>
        <div class="field c1"><label for="person_name">ผู้ขอใช้รถ</label><input class="input" id="person_name" name="person_name" value="${b.person_name || ''}"></div>
        <div class="field c1"><label for="tel">โทรศัพท์</label><input class="input" type="tel" id="tel" name="tel" value="${b.tel || ''}"></div>
        <div class="field c2"><label for="address">สถานที่ไป</label><input class="input" id="address" name="address" value="${b.address || ''}"></div>
        <div class="field c1"><label for="aumphur">อำเภอ</label><input class="input" id="aumphur" name="aumphur" value="${b.aumphur || ''}"></div>
        <div class="field c1"><label>จังหวัด</label><input class="input" name="province" list="provinces" value="${b.province || ''}"><datalist id="provinces"></datalist></div>
        <div class="field c1"><label for="pa">จำนวนผู้โดยสาร</label><input class="input" type="number" min="0" id="pa" name="passenger_amount" value="${b.passenger_amount ?? ''}"></div>
        <div class="field c3"><label for="pn">รายชื่อผู้โดยสาร</label><input class="input" id="pn" name="passenger_name" value="${b.passenger_name || ''}"></div>
        <div class="field c2"><label>พนักงานขับรถ <span class="muted small">(ถ้ามี)</span></label><div class="combo" data-lookup="driver" data-name="driver_id" data-value="${b.driver_id || ''}"></div></div>
        <div class="field c2"><label for="docref">เลขที่อ้างอิง</label><input class="input" id="docref" name="docref" value="${b.docref || ''}"></div>
        <div class="field c4"><label for="comment">หมายเหตุ</label><textarea class="input" id="comment" name="comment">${b.comment || ''}</textarea></div>
      </div></div>
      <div class="card-f"><span class="grow muted small" id="money"></span>
        <a class="btn" href="${id ? `#/booking/${id}` : '#/booking'}">ยกเลิก</a>
        <button class="btn btn-primary" type="submit">${icon('check')} ${id ? 'บันทึกการแก้ไข' : 'ส่งคำขอจอง'}</button></div>
    </div>
  </form>`);
  const form = $('#bf', root);
  enhanceCombos(form, { depart_id: b.depart_id__t, driver_id: b.driver_id__t });
  get('lookup/province').then((ps) => mount($('#provinces', root), html`${ps.map((p) => html`<option value="${p.text}">`)}`)).catch(() => {});

  let cars = [];
  const sel = () => cars.find((c) => String(c.id) === $('#car_id', root).value);
  const minutes = () => {
    const s = parseDate($('#start', root).value), e = parseDate($('#end', root).value);
    return s && e ? Math.round((e - s) / 60000) : 0;
  };
  const updateInfo = () => {
    const m = minutes();
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    mount($('#dur', root), m > 0 ? html`${d ? `${d} วัน ` : ''}${h ? `${h} ชั่วโมง ` : ''}${mm ? `${mm} นาที` : ''}` : html`<span style="color:var(--danger)">เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม</span>`);
    const c = sel();
    mount($('#money', root), c && +c.rate > 0 && m > 0 ? html`ค่าใช้รถโดยประมาณ <b>${fmtMoney(c.rate * m)}</b> บาท (${fmtMoney(c.rate)} บาท/นาที)` : '');
  };
  const drawCars = () => {
    const q = $('#carq', root).value.trim().toLowerCase();
    const only = $('#onlyfree', root).checked;
    const cur = $('#car_id', root).value;
    const list = cars.filter((c) => (!only || c.available || String(c.id) === cur) && (!q || `${c.code} ${c.carno} ${c.model} ${c.brand} ${c.cartype}`.toLowerCase().includes(q)));
    mount($('#cars', root), list.length ? html`<div class="cars-pick">${list.map((c) => html`
      <button type="button" class="car-card ${String(c.id) === cur ? 'sel' : ''} ${c.available ? '' : 'busy'}" data-car="${c.id}" ${c.available ? '' : raw('aria-disabled="true"')}>
        <div class="ph" style="${c.picture1 ? `background-image:url('${fileUrl('car', c.picture1)}')` : ''}">${c.picture1 ? '' : icon('car')}</div>
        <div class="bd"><b>${c.code}</b><span class="muted">${[c.carno, c.brand, c.model].filter(Boolean).join(' · ')}</span>
        <div style="margin-top:4px">${c.available ? html`<span class="badge tone-success">ว่าง${c.seats ? ` · ${c.seats} ที่นั่ง` : ''}</span>`
          : c.busy ? html`<span class="badge tone-danger">ไม่ว่าง (${c.busy.docno})</span>` : html`<span class="badge tone-gray">${state.meta.carStatus[c.status]}</span>`}</div></div>
      </button>`)}</div>` : emptyHtml('ไม่มีรถว่างในช่วงเวลานี้ ลองเปลี่ยนเวลา', 'car'));
  };
  const loadCars = async () => {
    const s = $('#start', root).value, e = $('#end', root).value;
    if (!s || !e || minutes() <= 0) { updateInfo(); return; }
    try { cars = await get(`availability?${qs({ start: s, end: e, exclude: id || 0 })}`); } catch (err) { toastError(err); }
    if (!alive()) return;
    const c = sel();
    if (c && !c.available) toast(`รถ ${c.code} ไม่ว่างในช่วงเวลาที่เลือกแล้ว กรุณาเลือกคันอื่น`, 'err');
    drawCars(); updateInfo();
  };
  $('#start', root).addEventListener('change', () => {
    const s = parseDate($('#start', root).value), e = parseDate($('#end', root).value);
    if (s && (!e || e <= s)) { const n = new Date(s.getTime() + 9 * 3600000); $('#end', root).value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}T${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; }
    loadCars();
  });
  $('#end', root).addEventListener('change', loadCars);
  $('#carq', root).addEventListener('input', drawCars);
  $('#onlyfree', root).addEventListener('change', drawCars);
  $('#cars', root).addEventListener('click', (e) => {
    const c = e.target.closest('[data-car]');
    if (!c || c.getAttribute('aria-disabled')) return;
    $('#car_id', root).value = c.dataset.car;
    $$('.car-card', root).forEach((x) => x.classList.toggle('sel', x === c));
    updateInfo();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.car_id) return toast('กรุณาเลือกรถ', 'err');
    if (!data.working.trim()) { $('#working', root).focus(); return toast('กรุณาระบุภารกิจ', 'err'); }
    if (!data.depart_id) return toast('กรุณาเลือกแผนก', 'err');
    const btn = e.submitter; setBusy(btn, true);
    try {
      const saved = id ? await api('PUT', `booking/${id}`, data) : await api('POST', 'booking', data);
      toast(id ? 'บันทึกการแก้ไขแล้ว' : `ส่งคำขอจองแล้ว เลขที่ ${saved.docno}`);
      window.dispatchEvent(new Event('counts:refresh'));
      location.hash = `#/booking/${saved.id}`;
    } catch (err) { toastError(err); setBusy(btn, false); if (err.status === 409) loadCars(); }
  });
  await loadCars();
}

/* ======================= detail ======================= */
async function renderDetail({ root, setTitle, alive }, id) {
  mount(root, loadingHtml());
  let b = await get(`booking/${id}`);
  if (!alive()) return;
  if (b._can.approve && +b.status === 0) {
    api('POST', `booking/${id}/read`).then(() => window.dispatchEvent(new Event('counts:refresh'))).catch(() => {});
    b.status = 1;
  }
  setTitle(`ใบจอง ${b.docno}`, `สร้างเมื่อ ${fmtDateTime(b.date_create)} โดย ${b.user_save_id__t || '-'}`);
  const can = b._can;
  const st = +b.status;
  const step = (done, tone, ic, title, when, note) => html`<div class="t"><div class="dot tone-${done ? tone : 'gray'}">${icon(ic)}</div>
    <div><b>${title}</b><div class="muted small">${when || (done ? '' : 'รอดำเนินการ')}</div>${note ? html`<div class="small" style="margin-top:2px">${note}</div>` : ''}</div></div>`;

  mount(root, html`<div class="grid g-main">
    <div class="stack">
      <div class="card">
        <div class="card-h"><h2 class="grow">${b.working}</h2>${bookingBadge(b.status)}</div>
        <div class="card-b"><div class="dl">
          <div><small>ช่วงเวลา</small><span>${fmtRange(b.start_date, b.end_date)}</span></div>
          <div><small>รถ</small><span>${b.car_id ? html`<a href="#/r/car/${b.car_id}">${b.car_id__t}</a>` : '-'}</span></div>
          <div><small>พนักงานขับรถ</small><span>${b.driver_id__t?.trim() || 'ขับเอง / ไม่ระบุ'}${b.driver_tel ? ` · ${b.driver_tel}` : ''}</span></div>
          <div><small>แผนก</small><span>${b.depart_id__t || '-'}</span></div>
          <div><small>ผู้ขอใช้รถ</small><span>${b.person_name || '-'}${b.tel ? html` · <a href="tel:${b.tel}">${b.tel}</a>` : ''}</span></div>
          <div><small>สถานที่</small><span>${[b.address, b.tumbol, b.aumphur, b.province].filter(Boolean).join(' ') || '-'}</span></div>
          <div><small>ผู้โดยสาร</small><span>${b.passenger_amount ? `${b.passenger_amount} คน` : '-'}${b.passenger_name ? ` · ${b.passenger_name}` : ''}</span></div>
          <div><small>ค่าใช้รถ</small><span>${+b.car_money ? `${fmtMoney(b.car_money)} บาท` : '-'}</span></div>
          ${b.docref ? html`<div><small>เลขที่อ้างอิง</small><span>${b.docref}</span></div>` : ''}
          ${+b.damage ? html`<div><small>ค่าเสียหาย</small><span style="color:var(--danger)">${fmtMoney(b.damage)} บาท</span></div>` : ''}
        </div>
        ${b.comment ? html`<div class="alert info" style="margin-top:16px;white-space:pre-line">${b.comment}</div>` : ''}</div>
        <div class="card-f no-print" id="actions">
          ${can.delete ? html`<button class="btn btn-danger" data-act="delete">${icon('trash')} ลบ</button>` : ''}
          <span class="grow"></span>
          ${can.cancel ? html`<button class="btn btn-danger" data-act="cancel">${icon('x')} ยกเลิกการจอง</button>` : ''}
          ${can.edit ? html`<a class="btn" href="#/booking/${b.id}/edit">${icon('edit')} แก้ไข</a>` : ''}
          ${[2, 5, 6].includes(st) && state.meta.resources.carwork.canWrite ? html`<a class="btn" href="#/r/carwork/new?booking=${b.id}">${icon('route')} บันทึกการใช้รถ</a>` : ''}
          ${can.return ? html`<button class="btn btn-primary" data-act="return">${icon('undo')} ส่งคืนรถ</button>` : ''}
          ${can.receive ? html`<button class="btn btn-success" data-act="receive">${icon('check')} ยืนยันรับคืนรถ</button>` : ''}
          ${can.approve ? html`<button class="btn btn-danger" data-act="reject">${icon('x')} ไม่อนุมัติ</button>
            <button class="btn btn-success" data-act="approve">${icon('check')} อนุมัติ</button>` : ''}
          <button class="btn btn-icon" onclick="print()" title="พิมพ์">${icon('print')}</button>
        </div>
      </div>
    </div>
    <div class="stack">
      ${b.car_picture ? html`<div class="card" style="overflow:hidden"><img id="car-pic" class="zoomable" src="${fileUrl('car', b.car_picture)}" alt="รูปรถ ${b.car_id__t || ''}" title="คลิกเพื่อดูรูปขนาดใหญ่" style="width:100%;aspect-ratio:16/10;object-fit:cover;display:block"></div>` : ''}
      <div class="card card-b"><h3 style="margin-bottom:14px">ความคืบหน้า</h3><div class="timeline">
        ${step(true, 'primary', 'plus', 'สร้างคำขอจอง', fmtDateTime(b.date_create), b.user_save_id__t)}
        ${step(!!b.read_date, 'info', 'eye', 'ผู้อนุมัติเปิดอ่าน', fmtDateTime(b.read_date))}
        ${st === 4 ? step(true, 'gray', 'x', 'ยกเลิกการจอง', fmtDateTime(b.date_edit))
          : st === 3 ? step(true, 'danger', 'x', 'ไม่อนุมัติ', fmtDateTime(b.approve_date), html`${b.user_approve_id__t || ''}${b.approve_comment ? html`<div class="muted">“${b.approve_comment}”</div>` : ''}`)
          : step(st >= 2, 'success', 'check', 'อนุมัติ', fmtDateTime(b.approve_date), st >= 2 ? html`${b.user_approve_id__t || ''}${b.approve_comment ? html`<div class="muted">“${b.approve_comment}”</div>` : ''}` : '')}
        ${![3, 4].includes(st) ? html`${step(st >= 5, 'violet', 'undo', 'ส่งคืนรถ', fmtDateTime(b.date_return))}
          ${step(st >= 6, 'primary', 'check', 'รับคืนรถเรียบร้อย', fmtDateTime(b.date_return_ok), b.return_comment)}` : ''}
      </div></div>
    </div>
  </div>`);

  $('#car-pic', root)?.addEventListener('click', async () => {
    // show every photo of this car, starting with the main one
    let images = [{ src: fileUrl('car', b.car_picture), caption: b.car_id__t }];
    try {
      const car = await get(`r/car/${b.car_id}`);
      const all = ['picture1', 'picture2', 'picture3', 'picture4', 'picture5'].filter((k) => car[k])
        .map((k, n) => ({ src: fileUrl('car', car[k]), caption: `${b.car_id__t} · รูปที่ ${n + 1}` }));
      if (all.length) images = all;
    } catch { /* fall back to the single photo */ }
    lightbox(images, 0);
  });

  $('#actions', root).addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    try {
      if (act === 'delete') {
        if (!await confirmBox(`ลบใบจอง ${b.docno} ถาวร?`, { ok: 'ลบ', danger: true })) return;
        await api('DELETE', `booking/${id}`); toast('ลบแล้ว'); location.hash = '#/booking'; return;
      }
      if (act === 'cancel') {
        const r = await confirmBox('ยืนยันยกเลิกการจองนี้?', { ok: 'ยกเลิกการจอง', danger: true, input: 'เหตุผล (ไม่บังคับ)' });
        if (!r) return;
        await api('POST', `booking/${id}/cancel`, { comment: r.value }); toast('ยกเลิกการจองแล้ว');
      }
      if (act === 'reject') {
        const r = await confirmBox('ไม่อนุมัติคำขอใช้รถนี้?', { ok: 'ไม่อนุมัติ', danger: true, input: 'เหตุผล' });
        if (!r) return;
        await api('POST', `booking/${id}/reject`, { comment: r.value }); toast('บันทึกผลไม่อนุมัติแล้ว');
      }
      if (act === 'return') {
        const r = await confirmBox('ยืนยันส่งคืนรถ?', { ok: 'ส่งคืนรถ', input: 'สภาพรถ / หมายเหตุ (ไม่บังคับ)' });
        if (!r) return;
        await api('POST', `booking/${id}/return`, { comment: r.value }); toast('ส่งคืนรถแล้ว');
      }
      if (act === 'approve' || act === 'receive') {
        const ok = await new Promise((resolve) => {
          let done = false;
          const m = modal({
            title: act === 'approve' ? 'อนุมัติการใช้รถ' : 'ยืนยันรับคืนรถ', size: 'sm',
            body: act === 'approve'
              ? html`<div class="stack"><div class="field"><label>มอบหมายพนักงานขับรถ</label><div class="combo" data-lookup="driver" data-name="driver_id" data-value="${b.driver_id || ''}"></div></div>
                 <div class="field"><label>ความเห็นผู้อนุมัติ</label><textarea class="input" name="comment"></textarea></div></div>`
              : html`<div class="stack"><div class="field"><label>ค่าเสียหาย (บาท)</label><input class="input" name="damage" inputmode="decimal" value="0"></div>
                 <div class="field"><label>หมายเหตุการรับคืน</label><textarea class="input" name="comment"></textarea></div></div>`,
            footer: html`<button class="btn" data-close>ยกเลิก</button><button class="btn btn-success" id="go">${icon('check')} ยืนยัน</button>`,
            onClose: () => resolve(done),
          });
          enhanceCombos(m.el, { driver_id: b.driver_id__t });
          $('#go', m.el).onclick = async () => {
            const payload = Object.fromEntries($$('[name]', m.el).map((i) => [i.name, i.value]));
            setBusy($('#go', m.el), true);
            try { await api('POST', `booking/${id}/${act}`, payload); done = true; m.close(); }
            catch (err) { toastError(err); setBusy($('#go', m.el), false); }
          };
        });
        if (!ok) return;
        toast(act === 'approve' ? 'อนุมัติแล้ว' : 'รับคืนรถเรียบร้อย');
      }
      window.dispatchEvent(new Event('counts:refresh'));
      renderDetail({ root, setTitle, alive }, id);
    } catch (err) { toastError(err); }
  });
}
