// ระบบคลัง: PR → PO → รับเข้า / เบิกออก / ตรวจนับ / ค้นหา — ทุกหน้าใช้ไฟล์นี้ เลือกโหมดจาก <main id="inv" data-type="...">
// ข้อมูล: localStorage 'ics-inv' = { seq, docs: [เอกสาร], moves: [รายการเคลื่อนไหว +/-] } ; คงเหลือ = ผลรวม moves
// ponytail: เก็บในเบราว์เซอร์เครื่องเดียว และนับคงเหลือตามชื่อวัตถุดิบ (ไม่แปลงหน่วย) — ย้ายไป DB + หน่วยแปลงได้เมื่อมี backend
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
const fmt = n => (+n || 0).toLocaleString('th-TH', { maximumFractionDigits: 3 });
const money = n => (+n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString('sv-SE');
const fdate = d => d ? new Date(d + 'T00:00').toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '';

const KEY = 'ics-inv';
const load = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.docs) return d; } catch (_) {} return { seq: {}, docs: [], moves: [] }; };
const save = d => localStorage.setItem(KEY, JSON.stringify(d));

const root = $('#inv'), PAGE = root.dataset.type;
const me = ICS_AUTH.session().user.username;

// วัตถุดิบ = จาก Master (js/data.js) + ชื่อที่เคยใช้ในเอกสาร
const materials = (d = load()) => {
  const m = new Map();
  (typeof DEFAULT_MASTER !== 'undefined' ? DEFAULT_MASTER : []).forEach(g => m.set(norm(g.name), { name: g.name, unit: g.unit }));
  d.docs.forEach(x => x.lines.forEach(l => { if (!m.has(norm(l.item))) m.set(norm(l.item), { name: l.item, unit: l.unit }); }));
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
};
const balances = (d = load()) => {
  const b = new Map();
  d.moves.forEach(x => b.set(norm(x.item), (b.get(norm(x.item)) || 0) + x.qty));
  return b;
};
const unitOf = (name, d) => materials(d).find(m => norm(m.name) === norm(name))?.unit || '';

const STATUS = {
  pending: ['รออนุมัติ', 'warn'], approved: ['อนุมัติแล้ว', 'good'], rejected: ['ไม่อนุมัติ', ''],
  ordered: ['สั่งซื้อแล้ว', 'info'], open: ['รอรับของ', 'warn'], received: ['รับของแล้ว', 'good'],
  cancelled: ['ยกเลิก', ''], posted: ['บันทึกแล้ว', 'good'],
};
const badge = s => `<span class="badge${STATUS[s]?.[1] ? ' st-' + STATUS[s][1] : ''}">${STATUS[s]?.[0] || esc(s)}</span>`;
const TYPE_NAME = { pr: 'PR', po: 'PO', 'stock-in': 'รับเข้า', 'stock-out': 'เบิกออก', count: 'ตรวจนับ' };

// เอกสาร: from = สร้างจากเอกสารอื่น (สถานะที่เลือกได้ → สถานะหลังถูกใช้), move = ผลต่อสต๊อก, next = ปุ่มเปลี่ยนสถานะ
const CFG = {
  pr: { title: 'ใบขอซื้อ (PR)', desc: 'ขอซื้อวัตถุดิบ รออนุมัติก่อนออกใบสั่งซื้อ', prefix: 'PR', party: 'ผู้ขอ / แผนก', initial: 'pending',
        next: { pending: [['approved', 'อนุมัติ'], ['rejected', 'ไม่อนุมัติ']] } },
  po: { title: 'ใบสั่งซื้อ (PO)', desc: 'สั่งซื้อจากผู้ขาย สร้างจาก PR ที่อนุมัติแล้วได้', prefix: 'PO', party: 'ผู้ขาย (Supplier)', price: true, initial: 'open',
        from: { type: 'pr', status: 'approved', mark: 'ordered' }, next: { open: [['cancelled', 'ยกเลิก PO']] } },
  'stock-in': { title: 'รับเข้า (Stock-in)', desc: 'รับของเข้าคลัง เพิ่มยอดคงเหลือ อ้างอิง PO ได้', prefix: 'IN', party: 'ผู้ส่ง / ผู้ขาย', price: true, initial: 'posted', move: 1,
        from: { type: 'po', status: 'open', mark: 'received', party: true } },
  'stock-out': { title: 'เบิกออก (Stock-out)', desc: 'เบิกของออกจากคลัง ลดยอดคงเหลือ', prefix: 'OUT', party: 'ผู้เบิก / แผนก', initial: 'posted', move: -1 },
};
const LOCKED = ['ordered', 'received']; // ถูกเอกสารถัดไปใช้แล้ว → ลบไม่ได้ (ลบเอกสารถัดไปก่อน)

