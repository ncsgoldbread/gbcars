import {
  state, html, raw, mount, $, $$, icon, api, get, qs, fmtDate, fmtMoney, fmtNum, fmtTime, carBadge, expiryBadge, loadingHtml, emptyHtml, pager,
  debounce, toast, toastError, confirmBox, modal, formHtml, readForm, enhanceCombos, invalidateLookup, fileUrl, setBusy, today, initials, lightbox,
} from '../core.js';

const LOOKUP_OF = { car: 'car', driver: 'driver', user: 'user', depart: 'depart', faculty: 'faculty', province: 'province', brand: 'brand',
  cartype: 'cartype', oil: 'oil', insurer: 'insurer', leasing: 'leasing', garage: 'garage' };

export async function render(ctx) {
  const name = ctx.route.res;
  const meta = state.meta.resources[name];
  if (!meta || !meta.canRead) throw new Error('ไม่มีสิทธิ์เข้าถึงหน้านี้');
  meta.name = name;
  const id = ctx.route.id;
  if (id === null) return renderList(ctx, meta);
  return renderPage(ctx, meta, id === 'new' ? null : id);
}

const useModal = (m) => m.group === 'master' || (m.name === 'userdepart');

function cell(f, r) {
  const v = r[f.name];
  switch (f.type) {
    case 'lookup': return r[`${f.name}__t`] || '';
    case 'select': return f.name === 'status' && f.options[3] === 'ยกเลิกใช้' ? carBadge(v) : (f.options[v] ?? '');
    case 'date': return /date_e_|^datee$|^datet$/.test(f.name) ? expiryBadge(v) : fmtDate(v);
    case 'money': return fmtMoney(v);
    case 'number': return fmtNum(v, 2);
    case 'time': return fmtTime(`2000-01-01 ${v}`);
    default: return v ?? '';
  }
}

