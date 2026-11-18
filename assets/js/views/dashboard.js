import { state, html, raw, mount, icon, get, fmtDate, fmtTime, fmtRange, fmtNum, bookingBadge, emptyHtml, skeletonBlock, plate, parseDate } from '../core.js';

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DOW = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/** Grouped bar chart as inline SVG (scales with its container). */
function chart(months) {
  const W = 640, H = 220, L = 34, B = 26, T = 14;
  const max = Math.max(4, ...months.flatMap((m) => [m.bookings, m.trips]));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const cw = (W - L) / months.length;
  const bw = Math.min(22, cw / 3.2);
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const grid = [0, 1, 2, 3, 4].map((k) => {
    const v = step * k;
    return `<line class="grid-line" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }).join('');
  const bars = months.map((m, i) => {
    const cx = L + cw * i + cw / 2;
    const [yy, mo] = m.month.split('-');
    const bar = (v, x, cls) => `<rect class="${cls}" x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(0, H - B - y(v))}" rx="4"><title>${v}</title></rect>
      ${v ? `<text class="val" x="${x + bw / 2}" y="${y(v) - 5}" text-anchor="middle">${v}</text>` : ''}`;
    return `${bar(m.bookings, cx - bw - 2, 'bar-a')}${bar(m.trips, cx + 2, 'bar-b')}
      <text class="axis" x="${cx}" y="${H - 7}" text-anchor="middle">${MONTHS[+mo - 1]} ${String(+yy + 543).slice(2)}</text>`;
  }).join('');
  return raw(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟจำนวนการจองและการใช้รถ 6 เดือน">${grid}${bars}</svg>`);
}

