(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const me = ICS_AUTH.session().user.username;
const form = $('#form'), dlg = $('#dlg');
let editing = null; // username ที่กำลังแก้, null = เพิ่มใหม่

function render() {
  const db = DB.load();
  const roleCell = id => { const r = db.roles.find(x => x.id === id);
    return r ? `<span class="badge${r.id === DB.ADMIN ? ' badge-accent' : ''}">${esc(r.name)}</span>` : `<span class="ad-warn">ไม่พบ role "${esc(id)}"</span>`; };
  $('#rows').innerHTML = db.users.map(u => `<tr>
    <td class="mono">${esc(u.username)}${u.username === me ? ' <span class="badge">คุณ</span>' : ''}</td>
    <td>${esc(u.name)}</td>
    <td>${roleCell(u.role)}</td>
    <td class="ad-act">
      <button class="btn btn-ghost" data-edit="${esc(u.username)}" data-perm="w">แก้ไข</button>
      <button class="btn btn-ghost ad-del" data-del="${esc(u.username)}" data-perm="d"${u.username === me ? ' disabled title="ลบบัญชีตัวเองไม่ได้"' : ''}>ลบ</button>
    </td></tr>`).join('');
}

function open(username) {
  const db = DB.load(), u = db.users.find(x => x.username === username);
  editing = u ? u.username : null;
  form.reset(); $('#err').hidden = true;
  form.role.innerHTML = db.roles.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
  $('#dlgTitle').textContent = u ? `แก้ไข ${u.username}` : 'เพิ่มผู้ใช้';
  form.username.readOnly = !!u; // username เป็น key ของ session — ไม่ให้เปลี่ยน
  form.password.required = !u;
  $('#pwdHint').textContent = u ? 'เว้นว่าง = ไม่เปลี่ยน' : 'อย่างน้อย 6 ตัว';
  form.role.disabled = u?.username === me; // กันเปลี่ยน role ตัวเองจนล็อกตัวเองออก
  if (u) { form.username.value = u.username; form.name.value = u.name; form.role.value = u.role; }
  dlg.showModal();
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const err = m => { $('#err').textContent = m; $('#err').hidden = false; };
  const db = DB.load(), username = form.username.value.trim(), pwd = form.password.value;
  if (!editing && db.users.some(u => u.username === username)) return err('ชื่อผู้ใช้นี้มีอยู่แล้ว');
  const hash = pwd ? await ICS_AUTH.sha256(pwd) : null;
  if (editing) {
    const u = db.users.find(x => x.username === editing);
    u.name = form.name.value.trim();
    if (!form.role.disabled) u.role = form.role.value;
    if (hash) u.hash = hash;
  } else {
    db.users.push({ username, name: form.name.value.trim(), role: form.role.value, hash });
  }
  DB.save(db);
  if (editing === me && hash) await ICS_AUTH.login(me, pwd); // เปลี่ยนรหัสตัวเอง → ต่อ session ให้
  dlg.close(); render();
});

$('#btnAdd').onclick = () => open(null);
$('#btnCancel').onclick = () => dlg.close();
$('#rows').addEventListener('click', e => {
  const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
  if (ed) open(ed.dataset.edit);
  if (del && !del.disabled && confirm(`ลบผู้ใช้ "${del.dataset.del}" ?`)) {
    const db = DB.load(); db.users = db.users.filter(u => u.username !== del.dataset.del); DB.save(db); render();
  }
});
$('#btnReset').onclick = () => {
  if (!confirm('รีเซ็ตผู้ใช้และ role ทั้งหมดกลับเป็นข้อมูลตั้งต้น?')) return;
  DB.reset(); top.location.reload(); // session อาจไม่ valid แล้ว → ให้ guard ตัดสิน
};
render();
})();
