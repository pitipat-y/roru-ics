// ระบบคลัง: PR → PO → รับเข้า / เบิกออก / ตรวจนับ / ค้นหา — ทุกหน้าใช้ไฟล์นี้ เลือกโหมดจาก <main id="inv" data-type="...">
// ข้อมูล: localStorage 'ics-inv' = { seq, docs: [เอกสาร], moves: [รายการเคลื่อนไหว +/-] } ; คงเหลือ = ผลรวม moves
// ponytail: เก็บในเบราว์เซอร์เครื่องเดียว และนับคงเหลือตามชื่อวัตถุดิบ (ไม่แปลงหน่วย) — ย้ายไป DB + หน่วยแปลงได้เมื่อมี backend
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
const fmt = n => (+n || 0).toLocaleString('th-TH', { maximumFractionDigits: 3 });
const money = n => (+n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString('sv-SE');
const fdate = d => d ? new Date(d + 'T00:00').toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '';
const ic = UI.icon;

const KEY = 'ics-inv';
const load = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.docs) return d; } catch (_) {} return { seq: {}, docs: [], moves: [] }; };
const save = d => localStorage.setItem(KEY, JSON.stringify(d));

const root = $('#inv'), PAGE = root.dataset.type;
const me = ICS_AUTH.session().user.username;
const can = (p, page = PAGE) => ICS_AUTH.can(page, p);

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

// เอกสาร: from = สร้างจากเอกสารอื่น (สถานะที่เลือกได้ → สถานะหลังถูกใช้), move = ผลต่อสต๊อก
// next = ปุ่มเปลี่ยนสถานะ [สถานะใหม่, ป้าย, ไอคอน, คลาสปุ่ม], step = ปุ่มไปขั้นถัดไป [เมื่อสถานะ, หน้า, ป้าย, ไอคอน]
const CFG = {
  pr: { prefix: 'PR', create: 'สร้าง PR', party: 'ผู้ขอ / แผนก', initial: 'pending', statuses: ['pending', 'approved', 'ordered', 'rejected'],
        next: { pending: [['approved', 'อนุมัติ', 'check', 'btn-success'], ['rejected', 'ไม่อนุมัติ', 'x', 'btn-ghost']] },
        step: ['approved', 'po', 'ออก PO', 'cart'] },
  po: { prefix: 'PO', create: 'สร้าง PO', party: 'ผู้ขาย (Supplier)', price: true, initial: 'open', statuses: ['open', 'received', 'cancelled'],
        from: { type: 'pr', status: 'approved', mark: 'ordered' }, next: { open: [['cancelled', 'ยกเลิก', 'x', 'btn-ghost']] },
        step: ['open', 'stock-in', 'รับของ', 'inbound'] },
  'stock-in': { prefix: 'IN', create: 'รับของเข้า', party: 'ผู้ส่ง / ผู้ขาย', price: true, initial: 'posted', move: 1,
        from: { type: 'po', status: 'open', mark: 'received', party: true } },
  'stock-out': { prefix: 'OUT', create: 'เบิกของออก', party: 'ผู้เบิก / แผนก', initial: 'posted', move: -1 },
};
const LOCKED = ['ordered', 'received']; // ถูกเอกสารถัดไปใช้แล้ว → ลบไม่ได้ (ลบเอกสารถัดไปก่อน)
const nextId = (d, type, prefix) => `${prefix}-${String(d.seq[type] = (d.seq[type] || 0) + 1).padStart(4, '0')}`;

// แถบขั้นตอน PR → PO → รับเข้า: แต่ละขั้นบอกงานที่ค้างรอทำที่ขั้นนั้น
const FLOW = [['pr', 'ขอซื้อ', 'pr', 'pending', 'รออนุมัติ'], ['po', 'สั่งซื้อ', 'pr', 'approved', 'PR รอออก PO'], ['stock-in', 'รับเข้า', 'po', 'open', 'PO รอรับของ']];
const flowHTML = d => FLOW.map(([id, label, type, st, txt], i) => {
  const n = d.docs.filter(x => x.type === type && x.status === st).length, link = id !== PAGE && can('r', id);
  return `${i ? `<span class="flow-arrow">${ic('arrow')}</span>` : ''}<${link ? `button data-go="${id}"` : 'div'} class="flow-step${id === PAGE ? ' on' : ''}">
    <i>${i + 1}</i><span><b>${label}</b><small${n ? ' class="has"' : ''}>${n ? `${txt} ${n}` : 'ไม่มีงานค้าง'}</small></span></${link ? 'button' : 'div'}>`;
}).join('');

