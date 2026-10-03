(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const canW = ICS_AUTH.can('roles', 'w');
const P = ['r', 'w', 'd'], GROUPS = [...new Set(DB.PAGES.map(p => p.group))];

function render() {
  const db = DB.load();
  $('#roles').innerHTML = db.roles.map(r => {
    const locked = r.id === DB.ADMIN, n = db.users.filter(u => u.role === r.id).length;
    const dis = locked || !canW ? ' disabled' : '';
    return `<section class="rp-card" data-role="${esc(r.id)}">
      <div class="rp-card-head">
        <div class="ad-rname">
          <input class="ad-name" value="${esc(r.name)}" maxlength="40"${canW ? '' : ' disabled'} aria-label="ชื่อ role">
          <small class="muted">ผู้ใช้ ${n} คน · ${locked ? 'ทุกหน้า (ล็อกไว้ แก้ไม่ได้)' : `เข้าได้ ${DB.PAGES.filter(p => r.perms[p.id]).length} / ${DB.PAGES.length} หน้า`}</small>
        </div>
        ${locked ? '' : `<button class="btn btn-ghost btn-sm ad-del" data-del data-perm="d"${n ? ` disabled title="มีผู้ใช้ ${n} คนใช้ role นี้อยู่ — ย้ายผู้ใช้ไป role อื่นก่อน"` : ' title="ลบ role"'}>${UI.icon('trash')} ลบ</button>`}
      </div>
      <table class="tbl ad-perm">
        <thead><tr><th>หน้า</th><th>R</th><th>W</th><th>D</th></tr></thead>
        <tbody>${GROUPS.map(g => `<tr class="ad-grp"><td colspan="4">${g}</td></tr>` + DB.PAGES.filter(p => p.group === g).map(p => `<tr><td>${UI.icon(p.icon)} ${esc(p.name)}</td>${P.map(x =>
          `<td><input type="checkbox" data-page="${p.id}" data-p="${x}"${locked || (r.perms[p.id] || '').includes(x) ? ' checked' : ''}${dis} aria-label="${esc(p.name)} ${x.toUpperCase()}"></td>`).join('')}</tr>`).join('')).join('')}
        </tbody>
      </table>
    </section>`;
  }).join('');
}

// แก้แล้วบันทึกทันที; W/D ต้องมี R (ติ๊ก W/D → ติ๊ก R ให้, เอา R ออก → เอา W/D ออกด้วย)
$('#roles').addEventListener('change', e => {
  const card = e.target.closest('[data-role]'), db = DB.load(), role = db.roles.find(r => r.id === card.dataset.role);
  if (!role || role.id === DB.ADMIN && !e.target.classList.contains('ad-name')) return;
  if (e.target.classList.contains('ad-name')) role.name = e.target.value.trim() || role.name;
  else {
    const { page, p } = e.target.dataset;
    let s = new Set(role.perms[page] || '');
    e.target.checked ? s.add(p) : s.delete(p);
    if (p !== 'r' && e.target.checked) s.add('r');
    if (p === 'r' && !e.target.checked) s = new Set();
    role.perms[page] = P.filter(x => s.has(x)).join('');
    if (!role.perms[page]) delete role.perms[page];
  }
  DB.save(db); render();
});

$('#roles').addEventListener('click', e => {
  const b = e.target.closest('[data-del]'); if (!b || b.disabled) return;
  const id = b.closest('[data-role]').dataset.role, db = DB.load();
  if (db.users.some(u => u.role === id) || !confirm(`ลบ role "${db.roles.find(r => r.id === id).name}" ?`)) return;
  db.roles = db.roles.filter(r => r.id !== id); DB.save(db); render();
});

$('#addForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = e.target.name.value.trim(), db = DB.load();
  // id จากชื่อ: ตัวเล็ก a-z0-9 ที่เหลือเป็น - ; ชื่อไทยล้วน → role-<เวลา>
  let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'role-' + Date.now().toString(36);
  while (db.roles.some(r => r.id === id)) id += '-2';
  db.roles.push({ id, name, perms: {} }); DB.save(db);
  e.target.reset(); render(); UI.toast(`เพิ่ม role ${name} แล้ว — ติ๊กสิทธิ์ในการ์ดด้านล่าง`);
});
render();
})();
