(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase(); // เหมือน app.js
const fmt = n => n.toLocaleString('th-TH', {maximumFractionDigits: 2});
const when = ts => new Date(ts).toLocaleString('th-TH', {dateStyle: 'medium', timeStyle: 'short'});

let history = [];
try { history = JSON.parse(localStorage.getItem('ics-history') || '[]'); } catch (_) {}
if (!history.length) {
  // file:// บางเบราว์เซอร์ (Firefox) แยก localStorage ต่อไฟล์ — หน้านี้มองไม่เห็นประวัติของ material.html
  if (location.protocol === 'file:') $('#empty').innerHTML = 'ไม่พบประวัติ: เปิดไฟล์ตรงจากเครื่อง (file://) เบราว์เซอร์จะแยกข้อมูลแต่ละหน้า<br>ให้เปิดผ่าน server แทน เช่น <code>python3 -m http.server</code> แล้วเข้า <code>http://localhost:8000</code>';
  $('#empty').hidden = false; return;
}

// ชื่อไฟล์ซ้ำ → ใช้อันล่าสุด (ts มากสุด)
const latest = new Map(), dupCount = new Map();
history.forEach(h => {
  const k = norm(h.fileName);
  dupCount.set(k, (dupCount.get(k) || 0) + 1);
  if (!latest.has(k) || h.ts > latest.get(k).ts) latest.set(k, h);
});
const files = [...latest.values()].sort((a, b) => b.ts - a.ts);
// ไฟล์ "รวม N ไฟล์" เป็นผลรวมของไฟล์อื่นอยู่แล้ว — ไม่เลือกไว้ก่อน กันนับซ้ำ
const isMerged = h => /^รวม \d+ ไฟล์/.test(h.fileName);
const selected = new Set(files.filter(h => !isMerged(h)).map(h => h.id));

$('#report').hidden = false;
$('#fileCount').textContent = `(${files.length} ไฟล์ไม่ซ้ำ จากประวัติ ${history.length} รายการ)`;
$('#files').innerHTML = files.map(h => {
  const d = dupCount.get(norm(h.fileName)) - 1;
  return `<li><label><input type="checkbox" value="${h.id}"${selected.has(h.id) ? ' checked' : ''}>
    <span><span class="fn" title="${esc(h.fileName)}">${esc(h.fileName)}</span>
    <small>${when(h.ts)} · ${h.rowCount ?? h.sales.length} รายการ${d ? ` · <span class="dup">ซ้ำ ${d} ครั้ง ใช้อันล่าสุด</span>` : ''}${isMerged(h) ? ' · ไฟล์รวม' : ''}</small></span></label></li>`;
}).join('');

const bars = (rows) => {
  if (!rows.length) return '<div class="none">ไม่มีข้อมูล</div>';
  const max = Math.max(...rows.map(r => r.qty)) || 1;
  return rows.map(r => `<div class="lbl" title="${esc(r.name)}">${esc(r.name)}</div>
    <div class="track"><div class="bar" style="width:${Math.max(0.5, r.qty / max * 100)}%"></div><span class="val">${fmt(r.qty)}</span></div>`).join('');
};

function render() {
  const chosen = files.filter(h => selected.has(h.id));
  const menus = new Map();
  const perFile = chosen.map(h => {
    let total = 0;
    h.sales.forEach(r => {
      total += r.q;
      const k = norm(r.d), cur = menus.get(k) || {name: r.d, qty: 0};
      cur.qty += r.q; menus.set(k, cur);
    });
    return {name: h.fileName, qty: total};
  });
  const menuRows = [...menus.values()].sort((a, b) => b.qty - a.qty);
  const q = norm($('#q').value), top = +$('#top').value;
  const shown = menuRows.filter(r => !q || norm(r.name).includes(q));

  $('#stFiles').textContent = chosen.length;
  $('#stMenus').textContent = fmt(menuRows.length);
  $('#stQty').textContent = fmt(perFile.reduce((s, f) => s + f.qty, 0));
  $('#chartFiles').innerHTML = bars(perFile);
  $('#chartMenus').innerHTML = bars(top ? shown.slice(0, top) : shown);
}

$('#files').addEventListener('change', e => { e.target.checked ? selected.add(e.target.value) : selected.delete(e.target.value); render(); });
const setAll = on => { selected.clear(); document.querySelectorAll('#files input').forEach(i => { i.checked = on; if (on) selected.add(i.value); }); render(); };
$('#selAll').onclick = () => setAll(true);
$('#selNone').onclick = () => setAll(false);
$('#q').addEventListener('input', render);
$('#top').addEventListener('change', render);
render();
})();
