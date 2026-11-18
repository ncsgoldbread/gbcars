import { state, html, mount, $, $$, icon, get, qs, fmtDate, fmtDateTime, fmtMoney, fmtNum, loadingHtml, emptyHtml, enhanceCombos, ymd, toastError } from '../core.js';

const CAT_ICON = { 'การจอง': 'calendar', 'การใช้รถ': 'route', 'การเงิน': 'bank', 'รถ': 'car' };

export async function render(ctx) {
  if (ctx.route.name) return renderReport(ctx, ctx.route.name);
  ctx.setTitle('รายงาน', 'เลือกรายงานที่ต้องการ — พิมพ์ได้ และส่งออกเป็น Excel (CSV)', 'รายงานทั้งหมด');
  const defs = state.meta.reports;
  const cats = {};
  for (const [k, d] of Object.entries(defs)) (cats[d.cat] ||= []).push([k, d]);
  mount(ctx.root, html`<div class="grid g-2">${Object.entries(cats).map(([cat, items]) => html`<div class="card">
    <div class="card-h"><span class="ic tone-primary" style="width:34px;height:34px;border-radius:9px;display:grid;place-items:center">${icon(CAT_ICON[cat] || 'chart')}</span><h2>${cat}</h2></div>
    <div class="list">${items.map(([k, d]) => html`<a class="list-item" href="#/reports/${k}"><span class="grow">${d.title}</span>${icon('chevR')}</a>`)}</div></div>`)}</div>`);
}

