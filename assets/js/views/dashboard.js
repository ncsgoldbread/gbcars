import { state, html, mount, icon, get, fmtDate, fmtTime, fmtRange, fmtNum, bookingBadge, loadingHtml, emptyHtml } from '../core.js';

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export async function render({ root, setTitle, alive }) {
  const u = state.user;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  setTitle('แดชบอร์ด', `${greet}, คุณ${u.firstname} · ${fmtDate(new Date())}`);
  mount(root, loadingHtml());
  const d = await get('dashboard');
  if (!alive()) return;

  const cs = d.cars.status;
  const max = Math.max(1, ...d.months.flatMap((m) => [m.bookings, m.trips]));
  const stat = (tone, ic, value, label, href) => html`<a class="card stat" href="${href}" style="color:inherit;text-decoration:none">
      <div class="ic tone-${tone}">${icon(ic)}</div><div><b>${value}</b><span>${label}</span></div></a>`;

  mount(root, html`
    <div class="stack">
      <div class="grid g-4">
        ${stat('success', 'car', fmtNum(cs[0] || 0), `รถพร้อมใช้งาน (จาก ${fmtNum(d.cars.total)} คัน)`, '#/r/car')}
        ${stat('primary', 'route', fmtNum(d.today.length), 'การใช้รถวันนี้', '#/calendar')}
        ${u.approver
          ? stat('warning', 'inbox', fmtNum(d.counts.approve), 'งานรออนุมัติ', '#/approve')
          : stat('info', 'steering', fmtNum(d.drivers), 'พนักงานขับรถ', '#/calendar')}
        ${stat(d.alertTotal ? 'danger' : 'success', 'alert', fmtNum(d.alertTotal), 'เอกสารรถใกล้/หมดอายุ (30 วัน)', '#/reports/car_expire')}
      </div>

      <div class="grid g-main">
        <div class="stack">
          <div class="card">
            <div class="card-h"><h2 class="grow">การใช้รถวันนี้</h2><a class="btn btn-sm" href="#/calendar">${icon('calendar')} ปฏิทิน</a><a class="btn btn-sm btn-primary" href="#/booking/new">${icon('plus')} จองรถ</a></div>
            <div class="list">
              ${d.today.length ? d.today.map((b) => html`<a class="list-item" href="#/booking/${b.id}">
                  <div class="date-pill"><b>${fmtTime(b.start_date)}</b><small>${fmtTime(b.end_date)}</small></div>
                  <div class="grow" style="min-width:0"><div><b>${b.car_code || '-'}</b> · ${b.working}</div>
                  <div class="meta">${b.person_name || ''}${b.province ? ` · ${b.province}` : ''} · ${b.docno}</div></div>${bookingBadge(b.status)}</a>`)
                : emptyHtml('วันนี้ยังไม่มีการใช้รถ', 'calendar')}
            </div>
          </div>
          <div class="card">
            <div class="card-h"><h2 class="grow">สถิติ 6 เดือนล่าสุด</h2>
              <div class="legend"><span><i style="background:var(--primary)"></i>การจอง</span><span><i style="background:var(--info)"></i>บันทึกใช้รถ</span></div></div>
            <div class="card-b"><div class="bars">${d.months.map((m) => {
              const [y, mo] = m.month.split('-');
              return html`<div class="col"><div class="pair">
                <div class="bar" style="height:${(m.bookings / max) * 100}%"><span>${m.bookings || ''}</span></div>
                <div class="bar alt" style="height:${(m.trips / max) * 100}%"><span>${m.trips || ''}</span></div></div>
                <div class="lbl">${MONTHS[+mo - 1]} ${String(+y + 543).slice(2)}</div></div>`;
            })}</div></div>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-h"><h2 class="grow">แจ้งเตือนเอกสารรถ</h2><a class="btn btn-sm btn-ghost" href="#/reports/car_expire">ดูทั้งหมด</a></div>
            <div class="list" style="max-height:360px;overflow-y:auto">
              ${d.alerts.length ? d.alerts.slice(0, 12).map((a) => html`<a class="list-item" href="#/r/car/${a.car_id}">
                  <div class="ic tone-${a.days < 0 ? 'danger' : 'warning'}" style="width:34px;height:34px;border-radius:9px;display:grid;place-items:center">${icon(a.days < 0 ? 'alert' : 'clock')}</div>
                  <div class="grow"><b>${a.car}</b><div class="meta">${a.type} · ${fmtDate(a.date)}</div></div>
                  <span class="badge tone-${a.days < 0 ? 'danger' : 'warning'}">${a.days < 0 ? `เกิน ${-a.days} วัน` : a.days === 0 ? 'วันนี้' : `อีก ${a.days} วัน`}</span></a>`)
                : emptyHtml('เอกสารรถทุกคันยังไม่หมดอายุ', 'shield')}
            </div>
          </div>
          <div class="card">
            <div class="card-h"><h2 class="grow">การจองล่าสุดของฉัน</h2><a class="btn btn-sm btn-ghost" href="#/booking">ทั้งหมด</a></div>
            <div class="list">
              ${d.mine.length ? d.mine.map((b) => html`<a class="list-item" href="#/booking/${b.id}">
                  <div class="grow" style="min-width:0"><b>${b.car_code || '-'}</b> · ${b.working}<div class="meta">${fmtRange(b.start_date, b.end_date)}</div></div>${bookingBadge(b.status)}</a>`)
                : emptyHtml('ยังไม่มีการจอง')}
            </div>
          </div>
          <div class="card card-b">
            <h3 style="margin-bottom:10px">สถานะรถ</h3>
            ${Object.entries(state.meta.carStatus).map(([k, label]) => {
              const n = cs[k] || 0;
              return html`<div class="hbar"><span>${label}</span><div class="track"><div class="fill" style="width:${d.cars.total ? (n / d.cars.total) * 100 : 0}%;background:var(--${['success', 'warning', 'info', 'muted'][k]})"></div></div><span class="right">${fmtNum(n)} คัน</span></div>`;
            })}
          </div>
        </div>
      </div>
    </div>`);
}