/* ======================= list ======================= */
async function renderList({ root, setTitle, alive }, meta) {
  setTitle(meta.title, meta.canWrite ? '' : 'ดูข้อมูลอย่างเดียว');
  const cols = meta.fields.filter((f) => f.list);
  const st = { q: '', page: 1, sort: '', dir: '', f: {} };
  const statusField = meta.fields.find((f) => f.name === 'status' && f.type === 'select');
  const hasThumb = meta.images?.length;
  const isCar = meta.name === 'car';

  mount(root, html`<div class="card">
    <div class="toolbar">
      ${meta.searchable ? html`<div class="search">${icon('search')}<input class="input" id="q" placeholder="ค้นหา…" autocomplete="off"></div>` : ''}
      ${statusField ? html`<select class="input" id="fstatus" style="width:auto"><option value="">ทุกสถานะ</option>
        ${Object.entries(statusField.options).map(([k, t]) => html`<option value="${k}">${t}</option>`)}</select>` : ''}
      <span class="grow"></span>
      ${meta.canWrite && !meta.noCreate ? html`<button class="btn btn-primary" id="add">${icon('plus')} เพิ่ม${meta.title.replace(/^ข้อมูล/, '')}</button>` : ''}
    </div>
    <div id="list">${loadingHtml()}</div>
  </div>`);

  async function load() {
    const params = { q: st.q, page: st.page, sort: st.sort, dir: st.dir };
    for (const [k, v] of Object.entries(st.f)) params[`f[${k}]`] = v;
    const data = await get(`r/${meta.name}?${qs(params)}`);
    if (!alive()) return;
    const box = $('#list', root);
    if (!data.rows.length) { mount(box, emptyHtml(st.q ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีข้อมูล', meta.icon)); return; }
    mount(box, html`<div class="table-wrap"><table class="table cards"><thead><tr>
      ${hasThumb ? html`<th></th>` : ''}
      ${cols.map((f) => html`<th class="sortable ${['money', 'number'].includes(f.type) ? 'num' : ''}" data-sort="${f.name}">${f.label}${st.sort === f.name ? (st.dir === 'desc' ? ' ↓' : ' ↑') : ''}</th>`)}
      ${meta.canWrite ? html`<th></th>` : ''}</tr></thead><tbody>
      ${data.rows.map((r) => html`<tr class="click" data-id="${r.id}">
        ${hasThumb ? html`<td data-label="">${r[meta.images[0]] ? html`<img class="thumb" loading="lazy" src="${fileUrl(meta.uploadType, r[meta.images[0]])}" alt="">`
          : html`<span class="thumb" style="display:grid;place-items:center;color:var(--muted)">${meta.name === 'car' ? icon(meta.icon) : html`<b>${initials(r)}</b>`}</span>`}</td>` : ''}
        ${cols.map((f, i) => html`<td data-label="${f.label}" class="${i === 0 ? 'primary' : ''} ${['money', 'number'].includes(f.type) ? 'num' : ''}">${cell(f, r)}</td>`)}
        ${meta.canWrite ? html`<td class="actions">${!meta.noCreate ? html`<button class="btn btn-sm btn-ghost btn-danger" data-del="${r.id}" title="ลบ">${icon('trash')}</button>` : ''}</td>` : ''}
      </tr>`)}</tbody></table></div>${pager(data.total, data.page, data.per)}`);
  }

  root.addEventListener('click', async (e) => {
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
    if (p && !p.disabled) { st.page = +p.dataset.page; load(); return; }
    const tr = e.target.closest('tr[data-id]');
    if (tr) { if (useModal(meta)) openModal(meta, +tr.dataset.id, load); else location.hash = `#/r/${meta.name}/${tr.dataset.id}`; }
  });
  $('#add', root)?.addEventListener('click', () => { if (useModal(meta)) openModal(meta, null, load); else location.hash = `#/r/${meta.name}/new`; });
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
    body: html`<form id="mf">${formHtml(meta.fields, data, { readonly: !meta.canWrite })}<button type="submit" hidden></button></form>`,
    footer: meta.canWrite ? html`<button class="btn" data-close>ยกเลิก</button><button class="btn btn-primary" id="save">${icon('check')} บันทึก</button>` : html`<button class="btn" data-close>ปิด</button>`,
  });
  const form = $('#mf', m.el);
  await enhanceCombos(form, textsOf(meta, data));
  form.querySelector('input:not([type=hidden]):not([readonly]), select, textarea')?.focus();
  const save = async (e) => {
    e?.preventDefault();
    const btn = $('#save', m.el); setBusy(btn, true);
    try {
      await api(id ? 'PUT' : 'POST', `r/${meta.name}${id ? `/${id}` : ''}`, readForm(form, meta.fields));
      invalidateLookup(LOOKUP_OF[meta.name]);
      toast('บันทึกแล้ว'); m.close(); after?.();
    } catch (err) { toastError(err); setBusy(btn, false); }
  };
  form.addEventListener('submit', save);
  $('#save', m.el)?.addEventListener('click', save);
}

const textsOf = (meta, data) => Object.fromEntries(meta.fields.filter((f) => f.type === 'lookup').map((f) => [f.name, data[`${f.name}__t`]]));

/* ======================= full page form ======================= */
async function renderPage({ root, setTitle, alive, route }, meta, id) {
  mount(root, loadingHtml());
  let data = {};
  if (id) data = await get(`r/${meta.name}/${id}`);
  else {
    for (const f of meta.fields) if (f.default === 'today') data[f.name] = today();
    if (meta.name === 'carwork' && route.q?.booking) data = { ...data, ...(await prefillFromBooking(route.q.booking)) };
  }
  if (!alive()) return;
  const ro = !meta.canWrite;
  const person = [data.title, data.firstname].filter(Boolean).join('') + (data.surname ? ` ${data.surname}` : '');
  const titleText = id ? (data.docno || (data.firstname ? person : '') || data.code || data.name || data.docname || `#${id}`) : `เพิ่ม${meta.title}`;
  setTitle(titleText, meta.title);
  const isCar = meta.name === 'car';

  mount(root, html`<form id="pf" class="stack" novalidate>
    ${meta.images?.length && id ? html`<div class="card"><div class="card-h"><h2 class="grow">รูปภาพ</h2><span class="muted small">คลิกรูปเพื่อดูขนาดใหญ่${ro ? '' : ' · คลิกช่องว่างเพื่ออัปโหลด'}</span></div>
      <div class="card-b"><div class="gallery" style="${meta.images.length === 1 ? 'grid-template-columns:160px' : ''}">
      ${meta.images.map((f, i) => html`<div class="slot ${data[f] ? 'has' : ''}" role="button" tabindex="0" data-img="${f}" data-src="${data[f] ? fileUrl(meta.uploadType, data[f]) : ''}" data-label="รูปที่ ${i + 1}"
          style="${data[f] ? `background-image:url('${fileUrl(meta.uploadType, data[f])}')` : ''}">
        ${data[f] ? html`<span>${icon('eye')} ดูรูป</span>` : html`<div class="center">${icon(ro ? 'image' : 'upload')}<div>${ro ? `รูปที่ ${i + 1}` : `เพิ่มรูปที่ ${i + 1}`}</div></div>`}
        ${ro ? '' : html`<input type="file" accept="image/*" hidden data-upload="${f}">`}</div>`)}
      </div></div></div>` : ''}
    <div class="card">
      <div class="card-h"><h2 class="grow">${meta.title}</h2>
        ${isCar && id ? html`<a class="btn btn-sm" href="#/calendar?car=${id}">${icon('calendar')} ปฏิทินรถคันนี้</a><a class="btn btn-sm btn-primary" href="#/booking/new?car=${id}">${icon('plus')} จองรถคันนี้</a>` : ''}</div>
      <div class="card-b">${formHtml(meta.fields, data, { readonly: ro })}</div>
      ${meta.children ? html`<div class="card-b" style="border-top:1px solid var(--border)">
        <div class="row between" style="margin-bottom:10px"><h3>${meta.childrenTitle}</h3>${ro ? '' : html`<button type="button" class="btn btn-sm" id="add-item">${icon('plus')} เพิ่มรายการ</button>`}</div>
        <div class="table-wrap"><table class="table items-table"><thead><tr>${meta.children.map((f) => html`<th>${f.label}</th>`)}<th class="num">รวม</th><th></th></tr></thead>
        <tbody id="items"></tbody><tfoot><tr><td colspan="${meta.children.length}" class="right">รวมทั้งสิ้น</td><td class="num" id="items-total"></td><td></td></tr></tfoot></table></div></div>` : ''}
      <div class="card-f">
        ${id && !ro && !meta.noCreate ? html`<button type="button" class="btn btn-danger" id="del">${icon('trash')} ลบ</button>` : ''}
        <span class="grow"></span>
        <a class="btn" href="#/r/${meta.name}">${ro ? 'กลับ' : 'ยกเลิก'}</a>
        ${ro ? '' : html`<button class="btn btn-primary" type="submit">${icon('check')} บันทึก</button>`}
      </div>
    </div>
    ${isCar && id ? html`<div class="card"><div class="card-h"><h2 class="grow">ไฟล์เอกสารรถ (${data._files.length})</h2>
        ${ro ? '' : html`<label class="btn btn-sm">${icon('upload')} อัปโหลดไฟล์<input type="file" hidden id="carfile" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"></label>`}</div>
      <div class="list">${data._files.length ? data._files.map((f) => html`<div class="list-item">
        <span class="ic tone-info" style="width:34px;height:34px;border-radius:9px;display:grid;place-items:center">${icon('file')}</span>
        <div class="grow" style="min-width:0"><a href="${fileUrl('car', f.filename, f.oldfilename)}" target="_blank" rel="noopener">${f.oldfilename || f.filename}</a><div class="meta">${f.comment || ''}</div></div>
        ${ro ? '' : html`<button type="button" class="btn btn-sm btn-ghost btn-danger" data-delfile="${f.id}">${icon('trash')}</button>`}</div>`) : emptyHtml('ยังไม่มีไฟล์', 'file')}</div></div>` : ''}
  </form>`);

  const form = $('#pf', root);
  await enhanceCombos(form, textsOf(meta, data));

  /* child items (carfix) */
  const items = [...(data._items || [])];
  const drawItems = () => {
    if (!meta.children) return;
    mount($('#items', root), items.length ? html`${items.map((it, k) => html`<tr data-k="${k}">
      ${meta.children.map((f) => html`<td><input class="input" data-f="${f.name}" value="${it[f.name] ?? ''}" ${ro ? raw('readonly') : ''} ${['money', 'number'].includes(f.type) ? raw('inputmode="decimal" style="text-align:right;width:110px"') : ''}></td>`)}
      <td class="num">${fmtMoney((+it.qty || 0) * (+it.price || 0))}</td>
      <td>${ro ? '' : html`<button type="button" class="btn btn-sm btn-ghost btn-danger" data-rm="${k}">${icon('x')}</button>`}</td></tr>`)}`
      : html`<tr><td colspan="${meta.children.length + 2}" class="muted center">ยังไม่มีรายการ</td></tr>`);
    $('#items-total', root).textContent = fmtMoney(items.reduce((s, it) => s + (+it.qty || 0) * (+it.price || 0), 0));
  };
  if (meta.children) {
    drawItems();
    $('#add-item', root)?.addEventListener('click', () => { items.push({ qty: 1 }); drawItems(); $(`#items tr:last-child input`, root)?.focus(); });
    $('#items', root).addEventListener('input', (e) => {
      const inp = e.target.closest('[data-f]'); if (!inp) return;
      const k = +inp.closest('tr').dataset.k; items[k][inp.dataset.f] = inp.value;
      if (['qty', 'price'].includes(inp.dataset.f)) {
        inp.closest('tr').children[meta.children.length].textContent = fmtMoney((+items[k].qty || 0) * (+String(items[k].price || 0).replace(/,/g, '') || 0));
        $('#items-total', root).textContent = fmtMoney(items.reduce((s, it) => s + (+it.qty || 0) * (+String(it.price || 0).replace(/,/g, '') || 0), 0));
      }
    });
    $('#items', root).addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { items.splice(+b.dataset.rm, 1); drawItems(); } });
  }

  /* carwork: auto calculate */
  if (meta.name === 'carwork') {
    const calc = () => {
      const g = (n) => form.querySelector(`[name="${n}"]`);
      const s = g('start_date').value, e = g('end_date').value;
      const rate = +String(g('car_rate').value).replace(/,/g, '') || 0;
      if (s && e && rate) {
        const st = new Date(`${s}T${g('start_time').value || '00:00'}`), en = new Date(`${e}T${g('end_time').value || '00:00'}`);
        const min = Math.max(0, Math.round((en - st) / 60000));
        g('car_money').value = (rate * min).toFixed(2);
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
    const payload = readForm(form, meta.fields);
    if (meta.name === 'carwork' && data.booking_id) payload.booking_id = data.booking_id;
    if (meta.children) payload._items = items;
    const btn = e.submitter; setBusy(btn, true);
    try {
      const saved = await api(id ? 'PUT' : 'POST', `r/${meta.name}${id ? `/${id}` : ''}`, payload);
      invalidateLookup(LOOKUP_OF[meta.name]);
      toast(saved.docno && !id ? `บันทึกแล้ว เลขที่ ${saved.docno}` : 'บันทึกแล้ว');
      if (!id) location.hash = `#/r/${meta.name}/${saved.id}`; else { setBusy(btn, false); }
    } catch (err) { toastError(err); setBusy(btn, false); }
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
        slot.querySelector('.center')?.replaceWith(Object.assign(document.createElement('span'), { innerHTML: `${icon('eye').__raw} ดูรูป` }));
        toast('อัปโหลดรูปแล้ว');
      } catch (err) { toastError(err); }
      slot.style.opacity = '';
      up.value = '';
    }
    if (e.target.id === 'carfile' && e.target.files[0]) {
      const r = await confirmBox(`อัปโหลด “${e.target.files[0].name}”`, { ok: 'อัปโหลด', input: 'คำอธิบายไฟล์ เช่น เล่มทะเบียน, กรมธรรม์' });
      if (!r) { e.target.value = ''; return; }
      const fd = new FormData(); fd.append('file', e.target.files[0]); fd.append('comment', r.value);
      try { await api('POST', `carfile/${id}`, fd); toast('อัปโหลดแล้ว'); renderPage({ root, setTitle, alive, route }, meta, id); } catch (err) { toastError(err); }
    }
  });
  /* gallery: photo -> large popup, empty slot -> upload */
  const openSlot = (slot) => {
    const input = slot.querySelector('[data-upload]');
    if (!slot.dataset.src) { input?.click(); return; }
    const slots = $$('.slot[data-src]', root).filter((s) => s.dataset.src);
    lightbox(slots.map((s) => ({ src: s.dataset.src, caption: `${titleText} · ${s.dataset.label}` })), slots.indexOf(slot), {
      onReplace: ro ? null : (i) => slots[i].querySelector('[data-upload]')?.click(),
    });
  };
  root.addEventListener('keydown', (e) => {
    const slot = e.target.closest('.slot[data-img]');
    if (slot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openSlot(slot); }
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