/* ---------- เอกสาร (PR / PO / รับเข้า / เบิกออก) ---------- */
function docPage(cfg) {
  const P = UI.page(PAGE);
  root.innerHTML = UI.head(PAGE, `<button class="btn btn-primary" id="btnNew" data-perm="w">${ic('plus')} ${cfg.create}</button>`)
    + (FLOW.some(f => f[0] === PAGE) ? '<nav class="flow" id="flow" aria-label="ขั้นตอนการสั่งซื้อ"></nav>' : '') + `
  <section class="rp-card">
    <div class="rp-card-head">${cfg.statuses ? '<div class="chips" id="chips"></div>' : '<span></span>'}
      <input id="q" class="inv-q" type="search" placeholder="ค้นหาเลขที่ / ${cfg.party} / วัตถุดิบ"></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>เลขที่</th><th>วันที่</th><th>${cfg.party}</th><th>รายการ</th>${cfg.price ? '<th class="num">ยอดรวม</th>' : ''}<th>สถานะ</th><th></th></tr></thead>
    <tbody id="rows"></tbody></table></div>
  </section>
  <dialog id="dlg" class="ad-dlg inv-dlg"><form id="form">
    <h2>${cfg.create}</h2>
    <div class="inv-grid">
      <label>วันที่<input name="date" type="date" required></label>
      <label>${cfg.party}<input name="party" required maxlength="80" list="partyList"></label>
      ${cfg.from ? `<label class="span2">ดึงรายการจาก ${cfg.from.type.toUpperCase()} <small class="muted">(ไม่บังคับ)</small><select name="ref"></select></label>` : ''}
    </div>
    <div class="tbl-wrap"><table class="tbl inv-lines"><thead><tr><th>วัตถุดิบ</th><th class="num">จำนวน</th><th>หน่วย</th>${cfg.price ? '<th class="num">ราคา/หน่วย</th><th class="num">รวม</th>' : ''}<th></th></tr></thead><tbody id="lines"></tbody></table></div>
    <div class="inv-under"><button type="button" class="btn btn-ghost btn-sm" id="addLine">${ic('plus')} เพิ่มรายการ</button>
      <small class="muted">กด Enter เพื่อไปช่องถัดไป / แถวใหม่</small>${cfg.price ? '<b id="total"></b>' : ''}</div>
    <label>หมายเหตุ<input name="note" maxlength="200"></label>
    <div class="ad-err" id="err" hidden></div>
    <div class="ad-btns"><button type="button" class="btn btn-ghost" data-close>ยกเลิก</button><button class="btn btn-primary">${ic('check')} บันทึก</button></div>
  </form></dialog>
  <dialog id="view" class="ad-dlg inv-dlg"></dialog>
  <datalist id="matList"></datalist><datalist id="partyList"></datalist>`;

  const form = $('#form'), dlg = $('#dlg');
  const total = lines => lines.reduce((s, l) => s + l.qty * (l.price || 0), 0);
  let fs = '', bal = balances();
  const stepBtn = x => { const s = cfg.step; return s && x.status === s[0] && can('w', s[1])
    ? `<button class="btn btn-primary btn-sm" data-step="${s[1]}" data-ref="${x.id}">${ic(s[3])} ${s[2]}</button>` : ''; };
  const stBtns = x => (cfg.next?.[x.status] || []).map(([s, label, icon, cls]) =>
    `<button class="btn ${cls} btn-sm" data-st="${s}" data-id="${x.id}" data-perm="w">${ic(icon)} ${label}</button>`).join('');

  function render() {
    const d = load(), q = norm($('#q').value), mine = d.docs.filter(x => x.type === PAGE);
    if ($('#flow')) $('#flow').innerHTML = flowHTML(d);
    if (cfg.statuses) $('#chips').innerHTML = ['', ...cfg.statuses].map(s => {
      const n = s ? mine.filter(x => x.status === s).length : mine.length;
      return `<button class="chip${s === fs ? ' on' : ''}${n && STATUS[s]?.[1] === 'warn' ? ' warn' : ''}" data-fs="${s}">${s ? STATUS[s][0] : 'ทั้งหมด'} <span>${n}</span></button>`;
    }).join('');
    const docs = mine.filter(x => (!fs || x.status === fs) && (!q || norm([x.id, x.party, x.ref, ...x.lines.map(l => l.item)].join(' ')).includes(q)));
    $('#rows').innerHTML = docs.map(x => `<tr>
      <td class="mono"><a href="#" data-view="${x.id}">${x.id}</a>${x.ref ? `<br><small class="muted mono">จาก ${esc(x.ref)}</small>` : ''}</td>
      <td>${fdate(x.date)}</td><td>${esc(x.party)}</td>
      <td class="inv-items">${x.lines.slice(0, 3).map(l => `${esc(l.item)} ${fmt(l.qty)} ${esc(l.unit)}`).join(', ')}${x.lines.length > 3 ? ` +${x.lines.length - 3}` : ''}</td>
      ${cfg.price ? `<td class="num mono">${money(total(x.lines))}</td>` : ''}
      <td>${badge(x.status)}</td>
      <td class="ad-act">${stepBtn(x)}${stBtns(x)}<button class="btn btn-ghost btn-sm ad-del" data-del="${x.id}" data-perm="d" aria-label="ลบ ${x.id}"
        ${LOCKED.includes(x.status) ? 'disabled title="ถูกใช้ในเอกสารถัดไปแล้ว — ลบเอกสารถัดไปก่อน"' : 'title="ลบ"'}>${ic('trash')}</button></td>
    </tr>`).join('') || `<tr><td colspan="7"><div class="empty">${ic(P.icon)}${mine.length ? 'ไม่พบรายการตามตัวกรอง'
      : `ยังไม่มี${P.name}${can('w') ? `<button class="btn btn-primary" data-new>${ic('plus')} ${cfg.create}</button>` : ''}`}</div></td></tr>`;
    $('#partyList').innerHTML = [...new Set(mine.map(x => x.party))].map(p => `<option value="${esc(p)}">`).join('');
  }

  function lineRow(l = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input class="li-item" list="matList" required value="${esc(l.item || '')}" placeholder="พิมพ์หรือเลือก"><small class="li-bal muted"></small></td>
      <td><input class="li-qty num" type="number" min="0" step="any" required value="${l.qty ?? ''}"></td>
      <td><input class="li-unit" required value="${esc(l.unit || '')}" size="6"></td>
      ${cfg.price ? `<td><input class="li-price num" type="number" min="0" step="any" value="${l.price ?? ''}"></td><td class="num mono li-sum"></td>` : ''}
      <td><button type="button" class="btn btn-ghost btn-sm ad-del li-del" aria-label="ลบแถว">${ic('x')}</button></td>`;
    $('#lines').append(tr); syncRow(tr);
    return tr;
  }
  // คงเหลือใต้ชื่อวัตถุดิบ (เบิกเกิน → สีแดง) + ยอดรวมราคา
  function syncRow(tr) {
    const item = tr.querySelector('.li-item').value, b = bal.get(norm(item)) || 0, qty = +tr.querySelector('.li-qty').value || 0;
    const hint = tr.querySelector('.li-bal');
    hint.textContent = item ? `คงเหลือ ${fmt(b)} ${tr.querySelector('.li-unit').value}` : '';
    hint.classList.toggle('inv-neg', cfg.move < 0 && qty > b);
    if (cfg.price) {
      tr.querySelector('.li-sum').textContent = money(qty * (+tr.querySelector('.li-price').value || 0));
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
  // Enter = ช่องถัดไป (วัตถุดิบ → จำนวน → ราคา) → แถวถัดไป/แถวใหม่ (ไม่ submit ฟอร์มกลางทาง)
  $('#lines').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    e.preventDefault();
    const tr = e.target.closest('tr'), seq = [...tr.querySelectorAll('.li-item,.li-qty,.li-price')], i = seq.indexOf(e.target);
    if (i >= 0 && i < seq.length - 1) return seq[i + 1].focus();
    (tr.nextElementSibling || lineRow()).querySelector('.li-item').focus();
  });
  $('#lines').addEventListener('click', e => { if (e.target.closest('.li-del')) { e.target.closest('tr').remove(); if (!$('#lines tr')) lineRow(); else syncRow($('#lines tr')); } });
  $('#addLine').onclick = () => lineRow().querySelector('.li-item').focus();

  const fillFromRef = () => {
    const src = load().docs.find(x => x.id === form.ref.value); if (!src) return;
    $('#lines').innerHTML = ''; src.lines.forEach(l => lineRow(l));
    if (cfg.from.party) form.party.value = src.party;
  };
  if (cfg.from) form.ref.onchange = fillFromRef;

  // เปิดฟอร์มสร้าง; pre = { ref } (มาจากปุ่ม "ออก PO"/"รับของ") หรือ { lines } (มาจากหน้าค้นหา/สต๊อก)
  function openNew(pre = {}) {
    if (!can('w')) return;
    form.reset(); form.date.value = today(); $('#err').hidden = true; $('#lines').innerHTML = '';
    bal = balances();
    $('#matList').innerHTML = materials().map(m => `<option value="${esc(m.name)}">`).join('');
    if (cfg.from) {
      const src = load().docs.filter(x => x.type === cfg.from.type && x.status === cfg.from.status);
      form.ref.innerHTML = '<option value="">— ไม่ดึง (กรอกเอง) —</option>' + src.map(x => `<option value="${x.id}">${x.id} · ${esc(x.party)} · ${fdate(x.date)}</option>`).join('');
      if (pre.ref && src.some(x => x.id === pre.ref)) { form.ref.value = pre.ref; fillFromRef(); }
    }
    (pre.lines || []).forEach(l => lineRow(l));
    if (!$('#lines tr')) lineRow();
    dlg.showModal();
    if (!form.party.value) form.party.focus(); else if (pre.lines) $('#lines .li-qty').focus();
  }
  $('#btnNew').onclick = () => openNew();

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
    save(d); dlg.close(); bal = balances(); render();
    UI.toast(`บันทึก ${doc.id} แล้ว${cfg.move ? ` · ${cfg.move > 0 ? 'เพิ่ม' : 'ลด'}สต๊อก ${lines.length} รายการ` : ''}${doc.ref ? ` · ${doc.ref} ${STATUS[cfg.from.mark][0]}` : ''}`);
  });

  root.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return e.target.closest('dialog').close();
    const t = e.target.closest('[data-view],[data-fs],[data-new],[data-step],[data-st],[data-del]'); if (!t) return;
    if (t.dataset.view) { e.preventDefault(); return view(t.dataset.view); }
    if (t.dataset.fs !== undefined) { fs = t.dataset.fs; return render(); }
    if (t.dataset.new !== undefined) return openNew();
    if (t.dataset.step) return UI.handoff(t.dataset.step, { ref: t.dataset.ref });
    if (t.dataset.st) {
      const d = load(); d.docs.find(x => x.id === t.dataset.id).status = t.dataset.st; save(d);
      $('#view').close(); render(); return UI.toast(`${t.dataset.id} → ${STATUS[t.dataset.st][0]}`);
    }
    if (t.dataset.del && !t.disabled && confirm(`ลบ ${t.dataset.del}?${cfg.move ? ' ยอดสต๊อกจะถูกย้อนกลับ' : ''}`)) {
      const d = load(), doc = d.docs.find(x => x.id === t.dataset.del);
      d.docs = d.docs.filter(x => x !== doc);
      d.moves = d.moves.filter(m => m.doc !== doc.id);
      if (doc.ref) { const r = d.docs.find(x => x.id === doc.ref); if (r) r.status = cfg.from.status; } // คืนสถานะเอกสารต้นทาง
      save(d); bal = balances(); render(); UI.toast(`ลบ ${doc.id} แล้ว`);
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
      <div class="ad-btns"><button class="btn btn-ghost" data-close>ปิด</button>${stBtns(x)}${stepBtn(x)}</div>`;
    $('#view').showModal();
  }

  $('#q').addEventListener('input', render);
  const pre = UI.take(PAGE); // มาจากหน้าหลัก (ตัวกรอง) หรือปุ่มขั้นถัดไป (เปิดฟอร์มพร้อมข้อมูล)
  if (pre?.status) fs = pre.status;
  render();
  if (pre?.ref || pre?.lines) openNew(pre);
}

