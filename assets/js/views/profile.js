import { state, html, mount, $, icon, api, toast, toastError, setBusy, fullName, initials, fileUrl } from '../core.js';

export async function render({ root, setTitle }) {
  const u = state.user;
  setTitle('ข้อมูลส่วนตัว', u.username);
  mount(root, html`<div class="grid g-main">
    <form class="card" id="pf">
      <div class="card-h"><h2>ข้อมูลติดต่อ</h2></div>
      <div class="card-b"><div class="form-grid">
        <div class="field c2"><label>ชื่อ-นามสกุล</label><input class="input" value="${fullName(u)}" readonly></div>
        <div class="field c2"><label>ชื่อเล่น</label><input class="input" name="nickname" value="${u.nickname || ''}"></div>
        <div class="field c2"><label>ตำแหน่ง</label><input class="input" name="position_name" value="${u.position_name || ''}"></div>
        <div class="field c2"><label>โทรศัพท์</label><input class="input" type="tel" name="tel" value="${u.tel || ''}"></div>
        <div class="field c4"><label>อีเมล</label><input class="input" type="email" name="email" value="${u.email || ''}"></div>
      </div></div>
      <div class="card-f"><button class="btn btn-primary" type="submit">${icon('check')} บันทึก</button></div>
    </form>
    <div class="stack">
      <div class="card card-b row" style="gap:16px">
        <span class="avatar" style="width:64px;height:64px;font-size:1.6rem">${u.picture1 ? html`<img src="${fileUrl('user', u.picture1)}" alt="">` : initials(u)}</span>
        <div><b>${fullName(u)}</b><div class="muted small">${u.member_type === 1 ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}${u.approver ? ' · ผู้อนุมัติ' : ''}</div></div>
      </div>
      <form class="card" id="pw">
        <div class="card-h"><h2>เปลี่ยนรหัสผ่าน</h2></div>
        <div class="card-b stack">
          <div class="field"><label>รหัสผ่านปัจจุบัน</label><input class="input" type="password" name="current_password" autocomplete="current-password" required></div>
          <div class="field"><label>รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</label><input class="input" type="password" name="new_password" autocomplete="new-password" minlength="6" required></div>
          <div class="field"><label>ยืนยันรหัสผ่านใหม่</label><input class="input" type="password" name="confirm" autocomplete="new-password" required></div>
        </div>
        <div class="card-f"><button class="btn btn-primary" type="submit">${icon('check')} เปลี่ยนรหัสผ่าน</button></div>
      </form>
    </div>
  </div>`);
  const save = async (e, payload, msg) => {
    e.preventDefault();
    const btn = e.submitter; setBusy(btn, true);
    try { const s = await api('PUT', 'profile', payload); state.user = s.user; state.csrf = s.csrf; toast(msg); if (e.target.id === 'pw') e.target.reset(); }
    catch (err) { toastError(err); }
    setBusy(btn, false);
  };
  $('#pf', root).addEventListener('submit', (e) => save(e, Object.fromEntries(new FormData(e.target)), 'บันทึกข้อมูลแล้ว'));
  $('#pw', root).addEventListener('submit', (e) => {
    const d = Object.fromEntries(new FormData(e.target));
    if (d.new_password !== d.confirm) { e.preventDefault(); return toast('รหัสผ่านใหม่ไม่ตรงกัน', 'err'); }
    save(e, { current_password: d.current_password, new_password: d.new_password }, 'เปลี่ยนรหัสผ่านแล้ว');
  });
}
