import { state, html, mount, $, icon, get, qs, ymd, fmtDate, fmtRange, bookingBadge, bookingTone, TH_MONTHS, TH_DOW, parseDate, modal, emptyHtml, enhanceCombos, loadingHtml } from '../core.js';

export async function render({ root, setTitle, setActions, alive, route }) {
  setTitle('ปฏิทินการใช้รถ', 'ตรวจสอบรถว่าง และรายการจองทั้งหมดในแต่ละวัน — คลิกวันที่เพื่อดูรายละเอียด');
  setActions(html`<a class="btn btn-primary" href="#/booking/new">${icon('plus')} จองใช้รถ</a>`);
  const q = route.q || {};
  let cur = q.m ? new Date(+q.m.slice(0, 4), +q.m.slice(5, 7) - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let carId = q.car || '';

  mount(root, html`<div class="card">
    <div class="card-h">
      <div class="row tight"><button class="btn btn-icon" id="prev" aria-label="เดือนก่อน">${icon('chevL')}</button>
      <button class="btn btn-icon" id="next" aria-label="เดือนถัดไป">${icon('chevR')}</button>
      <button class="btn btn-sm" id="today">วันนี้</button></div>
      <h2 id="mtitle" class="grow" style="min-width:160px;font-size:1.1rem"></h2>
      <div style="width:min(300px,100%)" title="กรองตามรถ"><div class="combo" data-lookup="car" data-name="car_filter" data-placeholder="กรองตามรถ — แสดงทุกคัน" data-value="${carId}"></div></div>
    </div>
    <div id="cal">${loadingHtml()}</div>
    <div class="card-f row small muted" style="gap:16px;justify-content:flex-start">
      ${['0', '1', '2', '5', '6'].map((s) => html`<span class="row" style="gap:6px"><span class="badge tone-${bookingTone(s)} plain" style="padding:0;width:12px;height:12px"></span>${state.meta.bookingStatus[s]}</span>`)}
    </div>
  </div>`);
  enhanceCombos(root);
  $('.combo', root).addEventListener('change', (e) => { carId = e.detail?.id || ''; load(); });
  $('#prev', root).onclick = () => { cur = new Date(cur.getFullYear(), cur.getMonth() - 1, 1); load(); };
  $('#next', root).onclick = () => { cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); load(); };
  $('#today', root).onclick = () => { cur = new Date(new Date().getFullYear(), new Date().getMonth(), 1); load(); };

  async function load() {
    mount($('#mtitle', root), html`${TH_MONTHS[cur.getMonth()]} ${cur.getFullYear() + 543}`);
    const start = new Date(cur); start.setDate(1 - start.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 41);
    const events = await get(`calendar?${qs({ from: ymd(start), to: ymd(end), car_id: carId })}`);
    if (!alive()) return;
    const byDay = new Map();
    for (const ev of events) {
      const s = parseDate(ev.start_date), e = parseDate(ev.end_date);
      const d = new Date(Math.max(s, start)); d.setHours(0, 0, 0, 0);
      while (d <= e && d <= end) { const k = ymd(d); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(ev); d.setDate(d.getDate() + 1); }
    }
    const t = ymd(new Date());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = ymd(d);
      const evs = byDay.get(k) || [];
      cells.push(html`<div class="day ${d.getMonth() !== cur.getMonth() ? 'out' : ''} ${k === t ? 'today' : ''} ${[0, 6].includes(d.getDay()) ? 'weekend' : ''}" data-day="${k}" role="button" tabindex="0" aria-label="${fmtDate(d)} ${evs.length ? `มี ${evs.length} รายการ` : 'ว่าง'}">
        <span class="dn">${d.getDate()}</span>
        ${evs.slice(0, 3).map((ev) => html`<div class="ev tone-${bookingTone(ev.status)}" title="${ev.car_code} ${ev.working}">${ev.car_code || ''} ${ev.working || ''}</div>`)}
        ${evs.length > 3 ? html`<span class="more">+${evs.length - 3} รายการ</span>` : ''}</div>`);
    }
    mount($('#cal', root), html`<div class="cal">${TH_DOW.map((x) => html`<div class="dow">${x}</div>`)}${cells}</div>`);
    $('#cal', root).onclick = (e) => {
      const day = e.target.closest('[data-day]');
      if (!day) return;
      const k = day.dataset.day;
      const evs = byDay.get(k) || [];
      const m = modal({
        title: `การใช้รถ ${fmtDate(k)}`,
        body: evs.length ? html`<div class="list" style="margin:-20px">${evs.map((ev) => html`<a class="list-item" href="#/booking/${ev.id}" data-close>
            <div class="grow" style="min-width:0"><b>${ev.car_code || '-'}</b> · ${ev.working}
            <div class="meta">${fmtRange(ev.start_date, ev.end_date)} · ${ev.person_name || ''} ${ev.depart ? `· ${ev.depart}` : ''} ${ev.driver?.trim() ? `· คนขับ ${ev.driver}` : ''}</div></div>
            ${bookingBadge(ev.status)}</a>`)}</div>` : emptyHtml('ไม่มีการจองในวันนี้ — รถว่างทุกคัน', 'calendar'),
        footer: html`<button class="btn" data-close>ปิด</button><a class="btn btn-primary" href="#/booking/new?date=${k}" data-close>${icon('plus')} จองรถวันนี้</a>`,
      });
      m.el.querySelectorAll('a[href]').forEach((a) => a.addEventListener('click', () => m.close()));
    };
  }
  await load();
}