/* ---------- สต๊อกคงเหลือ / ตรวจนับ ---------- */
function stockPage() {
  root.innerHTML = UI.head(PAGE) + `
  <section class="rp-card">
    <div class="rp-card-head"><div class="chips" id="chips"></div><input id="q" class="inv-q" type="search" placeholder="ค้นหาวัตถุดิบ"></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>วัตถุดิบ</th><th>หน่วย</th><th class="num">คงเหลือในระบบ</th><th class="num" data-perm="w">นับจริง</th><th class="num" data-perm="w">ผลต่าง</th><th></th></tr></thead>
    <tbody id="rows"></tbody></table></div>
    <div class="inv-under" data-perm="w"><small class="muted" id="countInfo"></small>
      <input id="note" placeholder="หมายเหตุการตรวจนับ (ไม่บังคับ)" maxlength="200"><button class="btn btn-primary" id="btnSave">${ic('check')} บันทึกผลตรวจนับ</button></div>
  </section>`;
  const FILTERS = [['', 'ทั้งหมด'], ['neg', 'ติดลบ'], ['zero', 'หมด'], ['have', 'มีของ'], ['moved', 'มีความเคลื่อนไหว']];
  const pass = (f, b, moved) => f === 'neg' ? b < 0 : f === 'zero' ? b === 0 : f === 'have' ? b > 0 : f === 'moved' ? moved : true;
  const counted = new Map(); // ค่าที่พิมพ์ค้างไว้ ไม่หายตอนค้นหา/เปลี่ยนตัวกรอง
  let fs = UI.take(PAGE)?.filter || '';
  const diffHTML = (c, b) => c === '' || c === undefined ? '' : (x => `<span class="${x < 0 ? 'inv-neg' : x > 0 ? 'inv-pos' : 'muted'}">${x > 0 ? '+' : ''}${fmt(x)}</span>`)(+c - b);

  function render() {
    const d = load(), bal = balances(d), q = norm($('#q').value), moved = new Set(d.moves.map(m => norm(m.item))), mats = materials(d);
    const ok = (f, m) => pass(f, bal.get(norm(m.name)) || 0, moved.has(norm(m.name)));
    $('#chips').innerHTML = FILTERS.map(([f, label]) => { const n = mats.filter(m => ok(f, m)).length;
      return `<button class="chip${f === fs ? ' on' : ''}${f === 'neg' && n ? ' warn' : ''}" data-fs="${f}">${label} <span>${n}</span></button>`; }).join('');
    $('#rows').innerHTML = mats.filter(m => (!q || norm(m.name).includes(q)) && ok(fs, m)).map(m => {
      const k = norm(m.name), b = bal.get(k) || 0, c = counted.get(k) ?? '';
      return `<tr data-k="${esc(k)}"><td>${esc(m.name)}</td><td>${esc(m.unit)}</td><td class="num mono${b < 0 ? ' inv-neg' : b === 0 ? ' muted' : ''}">${fmt(b)}</td>
        <td class="num" data-perm="w"><input class="num inv-count" type="number" step="any" min="0" value="${esc(c)}" aria-label="นับจริง ${esc(m.name)}"></td>
        <td class="num mono" data-perm="w">${diffHTML(c, b)}</td>
        <td class="ad-act">${can('r', 'tracker') ? `<button class="btn btn-ghost btn-sm" data-track="${esc(k)}" title="ดูความเคลื่อนไหว">${ic('history')}</button>` : ''}${can('w', 'pr')
          ? `<button class="btn btn-ghost btn-sm" data-pr="${esc(m.name)}" data-unit="${esc(m.unit)}" title="ขอซื้อ">${ic('filePlus')}</button>` : ''}</td></tr>`;
    }).join('') || `<tr><td colspan="6"><div class="empty">${ic('package')}ไม่พบวัตถุดิบตามตัวกรอง</div></td></tr>`;
    info(d);
  }
  function info(d = load()) {
    const last = d.docs.find(x => x.type === 'count'), n = [...counted.values()].filter(v => v !== '').length;
    $('#countInfo').textContent = (n ? `กรอกแล้ว ${n} รายการ · ` : '') + (last ? `ตรวจนับล่าสุด ${last.id} ${fdate(last.date)} โดย ${last.by}` : 'ยังไม่เคยตรวจนับ');
    $('#btnSave').disabled = !n;
  }
  // พิมพ์ยอดนับ → อัปเดตผลต่างเฉพาะแถวนั้น (ไม่ render ทั้งตาราง โฟกัสจึงไม่หาย กด Tab/Enter ไปช่องถัดไปได้)
  $('#rows').addEventListener('input', e => {
    if (!e.target.classList.contains('inv-count')) return;
    const tr = e.target.closest('tr'); counted.set(tr.dataset.k, e.target.value);
    tr.children[4].innerHTML = diffHTML(e.target.value, balances().get(tr.dataset.k) || 0); info();
  });
  $('#rows').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.classList.contains('inv-count')) return;
    e.preventDefault(); const all = $$('.inv-count'); all[all.indexOf(e.target) + 1]?.focus();
  });
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-fs],[data-track],[data-pr]'); if (!t) return;
    if (t.dataset.fs !== undefined) { fs = t.dataset.fs; render(); }
    else if (t.dataset.track) UI.handoff('tracker', { item: t.dataset.track });
    else UI.handoff('pr', { lines: [{ item: t.dataset.pr, unit: t.dataset.unit }] });
  });
  $('#btnSave').onclick = () => {
    const d = load(), bal = balances(d), ts = Date.now();
    const names = new Map(materials(d).map(m => [norm(m.name), m]));
    const lines = [...counted].filter(([, v]) => v !== '').map(([k, v]) => ({ item: names.get(k).name, unit: names.get(k).unit, qty: +v, diff: +v - (bal.get(k) || 0) }));
    if (!lines.length) return;
    const adj = lines.filter(l => l.diff).length;
    if (!confirm(`บันทึกผลตรวจนับ ${lines.length} รายการ?\nจะปรับยอดในระบบ ${adj} รายการให้ตรงกับที่นับ`)) return;
    const doc = { id: nextId(d, 'count', 'CNT'), type: 'count', date: today(), party: '', ref: '', note: $('#note').value.trim(), lines, status: 'posted', by: me, ts };
    d.docs.unshift(doc);
    lines.filter(l => l.diff).forEach(l => d.moves.push({ ts, date: doc.date, item: l.item, unit: l.unit, qty: l.diff, doc: doc.id, type: 'count' }));
    save(d); counted.clear(); $('#note').value = ''; render();
    UI.toast(`บันทึก ${doc.id} แล้ว · ปรับยอด ${adj} รายการ`);
  };
  $('#q').addEventListener('input', render);
  render();
}

