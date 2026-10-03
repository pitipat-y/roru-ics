// หน้าหลัก: งานที่รอทำ (นับจากข้อมูลคลัง/หน้าร้าน) + การ์ดทุกเมนูที่มีสิทธิ์ พร้อมคำอธิบาย
(() => {
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
const money = n => (+n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const read = k => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (_) { return {}; } };
const can = id => ICS_AUTH.can(id, 'r');
const { user, role } = ICS_AUTH.session();
const pages = DB.PAGES.filter(p => can(p.id));

const inv = read('ics-inv'), pos = read('ics-pos'), docs = inv.docs || [], bills = pos.bills || [];
const count = (type, st) => docs.filter(d => d.type === type && d.status === st).length;
const bal = new Map(); (inv.moves || []).forEach(m => bal.set(norm(m.item), (bal.get(norm(m.item)) || 0) + m.qty));
const today = new Date().toLocaleDateString('sv-SE');
const paidToday = bills.filter(b => b.status === 'paid' && new Date(b.paidAt).toLocaleDateString('sv-SE') === today);

// งานที่รอทำ: go = หน้าปลายทาง, data = ส่งตัวกรองไปให้หน้านั้น (UI.handoff)
const todos = [
  can('pos-tables') && { go: 'pos-tables', icon: 'tables', n: bills.filter(b => b.status === 'open').length, label: 'บิลที่เปิดอยู่', hint: 'โต๊ะที่มีลูกค้า + กลับบ้าน' },
  can('pos-report') && { go: 'pos-report', icon: 'trend', n: money(paidToday.reduce((s, b) => s + b.paid.total, 0)), label: 'ยอดขายวันนี้', hint: `${paidToday.length} บิล`, value: true },
  can('pr') && { go: 'pr', data: { status: 'pending' }, icon: 'filePlus', n: count('pr', 'pending'), label: 'PR รออนุมัติ', hint: 'กดเพื่ออนุมัติ' },
  can('pr') && { go: 'pr', data: { status: 'approved' }, icon: 'cart', n: count('pr', 'approved'), label: 'PR รอออก PO', hint: 'อนุมัติแล้ว ยังไม่สั่งซื้อ' },
  can('po') && { go: 'po', data: { status: 'open' }, icon: 'inbound', n: count('po', 'open'), label: 'PO รอรับของ', hint: 'ของยังไม่เข้าคลัง' },
  can('stock') && { go: 'stock', data: { filter: 'neg' }, icon: 'alert', n: [...bal.values()].filter(v => v < 0).length, label: 'วัตถุดิบยอดติดลบ', hint: 'ควรตรวจนับ', warn: true },
].filter(Boolean);

const hour = new Date().getHours();
document.getElementById('home').innerHTML = `
  <header class="rp-head"><div class="ph"><span class="ph-icon">${UI.icon('home')}</span><div>
    <div class="eyebrow">${new Date().toLocaleDateString('th-TH', { dateStyle: 'full' })}</div>
    <h1>สวัสดี${hour < 12 ? 'ตอนเช้า' : hour < 17 ? 'ตอนบ่าย' : 'ตอนเย็น'} ${esc(user.name || user.username)}</h1>
    <p class="muted">${esc(role.name)} · เลือกงานที่ต้องทำด้านล่าง หรือเลือกจากเมนูด้านซ้าย</p></div></div></header>
  ${todos.length ? `<section class="hm-sec"><h2>งานที่รอทำ</h2><div class="hm-grid">${todos.map((t, i) => `
    <button class="hm-card hm-todo${!t.value && !t.n ? ' zero' : ''}${t.warn && t.n ? ' warn' : ''}" data-todo="${i}">
      <span class="ph-icon">${UI.icon(t.icon)}</span><span><span class="n">${t.n}</span><b>${t.label}</b><small>${!t.value && !t.n ? 'ไม่มีค้าง' : t.hint}</small></span>
    </button>`).join('')}</div></section>` : ''}
  ${[...new Set(pages.map(p => p.group))].map(g => `<section class="hm-sec"><h2>${g}</h2><div class="hm-grid">${pages.filter(p => p.group === g).map(p => `
    <button class="hm-card" data-go="${p.id}"><span class="ph-icon">${UI.icon(p.icon)}</span><span><b>${p.name}</b><small>${p.desc}</small></span></button>`).join('')}
  </div></section>`).join('') || '<div class="rp-empty">บัญชีนี้ยังไม่มีสิทธิ์เข้าหน้าใด ติดต่อผู้ดูแลระบบ</div>'}`;

document.getElementById('home').addEventListener('click', e => {
  const t = todos[e.target.closest('[data-todo]')?.dataset.todo];
  if (t) t.data ? UI.handoff(t.go, t.data) : UI.go(t.go);
});
})();