const head = (title, desc, actions = '') => `<header class="rp-head ad-head"><div><h1>${title}</h1><p class="muted">${desc}</p></div>${actions}</header>`;
const nextId = (d, type, prefix) => `${prefix}-${String(d.seq[type] = (d.seq[type] || 0) + 1).padStart(4, '0')}`;
const matList = () => `<datalist id="matList">${materials().map(m => `<option value="${esc(m.name)}">`).join('')}</datalist>`;

/* ---------- เอกสาร (PR / PO / รับเข้า / เบิกออก) ---------- */
function docPage(cfg) {
  const statuses = [...new Set([cfg.initial, ...Object.values(cfg.next || {}).flat().map(x => x[0]), cfg.from && cfg.from.mark].filter(Boolean))];
  root.innerHTML = head(cfg.title, cfg.desc, `<button class="btn btn-primary" id="btnNew" data-perm="w">+ สร้าง${cfg.prefix === 'PR' || cfg.prefix === 'PO' ? ' ' + cfg.prefix : 'รายการ'}</button>`) + `
  <section class="rp-card">
    <div class="rp-card-head"><div class="rp-actions">
      <input id="q" type="search" placeholder="ค้นหาเลขที่ / ${cfg.party} / วัตถุดิบ">
      <select id="fs"><option value="">ทุกสถานะ</option>${statuses.filter(s => s !== 'posted').map(s => `<option value="${s}">${STATUS[s][0]}</option>`).join('')}</select>
    </div></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>เลขที่</th><th>วันที่</th><th>${cfg.party}</th><th>รายการ</th>${cfg.price ? '<th class="num">ยอดรวม</th>' : ''}<th>สถานะ</th><th></th></tr></thead>
    <tbody id="rows"></tbody></table></div>
  </section>
  <dialog id="dlg" class="ad-dlg inv-dlg"><form id="form">
    <h2>สร้าง${cfg.title}</h2>
    <div class="inv-grid">
      <label>วันที่<input name="date" type="date" required></label>
      <label>${cfg.party}<input name="party" required maxlength="80" list="partyList"></label>
      ${cfg.from ? `<label class="span2">อ้างอิง ${cfg.from.type.toUpperCase()} <small class="muted">(ไม่บังคับ — เลือกแล้วดึงรายการมาให้)</small><select name="ref"></select></label>` : ''}
    </div>
    <div class="tbl-wrap"><table class="tbl inv-lines"><thead><tr><th>วัตถุดิบ</th><th class="num">จำนวน</th><th>หน่วย</th>${cfg.price ? '<th class="num">ราคา/หน่วย</th><th class="num">รวม</th>' : ''}<th></th></tr></thead><tbody id="lines"></tbody></table></div>
    <div class="inv-under"><button type="button" class="btn btn-ghost" id="addLine">+ เพิ่มรายการ</button>${cfg.price ? '<b id="total"></b>' : ''}</div>
    <label>หมายเหตุ<input name="note" maxlength="200"></label>
    <div class="ad-err" id="err" hidden></div>
    <div class="ad-btns"><button type="button" class="btn btn-ghost" data-close>ยกเลิก</button><button class="btn btn-primary">บันทึก</button></div>
  </form></dialog>
  <dialog id="view" class="ad-dlg inv-dlg"></dialog>
  ${matList()}<datalist id="partyList"></datalist>`;

  const form = $('#form'), dlg = $('#dlg');
  const total = lines => lines.reduce((s, l) => s + l.qty * (l.price || 0), 0);

  function render() {
    const d = load(), q = norm($('#q').value), fs = $('#fs').value;
    const docs = d.docs.filter(x => x.type === PAGE && (!fs || x.status === fs) &&
      (!q || norm([x.id, x.party, x.ref, ...x.lines.map(l => l.item)].join(' ')).includes(q)));
    $('#rows').innerHTML = docs.map(x => `<tr>
      <td class="mono"><a href="#" data-view="${x.id}">${x.id}</a>${x.ref ? `<br><small class="muted mono">จาก ${esc(x.ref)}</small>` : ''}</td>
      <td>${fdate(x.date)}</td><td>${esc(x.party)}</td>
      <td class="inv-items">${x.lines.slice(0, 3).map(l => `${esc(l.item)} ${fmt(l.qty)} ${esc(l.unit)}`).join(', ')}${x.lines.length > 3 ? ` +${x.lines.length - 3}` : ''}</td>
      ${cfg.price ? `<td class="num mono">${money(total(x.lines))}</td>` : ''}
      <td>${badge(x.status)}</td>
      <td class="ad-act">${(cfg.next?.[x.status] || []).map(([s, label]) => `<button class="btn btn-ghost" data-st="${s}" data-id="${x.id}" data-perm="w">${label}</button>`).join('')}
        <button class="btn btn-ghost ad-del" data-del="${x.id}" data-perm="d"${LOCKED.includes(x.status) ? ' disabled title="ถูกใช้ในเอกสารถัดไปแล้ว"' : ''}>ลบ</button></td>
    </tr>`).join('') || `<tr><td colspan="7" class="inv-empty">ยังไม่มี${cfg.title}</td></tr>`;
    $('#partyList').innerHTML = [...new Set(d.docs.filter(x => x.type === PAGE).map(x => x.party))].map(p => `<option value="${esc(p)}">`).join('');
  }

  const bal = balances();
  function lineRow(l = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input class="li-item" list="matList" required value="${esc(l.item || '')}" placeholder="พิมพ์หรือเลือก">${cfg.move ? '<small class="li-bal muted"></small>' : ''}</td>
      <td><input class="li-qty num" type="number" min="0" step="any" required value="${l.qty ?? ''}"></td>
      <td><input class="li-unit" required value="${esc(l.unit || '')}" size="6"></td>
      ${cfg.price ? `<td><input class="li-price num" type="number" min="0" step="any" value="${l.price ?? ''}"></td><td class="num mono li-sum"></td>` : ''}
      <td><button type="button" class="btn btn-ghost ad-del li-del" aria-label="ลบแถว">✕</button></td>`;
    $('#lines').append(tr); syncRow(tr);
  }
  function syncRow(tr) {
    const item = tr.querySelector('.li-item').value;
    if (tr.querySelector('.li-bal')) tr.querySelector('.li-bal').textContent = item ? `คงเหลือ ${fmt(bal.get(norm(item)) || 0)}` : '';
    if (cfg.price) {
      tr.querySelector('.li-sum').textContent = money((+tr.querySelector('.li-qty').value || 0) * (+tr.querySelector('.li-price').value || 0));
      $('#total').textContent = 'รวม ' + money(total(readLines()));
    }
  }
  const readLines = () => $$('#lines tr').map(tr => ({
    item: tr.querySelector('.li-item').value.trim(), qty: +tr.querySelector('.li-qty').value || 0, unit: tr.querySelector('.li-unit').value.trim(),
    ...(cfg.price ? { price: +tr.querySelector('.li-price').value || 0 } : {}),
  })).filter(l => l.item && l.qty > 0);

  $('#lines').addEventListener('input', e => {
    const tr = e.target.closest('tr');
    if (e.target.classList.contains('li-item')) { const u = unitOf(e.target.value); if (u) tr.querySelector('.li-unit').value = u; }
    syncRow(tr);
  });
  $('#lines').addEventListener('click', e => { if (e.target.closest('.li-del')) { e.target.closest('tr').remove(); if (!$('#lines tr')) lineRow(); else syncRow($('#lines tr')); } });
  $('#addLine').onclick = () => lineRow();

  $('#btnNew').onclick = () => {
    form.reset(); form.date.value = today(); $('#err').hidden = true; $('#lines').innerHTML = ''; lineRow();
    if (cfg.from) {
      const src = load().docs.filter(x => x.type === cfg.from.type && x.status === cfg.from.status);
      form.ref.innerHTML = '<option value="">— ไม่อ้างอิง —</option>' + src.map(x => `<option value="${x.id}">${x.id} · ${esc(x.party)} · ${fdate(x.date)}</option>`).join('');
    }
    dlg.showModal();
  };
  if (cfg.from) form.ref.onchange = () => {
    const src = load().docs.find(x => x.id === form.ref.value); if (!src) return;
    $('#lines').innerHTML = ''; src.lines.forEach(l => lineRow(l));
    if (cfg.from.party) form.party.value = src.party;
  };

  form.addEventListener('submit', e => {
    e.preventDefault();
    const err = m => { $('#err').textContent = m; $('#err').hidden = false; };
    const lines = readLines();
    if (!lines.length) return err('ใส่อย่างน้อย 1 รายการ (จำนวนมากกว่า 0)');
    if (cfg.move < 0) {
      const over = lines.filter(l => l.qty > (bal.get(norm(l.item)) || 0));
      if (over.length && !confirm(`เบิกเกินคงเหลือ: ${over.map(l => `${l.item} (คงเหลือ ${fmt(bal.get(norm(l.item)) || 0)})`).join(', ')}\nบันทึกต่อหรือไม่? ยอดจะติดลบ`)) return;
    }
    const d = load(), ts = Date.now();
    const doc = { id: nextId(d, PAGE, cfg.prefix), type: PAGE, date: form.date.value, party: form.party.value.trim(),
      ref: cfg.from ? form.ref.value : '', note: form.note.value.trim(), lines, status: cfg.initial, by: me, ts };
    d.docs.unshift(doc);
    if (cfg.move) lines.forEach(l => d.moves.push({ ts, date: doc.date, item: l.item, unit: l.unit, qty: cfg.move * l.qty, doc: doc.id, type: PAGE }));
    if (doc.ref) { const r = d.docs.find(x => x.id === doc.ref); if (r) r.status = cfg.from.mark; }
    save(d); dlg.close(); location.reload(); // reload = คงเหลือ/รายการใน datalist อัปเดต
  });

  root.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return e.target.closest('dialog').close();
    const v = e.target.closest('[data-view]'), st = e.target.closest('[data-st]'), del = e.target.closest('[data-del]');
    if (v) { e.preventDefault(); return view(v.dataset.view); }
    if (st) { const d = load(); d.docs.find(x => x.id === st.dataset.id).status = st.dataset.st; save(d); return render(); }
    if (del && !del.disabled && confirm(`ลบ ${del.dataset.del}?${cfg.move ? ' ยอดสต๊อกจะถูกย้อนกลับ' : ''}`)) {
      const d = load(), doc = d.docs.find(x => x.id === del.dataset.del);
      d.docs = d.docs.filter(x => x !== doc);
      d.moves = d.moves.filter(m => m.doc !== doc.id);
      if (doc.ref) { const r = d.docs.find(x => x.id === doc.ref); if (r) r.status = cfg.from.status; } // คืนสถานะเอกสารต้นทาง
      save(d); render();
    }
  });

  function view(id) {
    const x = load().docs.find(d => d.id === id);
    $('#view').innerHTML = `<h2>${x.id} ${badge(x.status)}</h2>
      <dl class="inv-dl"><dt>วันที่</dt><dd>${fdate(x.date)}</dd><dt>${cfg.party}</dt><dd>${esc(x.party)}</dd>
      ${x.ref ? `<dt>อ้างอิง</dt><dd class="mono">${esc(x.ref)}</dd>` : ''}<dt>สร้างโดย</dt><dd>${esc(x.by)} · ${new Date(x.ts).toLocaleString('th-TH')}</dd>
      ${x.note ? `<dt>หมายเหตุ</dt><dd>${esc(x.note)}</dd>` : ''}</dl>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>วัตถุดิบ</th><th class="num">จำนวน</th><th>หน่วย</th>${cfg.price ? '<th class="num">ราคา</th><th class="num">รวม</th>' : ''}</tr></thead>
      <tbody>${x.lines.map(l => `<tr><td>${esc(l.item)}</td><td class="num mono">${fmt(l.qty)}</td><td>${esc(l.unit)}</td>${cfg.price ? `<td class="num mono">${money(l.price)}</td><td class="num mono">${money(l.qty * l.price)}</td>` : ''}</tr>`).join('')}</tbody>
      ${cfg.price ? `<tfoot><tr><td colspan="4"><b>รวมทั้งสิ้น</b></td><td class="num mono"><b>${money(total(x.lines))}</b></td></tr></tfoot>` : ''}</table></div>
      <div class="ad-btns"><button class="btn btn-ghost" data-close>ปิด</button></div>`;
    $('#view').showModal();
  }

  $('#q').addEventListener('input', render); $('#fs').addEventListener('change', render);
  render();
}

/* ---------- สต๊อกคงเหลือ / ตรวจนับ ---------- */
function stockPage() {
  root.innerHTML = head('สต๊อกคงเหลือ / ตรวจนับ', 'ยอดคงเหลือ = รับเข้า − เบิกออก ± ปรับจากตรวจนับ · ใส่ยอดนับจริงแล้วบันทึกเพื่อปรับยอด') + `
  <section class="rp-card">
    <div class="rp-card-head"><div class="rp-actions"><input id="q" type="search" placeholder="ค้นหาวัตถุดิบ">
      <label class="inv-chk"><input type="checkbox" id="onlyStock"> เฉพาะที่มีความเคลื่อนไหว</label></div><small class="muted" id="lastCount"></small></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>วัตถุดิบ</th><th>หน่วย</th><th class="num">คงเหลือในระบบ</th><th class="num" data-perm="w">นับจริง</th><th class="num" data-perm="w">ผลต่าง</th></tr></thead>
    <tbody id="rows"></tbody></table></div>
    <div class="inv-under" data-perm="w"><input id="note" placeholder="หมายเหตุการตรวจนับ" maxlength="200"><button class="btn btn-primary" id="btnSave">บันทึกผลตรวจนับ</button></div>
  </section>`;
  const counted = new Map(); // ค่าที่พิมพ์ค้างไว้ ไม่หายตอนค้นหา
  function render() {
    const d = load(), bal = balances(d), q = norm($('#q').value), only = $('#onlyStock').checked;
    const moved = new Set(d.moves.map(m => norm(m.item)));
    $('#rows').innerHTML = materials(d).filter(m => (!q || norm(m.name).includes(q)) && (!only || moved.has(norm(m.name)))).map(m => {
      const k = norm(m.name), b = bal.get(k) || 0, c = counted.get(k);
      const diff = c === undefined || c === '' ? '' : +c - b;
      return `<tr><td>${esc(m.name)}</td><td>${esc(m.unit)}</td><td class="num mono${b < 0 ? ' inv-neg' : ''}">${fmt(b)}</td>
        <td class="num" data-perm="w"><input class="num inv-count" type="number" step="any" min="0" data-k="${esc(k)}" data-name="${esc(m.name)}" data-unit="${esc(m.unit)}" value="${c ?? ''}"></td>
        <td class="num mono" data-perm="w">${diff === '' ? '' : `<span class="${diff < 0 ? 'inv-neg' : diff > 0 ? 'inv-pos' : 'muted'}">${diff > 0 ? '+' : ''}${fmt(diff)}</span>`}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="inv-empty">ไม่พบวัตถุดิบ</td></tr>';
    const last = d.docs.find(x => x.type === 'count');
    $('#lastCount').textContent = last ? `ตรวจนับล่าสุด ${last.id} · ${fdate(last.date)} · โดย ${last.by}` : 'ยังไม่เคยตรวจนับ';
  }
  $('#rows').addEventListener('change', e => { if (e.target.dataset.k) { counted.set(e.target.dataset.k, e.target.value); render(); } });
  $('#btnSave').onclick = () => {
    const d = load(), bal = balances(d), ts = Date.now();
    const names = new Map(materials(d).map(m => [norm(m.name), m]));
    const lines = [...counted].filter(([, v]) => v !== '').map(([k, v]) => ({ item: names.get(k).name, unit: names.get(k).unit, qty: +v, diff: +v - (bal.get(k) || 0) }));
    if (!lines.length) return alert('ยังไม่ได้ใส่ยอดนับจริง');
    if (!confirm(`บันทึกผลตรวจนับ ${lines.length} รายการ? (ปรับยอด ${lines.filter(l => l.diff).length} รายการ)`)) return;
    const doc = { id: nextId(d, 'count', 'CNT'), type: 'count', date: today(), party: '', ref: '', note: $('#note').value.trim(), lines, status: 'posted', by: me, ts };
    d.docs.unshift(doc);
    lines.filter(l => l.diff).forEach(l => d.moves.push({ ts, date: doc.date, item: l.item, unit: l.unit, qty: l.diff, doc: doc.id, type: 'count' }));
    save(d); counted.clear(); $('#note').value = ''; render();
    alert(`บันทึก ${doc.id} แล้ว`);
  };
  $('#q').addEventListener('input', render); $('#onlyStock').addEventListener('change', render);
  render();
}