export async function render({ root, setTitle, setActions, alive }) {
  const u = state.user;
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  setTitle(`${greet}, คุณ${u.firstname}`, `วัน${DOW[now.getDay()]}ที่ ${fmtDate(now)} · ภาพรวมการใช้รถขององค์กร`, 'แดชบอร์ด');
  setActions(html`<a class="btn" href="#/calendar">${icon('calendar')} ปฏิทิน</a><a class="btn btn-primary" href="#/booking/new">${icon('plus')} จองใช้รถ</a>`);
  mount(root, html`<div class="stack"><div class="grid g-4">${[1, 2, 3, 4].map(() => skeletonBlock(118))}</div><div class="grid g-main">${skeletonBlock(320)}${skeletonBlock(320)}</div></div>`);
  const d = await get('dashboard');
  if (!alive()) return;

  const cs = d.cars.status;
  const ready = cs[0] || 0;
  const active = d.cars.total - (cs[3] || 0);
  const c = state.counts;
  const kpi = (href, tone, ic, label, val, foot) => html`<a class="card kpi" href="${href}">
    <div class="top"><span class="ic tone-${tone}">${icon(ic)}</span>${label}</div><div class="val">${val}</div><div class="foot">${foot}</div></a>`;

  mount(root, html`<div class="stack">
    <div class="grid g-4">
      ${kpi('#/r/car', 'success', 'car', 'รถพร้อมใช้งาน', html`${fmtNum(ready)}<small>/ ${fmtNum(active)} คัน</small>`,
        html`<div class="meter grow"><i style="width:${active ? (ready / active) * 100 : 0}%"></i></div><span>${active ? Math.round((ready / active) * 100) : 0}%</span>`)}
      ${kpi('#/calendar', 'primary', 'route', 'กำลังใช้งานตอนนี้', html`${fmtNum(d.inUse)}<small>คัน</small>`,
        html`วันนี้มีการใช้รถ ${fmtNum(d.today.length)} รายการ`)}
      ${u.approver
        ? kpi('#/approve', c.approve ? 'warning' : 'success', 'inbox', 'งานรออนุมัติ', html`${fmtNum(c.approve)}<small>รายการ</small>`,
          c.return ? html`รอยืนยันรับคืนรถ ${fmtNum(c.return)} รายการ` : 'ไม่มีรถรอรับคืน')
        : kpi('#/booking', 'info', 'doc', 'การจองของฉัน', html`${fmtNum(d.mine.filter((b) => [0, 1, 2].includes(+b.status)).length)}<small>รายการที่ยังไม่เสร็จ</small>`, 'ดูรายการจองทั้งหมดของคุณ')}
      ${kpi('#/reports/car_expire', c.expired ? 'danger' : 'success', 'shield', 'เอกสารรถ', html`${fmtNum(c.expired)}<small>คัน หมดอายุ</small>`,
        html`<span class="badge tone-warning">${fmtNum(c.expiring)} คัน ใกล้หมดใน 30 วัน</span>`)}
    </div>

    <div class="grid g-main">
      <div class="stack">
        <div class="card">
          <div class="card-h"><h2 class="grow">การใช้รถวันนี้ <span class="sub">· ${fmtNum(d.today.length)} รายการ</span></h2><a class="btn btn-sm btn-ghost" href="#/calendar">ดูปฏิทิน ${icon('chevR')}</a></div>
          <div class="list">
            ${d.today.length ? d.today.map((b) => html`<a class="list-item" href="#/booking/${b.id}">
                <div class="time-col"><b>${fmtTime(b.start_date)}</b><small>ถึง ${fmtTime(b.end_date)}</small></div>
                ${plate(b.car_code, '', 'sm')}
                <div class="grow"><div class="truncate">${b.working}</div><div class="meta truncate">${b.person_name || ''}${b.province ? ` · ${b.province}` : ''}</div></div>
                ${bookingBadge(b.status)}</a>`)
              : emptyHtml('วันนี้ยังไม่มีการใช้รถ', 'calendar', 'รถทุกคันว่าง พร้อมให้จอง')}
          </div>
        </div>
        <div class="card">
          <div class="card-h"><h2 class="grow">สถิติ 6 เดือนล่าสุด</h2>
            <div class="legend"><span><i style="background:var(--primary)"></i>การจอง</span><span><i style="background:var(--info);opacity:.75"></i>บันทึกการใช้รถ</span></div></div>
          <div class="card-b">${chart(d.months)}</div>
        </div>
        <div class="card">
          <div class="card-h"><h2 class="grow">กำหนดการ 7 วันข้างหน้า</h2></div>
          <div class="list">
            ${d.week.length ? d.week.map((b) => {
              const s = parseDate(b.start_date);
              return html`<a class="list-item" href="#/booking/${b.id}">
                <div class="date-pill"><b>${s.getDate()}</b><small>${MONTHS[s.getMonth()]}</small></div>
                <div class="grow"><div class="truncate"><b>${b.car_code || '-'}</b> · ${b.working}</div><div class="meta">${fmtRange(b.start_date, b.end_date)} · ${b.person_name || ''}</div></div>
                ${bookingBadge(b.status)}</a>`;
            }) : emptyHtml('ไม่มีการจองล่วงหน้าใน 7 วัน', 'calendar')}
          </div>
        </div>
      </div>

      <div class="stack">
        <div class="card">
          <div class="card-h"><h2 class="grow">ต้องดำเนินการ</h2><a class="btn btn-sm btn-ghost" href="#/reports/car_expire">ทั้งหมด ${icon('chevR')}</a></div>
          <div class="list" style="max-height:420px;overflow-y:auto">
            ${d.alerts.length ? d.alerts.slice(0, 14).map((a) => html`<a class="list-item" href="#/r/car/${a.car_id}">
                <span class="ic tone-${a.days < 0 ? 'danger' : 'warning'}">${icon(a.days < 0 ? 'alert' : 'clock')}</span>
                <div class="grow"><div class="truncate"><b>${a.car}</b></div><div class="meta">${a.type} · ${fmtDate(a.date)}</div></div>
                <span class="badge tone-${a.days < 0 ? 'danger' : 'warning'} plain">${a.days < 0 ? `เกิน ${fmtNum(-a.days)} วัน` : a.days === 0 ? 'วันนี้' : `อีก ${a.days} วัน`}</span></a>`)
              : emptyHtml('เอกสารรถเป็นปัจจุบันทุกคัน', 'shield')}
          </div>
        </div>
        <div class="card">
          <div class="card-h"><h2 class="grow">การจองล่าสุดของฉัน</h2><a class="btn btn-sm btn-ghost" href="#/booking">ทั้งหมด ${icon('chevR')}</a></div>
          <div class="list">
            ${d.mine.length ? d.mine.map((b) => html`<a class="list-item" href="#/booking/${b.id}">
                <div class="grow"><div class="truncate"><b>${b.car_code || '-'}</b> · ${b.working}</div><div class="meta">${fmtRange(b.start_date, b.end_date)}</div></div>${bookingBadge(b.status)}</a>`)
              : emptyHtml('ยังไม่มีการจอง', 'doc', html`<a href="#/booking/new">จองรถครั้งแรก</a>`)}
          </div>
        </div>
        <div class="card card-b">
          <p class="section-title">สถานะรถทั้งหมด ${fmtNum(d.cars.total)} คัน</p>
          ${Object.entries(state.meta.carStatus).map(([k, label]) => {
            const n = cs[k] || 0;
            return html`<div class="hbar"><span>${label}</span><div class="track"><div class="fill" style="width:${d.cars.total ? (n / d.cars.total) * 100 : 0}%;background:var(--${['success', 'warning', 'info', 'faint'][k]})"></div></div><span class="right tnum">${fmtNum(n)}</span></div>`;
          })}
        </div>
      </div>
    </div>
  </div>`);
}