async function renderReport({ root, setTitle, alive, route }, name) {
  const def = state.meta.reports[name];
  if (!def) throw new Error('ไม่พบรายงาน');
  setTitle(def.title, 'รายงาน');
  const now = new Date();
  const f = {
    from: route.q?.from || ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: route.q?.to || ymd(now),
    group: Object.keys(def.groups || {})[0] || '', days: 30, ...route.q,
  };
  const has = (k) => def.filters.includes(k);
  mount(root, html`<div class="stack">
    <div class="card no-print"><div class="card-b"><form id="rf" class="form-grid">
      ${has('date') ? html`<div class="field c1"><label>ตั้งแต่วันที่</label><input class="input" type="date" name="from" value="${f.from}"></div>
        <div class="field c1"><label>ถึงวันที่</label><input class="input" type="date" name="to" value="${f.to}"></div>` : ''}
      ${has('group') ? html`<div class="field c1"><label>สรุปตาม</label><select class="input" name="group">${Object.entries(def.groups).map(([k, g]) => html`<option value="${k}" ${k === f.group ? 'selected' : ''}>${g.label}</option>`)}</select></div>` : ''}
      ${has('car') ? html`<div class="field c1"><label>รถ</label><div class="combo" data-lookup="car" data-name="car_id"></div></div>` : ''}
      ${has('depart') ? html`<div class="field c1"><label>แผนก</label><div class="combo" data-lookup="depart" data-name="depart_id"></div></div>` : ''}
      ${has('driver') ? html`<div class="field c1"><label>พนักงานขับรถ</label><div class="combo" data-lookup="driver" data-name="driver_id"></div></div>` : ''}
      ${has('status') ? html`<div class="field c1"><label>สถานะ</label><select class="input" name="status"><option value="">ทั้งหมด</option>${Object.entries(state.meta.bookingStatus).filter(([k]) => k !== '9').map(([k, t]) => html`<option value="${k}">${t}</option>`)}</select></div>` : ''}
      ${has('carstatus') ? html`<div class="field c1"><label>สถานะรถ</label><select class="input" name="carstatus"><option value="">ทั้งหมด</option>${Object.entries(state.meta.carStatus).map(([k, t]) => html`<option value="${k}">${t}</option>`)}</select></div>` : ''}
      ${has('days') ? html`<div class="field c1"><label>ภายในกี่วัน</label><select class="input" name="days">${[0, 15, 30, 60, 90].map((d) => html`<option value="${d}" ${d === +f.days ? 'selected' : ''}>${d === 0 ? 'หมดอายุแล้วเท่านั้น' : `${d} วัน`}</option>`)}</select></div>` : ''}
      <div class="field c4 row" style="gap:10px">
        <button class="btn btn-primary" type="submit">${icon('search')} แสดงรายงาน</button>
        <span class="grow"></span>
        <button class="btn" type="button" id="print">${icon('print')} พิมพ์</button>
        <button class="btn" type="button" id="csv">${icon('download')} Excel (CSV)</button>
      </div>
    </form></div></div>
    <div class="card" id="out">${loadingHtml()}</div>
  </div>`);
  await enhanceCombos(root);
  const form = $('#rf', root);
  const params = () => Object.fromEntries([...new FormData(form)].filter(([, v]) => v !== ''));

  async function load() {
    const p = params();
    mount($('#out', root), loadingHtml());
    let r;
    try { r = await get(`report/${name}?${qs(p)}`); } catch (e) { toastError(e); mount($('#out', root), emptyHtml(e.message, 'alert')); return; }
    if (!alive()) return;
    const fmt = (c, v) => c.type === 'money' ? fmtMoney(v) : c.type === 'int' ? fmtNum(v) : c.type === 'number' ? fmtNum(v, 2)
      : c.type === 'date' ? fmtDate(v) : c.type === 'datetime' ? fmtDateTime(v) : (v ?? '');
    const isNum = (c) => ['money', 'int', 'number'].includes(c.type);
    const sums = Object.fromEntries(r.sum.map((k) => [k, r.rows.reduce((s, row) => s + (+row[k] || 0), 0)]));
    const chart = r.chart && r.rows.length ? (() => {
      const max = Math.max(1, ...r.rows.map((x) => +x[r.chart.value] || 0));
      const col = r.columns.find((c) => c.key === r.chart.value);
      return html`<div class="card-b no-print" style="border-bottom:1px solid var(--border)"><h3 style="margin-bottom:8px">${col.label}</h3>
        ${r.rows.slice(0, 15).map((x) => html`<div class="hbar"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x[r.chart.label] || '(ไม่ระบุ)'}</span>
        <div class="track"><div class="fill" style="width:${((+x[r.chart.value] || 0) / max) * 100}%"></div></div><span class="right">${fmt(col, x[r.chart.value])}</span></div>`)}</div>`;
    })() : '';
    mount($('#out', root), html`
      <div class="report-head"><h2>${state.company?.name || ''}</h2><h3>${r.title}</h3><div>${r.from ? `ระหว่างวันที่ ${fmtDate(r.from)} ถึง ${fmtDate(r.to)}` : (r.subtitle || '')}</div></div>
      <div class="card-h no-print"><h2 class="grow">${r.title}</h2><span class="muted small">${r.from ? `${fmtDate(r.from)} – ${fmtDate(r.to)} · ` : (r.subtitle ? `${r.subtitle} · ` : '')}${fmtNum(r.rows.length)} รายการ</span></div>
      ${chart}
      ${r.rows.length ? html`<div class="table-wrap"><table class="table cards"><thead><tr><th class="num">#</th>${r.columns.map((c) => html`<th class="${isNum(c) ? 'num' : ''}">${c.label}</th>`)}</tr></thead>
        <tbody>${r.rows.map((row, i) => html`<tr><td class="num muted" data-label="#">${i + 1}</td>${r.columns.map((c, k) => html`<td data-label="${c.label}" class="${isNum(c) ? 'num' : ''} ${k === 0 ? 'primary' : ''}">${fmt(c, row[c.key])}</td>`)}</tr>`)}</tbody>
        ${r.sum.length ? html`<tfoot><tr><td></td>${r.columns.map((c, k) => html`<td class="${isNum(c) ? 'num' : ''}">${k === 0 ? 'รวม' : (c.key in sums ? fmt(c, sums[c.key]) : '')}</td>`)}</tr></tfoot>` : ''}
        </table></div>` : emptyHtml('ไม่มีข้อมูลในช่วงที่เลือก', 'chart')}
      <div class="card-b muted small no-print">พิมพ์เมื่อ ${fmtDateTime(ymd(new Date()) + ' ' + new Date().toTimeString().slice(0, 5))} โดย ${state.user.firstname}</div>`);
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); load(); });
  $('#print', root).onclick = () => print();
  $('#csv', root).onclick = () => { location.href = `api/index.php/report/${name}/csv?${qs(params())}`; };
  await load();
}