/* ---------- ค้นหาวัตถุดิบ (tracker) ---------- */
function trackerPage() {
  root.innerHTML = UI.head(PAGE) + `
  <input id="q" class="inv-search" type="search" placeholder="พิมพ์ชื่อวัตถุดิบ เช่น Uni, Ikura" autofocus>
  <div class="inv-chips" id="chips"></div>
  <div id="detail"></div>`;
  let current = UI.take(PAGE)?.item || null; // มาจากปุ่มประวัติในหน้าสต๊อก
  function render() {
    const d = load(), bal = balances(d), q = norm($('#q').value);
    const list = materials(d).filter(m => !q || norm(m.name).includes(q));
    if (!current && list.length === 1) current = norm(list[0].name);
    $('#chips').innerHTML = list.map(m => { const b = bal.get(norm(m.name)) || 0;
      return `<button class="inv-chip${current === norm(m.name) ? ' on' : ''}" data-k="${esc(norm(m.name))}">${esc(m.name)} <span class="mono${b < 0 ? ' inv-neg' : ''}">${fmt(b)}</span></button>`; }).join('') || '<div class="inv-empty">ไม่พบวัตถุดิบ</div>';
    detail(d, bal);
  }
  function detail(d, bal) {
    const m = current && materials(d).find(x => norm(x.name) === current);
    if (!m) { $('#detail').innerHTML = `<div class="empty">${ic('search')}เลือกวัตถุดิบด้านบนเพื่อดูคงเหลือและประวัติ</div>`; return; }
    const open = (type, sts) => d.docs.filter(x => x.type === type && sts.includes(x.status)).flatMap(x => x.lines.filter(l => norm(l.item) === current).map(l => ({ ...l, doc: x })));
    const prs = open('pr', ['pending', 'approved']), pos = open('po', ['open']);
    let run = 0;
    const moves = d.moves.filter(x => norm(x.item) === current).sort((a, b) => a.ts - b.ts).map(x => ({ ...x, run: run += x.qty })).reverse();
    const sum = arr => fmt(arr.reduce((s, l) => s + l.qty, 0)), b = bal.get(current) || 0;
    const acts = [['pr', 'ขอซื้อ', 'filePlus'], ['stock-in', 'รับเข้า', 'inbound'], ['stock-out', 'เบิกออก', 'outbound']].filter(([id]) => can('w', id));
    $('#detail').innerHTML = `
    <div class="rp-card-head inv-dhead"><h2>${esc(m.name)} <small class="muted">หน่วย ${esc(m.unit)}</small></h2>
      <div class="rp-actions">${acts.map(([id, label, icon]) => `<button class="btn btn-neutral btn-sm" data-act="${id}">${ic(icon)} ${label}</button>`).join('')}</div></div>
    <section class="rp-stats">
      <div class="rp-stat"><small>คงเหลือ (${esc(m.unit)})</small><b class="${b < 0 ? 'inv-neg' : ''}">${fmt(b)}</b></div>
      <div class="rp-stat"><small>PR รออนุมัติ / อนุมัติแล้ว</small><b>${sum(prs)}</b></div>
      <div class="rp-stat"><small>PO รอรับของ</small><b>${sum(pos)}</b></div>
    </section>
    ${prs.length + pos.length ? `<section class="rp-card"><div class="rp-card-head"><h2>กำลังขอซื้อ / สั่งซื้อ</h2></div><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>เอกสาร</th><th>วันที่</th><th>ผู้ขอ/ผู้ขาย</th><th class="num">จำนวน</th><th>สถานะ</th></tr></thead>
      <tbody>${[...prs, ...pos].map(l => `<tr><td class="mono">${l.doc.id}</td><td>${fdate(l.doc.date)}</td><td>${esc(l.doc.party)}</td><td class="num mono">${fmt(l.qty)} ${esc(l.unit)}</td><td>${badge(l.doc.status)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
    <section class="rp-card"><div class="rp-card-head"><h2>ความเคลื่อนไหว</h2><small class="muted">${moves.length} รายการ · ล่าสุดอยู่บน</small></div><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>วันที่</th><th>เอกสาร</th><th>ประเภท</th><th class="num">เข้า/ออก</th><th class="num">คงเหลือ</th></tr></thead>
      <tbody>${moves.map(x => `<tr><td>${fdate(x.date)}</td><td class="mono">${x.doc}</td><td>${TYPE_NAME[x.type] || x.type}</td>
        <td class="num mono ${x.qty < 0 ? 'inv-neg' : 'inv-pos'}">${x.qty > 0 ? '+' : ''}${fmt(x.qty)}</td><td class="num mono">${fmt(x.run)}</td></tr>`).join('') || '<tr><td colspan="5" class="inv-empty">ยังไม่มีความเคลื่อนไหว</td></tr>'}</tbody></table></div></section>`;
  }
  // ปุ่ม ขอซื้อ/รับเข้า/เบิกออก → เปิดฟอร์มหน้านั้นพร้อมวัตถุดิบนี้
  $('#detail').addEventListener('click', e => {
    const a = e.target.closest('[data-act]'), m = a && materials().find(x => norm(x.name) === current);
    if (m) UI.handoff(a.dataset.act, { lines: [{ item: m.name, unit: m.unit }] });
  });
  $('#q').addEventListener('input', () => { current = null; render(); });
  $('#chips').addEventListener('click', e => { const c = e.target.closest('[data-k]'); if (c) { current = c.dataset.k; render(); $('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  render();
}

if (CFG[PAGE]) docPage(CFG[PAGE]);
else if (PAGE === 'stock') stockPage();
else if (PAGE === 'tracker') trackerPage();
})();