/* ---------- ค้นหาวัตถุดิบ (tracker) ---------- */
function trackerPage() {
  root.innerHTML = head('ค้นหาวัตถุดิบ', 'ดูคงเหลือ ความเคลื่อนไหว และของที่กำลังขอซื้อ/สั่งซื้อ') + `
  <input id="q" class="inv-search" type="search" placeholder="พิมพ์ชื่อวัตถุดิบ เช่น Uni, Ikura" autofocus>
  <div class="inv-chips" id="chips"></div>
  <div id="detail"></div>`;
  let current = null;
  function render() {
    const d = load(), bal = balances(d), q = norm($('#q').value);
    const list = materials(d).filter(m => !q || norm(m.name).includes(q));
    $('#chips').innerHTML = list.map(m => { const b = bal.get(norm(m.name)) || 0;
      return `<button class="inv-chip${current === norm(m.name) ? ' on' : ''}" data-k="${esc(norm(m.name))}">${esc(m.name)} <span class="mono${b < 0 ? ' inv-neg' : ''}">${fmt(b)}</span></button>`; }).join('') || '<div class="inv-empty">ไม่พบวัตถุดิบ</div>';
    if (!current && list.length === 1) current = norm(list[0].name);
    detail(d, bal);
  }
  function detail(d, bal) {
    if (!current) { $('#detail').innerHTML = ''; return; }
    const m = materials(d).find(x => norm(x.name) === current); if (!m) { $('#detail').innerHTML = ''; return; }
    const sumOpen = (type, sts) => d.docs.filter(x => x.type === type && sts.includes(x.status)).flatMap(x => x.lines.filter(l => norm(l.item) === current).map(l => ({ ...l, doc: x })));
    const prs = sumOpen('pr', ['pending', 'approved']), pos = sumOpen('po', ['open']);
    let run = 0;
    const moves = d.moves.filter(x => norm(x.item) === current).sort((a, b) => a.ts - b.ts).map(x => ({ ...x, run: run += x.qty })).reverse();
    const sum = arr => fmt(arr.reduce((s, l) => s + l.qty, 0));
    $('#detail').innerHTML = `
    <section class="rp-stats">
      <div class="rp-stat"><small>คงเหลือ (${esc(m.unit)})</small><b class="${(bal.get(current) || 0) < 0 ? 'inv-neg' : ''}">${fmt(bal.get(current) || 0)}</b></div>
      <div class="rp-stat"><small>PR รออนุมัติ/อนุมัติแล้ว</small><b>${sum(prs)}</b></div>
      <div class="rp-stat"><small>PO รอรับของ</small><b>${sum(pos)}</b></div>
    </section>
    ${prs.length + pos.length ? `<section class="rp-card"><div class="rp-card-head"><h2>กำลังขอซื้อ / สั่งซื้อ</h2></div><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>เอกสาร</th><th>วันที่</th><th>ผู้ขอ/ผู้ขาย</th><th class="num">จำนวน</th><th>สถานะ</th></tr></thead>
      <tbody>${[...prs, ...pos].map(l => `<tr><td class="mono">${l.doc.id}</td><td>${fdate(l.doc.date)}</td><td>${esc(l.doc.party)}</td><td class="num mono">${fmt(l.qty)} ${esc(l.unit)}</td><td>${badge(l.doc.status)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
    <section class="rp-card"><div class="rp-card-head"><h2>ความเคลื่อนไหว ${esc(m.name)}</h2><small class="muted">${moves.length} รายการ</small></div><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>วันที่</th><th>เอกสาร</th><th>ประเภท</th><th class="num">เข้า/ออก</th><th class="num">คงเหลือ</th></tr></thead>
      <tbody>${moves.map(x => `<tr><td>${fdate(x.date)}</td><td class="mono">${x.doc}</td><td>${TYPE_NAME[x.type] || x.type}</td>
        <td class="num mono ${x.qty < 0 ? 'inv-neg' : 'inv-pos'}">${x.qty > 0 ? '+' : ''}${fmt(x.qty)}</td><td class="num mono">${fmt(x.run)}</td></tr>`).join('') || '<tr><td colspan="5" class="inv-empty">ยังไม่มีความเคลื่อนไหว</td></tr>'}</tbody></table></div></section>`;
  }
  $('#q').addEventListener('input', () => { current = null; render(); });
  $('#chips').addEventListener('click', e => { const c = e.target.closest('[data-k]'); if (c) { current = c.dataset.k; render(); } });
  render();
}

if (CFG[PAGE]) docPage(CFG[PAGE]);
else if (PAGE === 'stock') stockPage();
else if (PAGE === 'tracker') trackerPage();
})();
