// หน้าร้าน (POS): รับลูกค้า → สั่งออเดอร์ → เช็คบิล + รายงาน / คูปอง / เมนู — เลือกโหมดจาก <main id="pos" data-type="...">
// ข้อมูล: localStorage 'ics-pos' = { seq, menu, coupons, bills } ; บิลที่เปิดอยู่ของแท็บนี้ = localStorage 'pos-current'
// ponytail: เก็บในเบราว์เซอร์เครื่องเดียว — หลายเครื่อง (แคชเชียร์ + พนักงานเสิร์ฟ) ต้องมี backend
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
const money = n => (+n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = n => (+n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString('sv-SE');
const dkey = ts => new Date(ts).toLocaleDateString('sv-SE');
const ftime = ts => new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const fdt = ts => new Date(ts).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const head = (title, desc, actions = '') => `<header class="rp-head ad-head"><div><h1>${title}</h1><p class="muted">${desc}</p></div>${actions}</header>`;
const toast = m => { const t = document.createElement('div'); t.className = 'pos-toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2200); };

// ponytail: ค่าคงที่ของร้าน — ย้ายไปหน้าตั้งค่าเมื่อต้องเปลี่ยนบ่อย
const SERVICE = 0.10, VAT = 0.07;
const TABLES = Array.from({ length: 12 }, (_, i) => 'T' + (i + 1));
const TAKEAWAY = 'กลับบ้าน';
const PAY = { cash: 'เงินสด', transfer: 'โอน / QR', card: 'บัตร' };

// เมนูตั้งต้น = เมนูหลักจาก Master (ชื่อตรงกัน → ส่งยอดไปคำนวณวัตถุดิบได้) ไม่เอาชิ้นส่วนคอร์ส "1/4 ...", "6. ..."
// ponytail: ราคาตั้งต้นเป็นราคาตัวอย่างตามประเภท — แก้ที่หน้าเมนูและราคา
function seedMenu() {
  const names = [...new Set((typeof DEFAULT_MASTER !== 'undefined' ? DEFAULT_MASTER : []).flatMap(g => g.items.map(i => i.menu)))]
    .filter(n => !/^\d+\/\d+\s|^\d+\.|^(COMP|SET)\./i.test(n));
  const rule = n => /lunch set/i.test(n) ? ['Set', 1290] : /kazan/i.test(n) ? ['Don', 1890] : /don\b/i.test(n) ? ['Don', 890]
    : /sashimi/i.test(n) ? ['Sashimi', 490] : /^B\d/.test(n) ? ['Roll & Canapé', 390] : /^A\d/.test(n) ? ['A la carte', 290]
    : /roll|nigiri|canape/i.test(n) ? ['Roll & Canapé', 350] : ['อื่น ๆ', 390];
  return names.map((name, i) => { const [cat, price] = rule(name); return { id: 'M' + (i + 1), name, cat, price, active: true }; });
}
const SEED_COUPONS = [
  { code: 'WELCOME10', type: 'pct', value: 10, min: 0, expires: '', limit: 0, used: 0, active: true, note: 'ลูกค้าใหม่ ลด 10%' },
  { code: 'SAVE200', type: 'amt', value: 200, min: 1500, expires: '', limit: 100, used: 0, active: true, note: 'ซื้อครบ 1,500 ลด 200' },
];

const KEY = 'ics-pos';
const load = () => {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.bills) return { seq: {}, coupons: [], ...d, menu: d.menu || seedMenu() }; } catch (_) {}
  return { seq: {}, menu: seedMenu(), coupons: SEED_COUPONS.map(c => ({ ...c })), bills: [] };
};
const save = d => localStorage.setItem(KEY, JSON.stringify(d));
const getCur = () => { try { return localStorage.getItem('pos-current') || ''; } catch (_) { return ''; } };
const setCur = id => { try { id ? localStorage.setItem('pos-current', id) : localStorage.removeItem('pos-current'); } catch (_) {} };

const root = $('#pos'), PAGE = root.dataset.type;
const me = ICS_AUTH.session().user.username;
const can = (p, page = PAGE) => ICS_AUTH.can(page, p);
const go = page => { top.location.hash = page; }; // เปลี่ยนเมนูใน CMS

// คูปอง: คืน { ok, msg, discount }
function checkCoupon(d, code, subtotal) {
  const c = d.coupons.find(x => x.code.toUpperCase() === String(code).trim().toUpperCase());
  if (!c || !c.active) return { ok: false, msg: 'ไม่พบคูปอง หรือปิดใช้งานอยู่' };
  if (c.expires && today() > c.expires) return { ok: false, msg: `คูปองหมดอายุ ${c.expires}` };
  if (c.limit && c.used >= c.limit) return { ok: false, msg: 'คูปองถูกใช้ครบจำนวนแล้ว' };
  if (subtotal < c.min) return { ok: false, msg: `ยอดขั้นต่ำ ${money(c.min)} บาท` };
  const discount = Math.min(subtotal, c.type === 'pct' ? subtotal * c.value / 100 : c.value);
  return { ok: true, msg: c.note || '', discount: Math.round(discount * 100) / 100, coupon: c };
}
// ยอดบิล: (รวม − ส่วนลด) + service 10% → + VAT 7%
function totals(d, bill) {
  const subtotal = bill.items.reduce((s, i) => s + i.price * i.qty, 0);
  const cp = bill.coupon ? checkCoupon(d, bill.coupon, subtotal) : null;
  const discount = cp?.ok ? cp.discount : 0;
  const service = (subtotal - discount) * SERVICE, vat = (subtotal - discount + service) * VAT;
  const r2 = n => Math.round(n * 100) / 100;
  return { subtotal: r2(subtotal), discount, couponMsg: cp && !cp.ok ? cp.msg : '', service: r2(service), vat: r2(vat), total: r2(subtotal - discount + service + vat) };
}
const openBills = d => d.bills.filter(b => b.status === 'open');
const billLabel = b => `${b.id} · ${b.table === TAKEAWAY ? TAKEAWAY : 'โต๊ะ ' + b.table}${b.customer ? ' · ' + b.customer : ''}`;

function receipt(b) {
  const t = b.paid || {};
  return `<div class="pos-receipt" id="receipt">
    <div class="pos-rc-head"><b>Maison Roru</b><small>ICONSIAM · S102</small><small>${b.id} · ${b.table === TAKEAWAY ? TAKEAWAY : 'โต๊ะ ' + b.table} · ${b.pax || '-'} ท่าน</small><small>${fdt(b.paidAt || Date.now())}</small></div>
    <table>${b.items.map(i => `<tr><td>${fmt(i.qty)} × ${esc(i.menu)}</td><td>${money(i.qty * i.price)}</td></tr>`).join('')}</table>
    <table class="pos-rc-sum">
      <tr><td>รวม</td><td>${money(t.subtotal)}</td></tr>
      ${t.discount ? `<tr><td>ส่วนลด ${esc(b.coupon)}</td><td>−${money(t.discount)}</td></tr>` : ''}
      <tr><td>Service ${Math.round(SERVICE * 100)}%</td><td>${money(t.service)}</td></tr>
      <tr><td>VAT ${Math.round(VAT * 100)}%</td><td>${money(t.vat)}</td></tr>
      <tr class="pos-rc-total"><td>ยอดสุทธิ</td><td>${money(t.total)}</td></tr>
      ${b.payment ? `<tr><td>${PAY[b.payment.method]}</td><td>${money(b.payment.received)}</td></tr>${b.payment.change ? `<tr><td>เงินทอน</td><td>${money(b.payment.change)}</td></tr>` : ''}` : ''}
    </table>
    <div class="pos-rc-head"><small>แคชเชียร์ ${esc(b.cashier || '')} · ขอบคุณค่ะ</small></div>
  </div>`;
}

/* ---------- รับลูกค้า ---------- */
function tablesPage() {
  root.innerHTML = head('รับลูกค้า', 'แตะโต๊ะว่างเพื่อเปิดบิล · โต๊ะที่มีลูกค้าแตะเพื่อสั่งอาหารหรือเช็คบิล') + `
  <div class="pos-tables" id="grid"></div>
  <dialog id="dlg" class="ad-dlg"><form id="form">
    <h2 id="dlgTitle"></h2>
    <label>จำนวนลูกค้า<input name="pax" type="number" min="1" max="50" value="2" required></label>
    <label>ชื่อลูกค้า / หมายเหตุ <small class="muted">(ไม่บังคับ)</small><input name="customer" maxlength="60"></label>
    <div class="ad-btns"><button type="button" class="btn btn-ghost" data-close>ยกเลิก</button><button class="btn btn-primary">เปิดบิล</button></div>
  </form></dialog>`;
  let table = '';
  function render() {
    const d = load(), open = openBills(d), now = Date.now();
    const card = b => { const t = totals(d, b), mins = Math.round((now - b.openedAt) / 60000);
      return `<div class="pos-tbl busy" data-bill="${b.id}"><b>${b.table === TAKEAWAY ? TAKEAWAY : b.table}</b>
        <small>${b.id} · ${b.pax} ท่าน${b.customer ? ' · ' + esc(b.customer) : ''}</small>
        <span class="mono">${money(t.total)}</span><small class="muted">${b.items.length} รายการ · ${mins} นาที</small>
        <div class="pos-tbl-act">${can('r', 'pos-order') ? `<button class="btn btn-ghost" data-go="pos-order">สั่งอาหาร</button>` : ''}${can('r', 'pos-bill') ? `<button class="btn btn-ghost" data-go="pos-bill">เช็คบิล</button>` : ''}</div></div>`; };
    $('#grid').innerHTML = TABLES.map(t => { const b = open.find(x => x.table === t);
      return b ? card(b) : `<button class="pos-tbl free" data-open="${t}" data-perm="w"><b>${t}</b><small>ว่าง</small></button>`; }).join('')
      + open.filter(b => b.table === TAKEAWAY).map(card).join('')
      + `<button class="pos-tbl free" data-open="${TAKEAWAY}" data-perm="w"><b>+ ${TAKEAWAY}</b><small>เปิดบิลใหม่</small></button>`;
  }
  root.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return $('#dlg').close();
    const o = e.target.closest('[data-open]'), card = e.target.closest('[data-bill]');
    if (o) { table = o.dataset.open; $('#form').reset(); $('#dlgTitle').textContent = `เปิดบิล ${table === TAKEAWAY ? TAKEAWAY : 'โต๊ะ ' + table}`; $('#dlg').showModal(); }
    else if (card) setCur(card.dataset.bill); // ปุ่ม data-go ไปหน้าต่อ (handler ท้ายไฟล์)
  });
  $('#form').addEventListener('submit', e => {
    e.preventDefault();
    const d = load();
    if (table !== TAKEAWAY && openBills(d).some(b => b.table === table)) { $('#dlg').close(); return render(); } // มีคนเปิดไปแล้ว
    const id = `B${today().replace(/-/g, '').slice(2)}-${String(d.seq.bill = (d.seq.bill || 0) + 1).padStart(4, '0')}`;
    d.bills.push({ id, table, pax: +e.target.pax.value, customer: e.target.customer.value.trim(), openedAt: Date.now(), by: me, status: 'open', items: [], coupon: '' });
    save(d); setCur(id); $('#dlg').close();
    if (can('r', 'pos-order')) go('pos-order'); else render();
  });
  render(); setInterval(render, 60000); // อัปเดตเวลานั่ง
}

/* ---------- เลือกบิล (ใช้ร่วม สั่งออเดอร์ / เช็คบิล) ---------- */
function billPicker(onChange) {
  const sel = $('#billSel');
  const fill = () => {
    const open = openBills(load()); let cur = getCur();
    if (!open.some(b => b.id === cur)) cur = open[0]?.id || '';
    setCur(cur);
    sel.innerHTML = open.map(b => `<option value="${b.id}"${b.id === cur ? ' selected' : ''}>${esc(billLabel(b))}</option>`).join('') || '<option value="">— ไม่มีบิลที่เปิดอยู่ —</option>';
    return cur;
  };
  sel.onchange = () => { setCur(sel.value); onChange(sel.value); };
  return fill;
}
const noBill = () => `<div class="rp-empty">ยังไม่มีบิลที่เปิดอยู่${can('r', 'pos-tables') ? ' — <a href="#" data-go="pos-tables">ไปหน้ารับลูกค้า</a>' : ''}</div>`;

/* ---------- สั่งออเดอร์ ---------- */
function orderPage() {
  root.innerHTML = head('สั่งออเดอร์', 'แตะเมนูเพื่อเพิ่มลงบิล แล้วกด "ส่งครัว"', `<select id="billSel" class="pos-billsel"></select>`) + `
  <div class="pos-order">
    <section class="pos-menu">
      <input id="q" type="search" class="inv-search" placeholder="ค้นหาเมนู">
      <div class="pos-cats" id="cats"></div>
      <div class="pos-grid" id="menu"></div>
    </section>
    <aside class="rp-card pos-cart" id="cart"></aside>
  </div>`;
  let cat = '', billId = '';
  const fill = billPicker(id => { billId = id; renderCart(); });
  function renderMenu() {
    const d = load(), q = norm($('#q').value), menu = d.menu.filter(m => m.active);
    const cats = [...new Set(menu.map(m => m.cat))];
    $('#cats').innerHTML = ['', ...cats].map(c => `<button class="inv-chip${c === cat ? ' on' : ''}" data-cat="${esc(c)}">${c ? esc(c) : 'ทั้งหมด'}</button>`).join('');
    $('#menu').innerHTML = menu.filter(m => (!cat || m.cat === cat) && (!q || norm(m.name).includes(q)))
      .map(m => `<button class="pos-item" data-add="${m.id}" data-perm="w"><span>${esc(m.name)}</span><b class="mono">${money(m.price)}</b></button>`).join('') || '<div class="inv-empty">ไม่พบเมนู</div>';
  }
  function renderCart() {
    const d = load(), b = d.bills.find(x => x.id === billId && x.status === 'open');
    if (!b) { $('#cart').innerHTML = noBill(); return; }
    const t = totals(d, b), unsent = b.items.filter(i => !i.sentAt).length;
    $('#cart').innerHTML = `<div class="rp-card-head"><h2>${b.table === TAKEAWAY ? TAKEAWAY : 'โต๊ะ ' + b.table} <small class="muted">${b.pax} ท่าน</small></h2><small class="muted mono">${b.id}</small></div>
      <div class="pos-lines">${b.items.map((i, k) => `<div class="pos-line${i.sentAt ? ' sent' : ''}">
        <div><span>${esc(i.menu)}</span><small class="muted">${money(i.price)}${i.sentAt ? ` · ส่งครัว ${ftime(i.sentAt)}` : ' · ยังไม่ส่ง'}</small></div>
        ${i.sentAt ? `<b class="mono">×${fmt(i.qty)}</b><button class="btn btn-ghost ad-del" data-void="${k}" data-perm="d" title="ยกเลิกรายการที่ส่งครัวแล้ว">✕</button>`
          : `<div class="pos-qty" data-perm="w"><button data-dec="${k}">−</button><b class="mono">${fmt(i.qty)}</b><button data-inc="${k}">+</button></div>`}
      </div>`).join('') || '<div class="inv-empty">ยังไม่มีรายการ</div>'}</div>
      <div class="pos-sum"><span>รวม (ก่อน service/VAT)</span><b class="mono">${money(t.subtotal)}</b></div>
      <div class="ad-btns">
        <button class="btn btn-primary" id="btnSend" data-perm="w"${unsent ? '' : ' disabled'}>ส่งครัว${unsent ? ` (${unsent})` : ''}</button>
        ${can('r', 'pos-bill') ? '<button class="btn btn-ghost" data-go="pos-bill">ไปเช็คบิล →</button>' : ''}
      </div>`;
  }
  const mutate = fn => { const d = load(), b = d.bills.find(x => x.id === billId && x.status === 'open'); if (!b) return; fn(b, d); save(d); renderCart(); };
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-cat],[data-add],[data-inc],[data-dec],[data-void],#btnSend'); if (!t) return;
    if (t.dataset.cat !== undefined) { cat = t.dataset.cat; return renderMenu(); }
    if (t.dataset.add) mutate((b, d) => {
      const m = d.menu.find(x => x.id === t.dataset.add), ln = b.items.find(i => !i.sentAt && i.menu === m.name);
      ln ? ln.qty++ : b.items.push({ menu: m.name, price: m.price, qty: 1, sentAt: 0 });
    });
    if (t.dataset.inc) mutate(b => b.items[t.dataset.inc].qty++);
    if (t.dataset.dec) mutate(b => { const i = b.items[t.dataset.dec]; if (--i.qty <= 0) b.items.splice(t.dataset.dec, 1); });
    if (t.dataset.void && confirm(`ยกเลิก ${load().bills.find(x => x.id === billId).items[t.dataset.void].menu} ที่ส่งครัวแล้ว?`)) mutate(b => b.items.splice(t.dataset.void, 1));
    if (t.id === 'btnSend') { mutate(b => { const now = Date.now(); b.items.forEach(i => { if (!i.sentAt) i.sentAt = now; }); }); toast('ส่งครัวแล้ว'); }
  });
  $('#q').addEventListener('input', renderMenu);
  billId = fill(); renderMenu(); renderCart();
}

/* ---------- เช็คบิล ---------- */
function billPage() {
  root.innerHTML = head('เช็คบิล', 'ใส่คูปอง เลือกวิธีชำระ แล้วปิดบิล', `<select id="billSel" class="pos-billsel"></select>`) + `
  <div id="body"></div>
  <dialog id="rcDlg" class="ad-dlg"><div id="rcBody"></div>
    <div class="ad-btns pos-noprint"><button class="btn btn-ghost" onclick="print()">พิมพ์ใบเสร็จ</button><button class="btn btn-primary" data-close>เสร็จสิ้น</button></div></dialog>`;
  let billId = '';
  const fill = billPicker(id => { billId = id; render(); });
  function render() {
    const d = load(), b = d.bills.find(x => x.id === billId && x.status === 'open');
    if (!b) { $('#body').innerHTML = noBill(); return; }
    const t = totals(d, b), unsent = b.items.some(i => !i.sentAt);
    $('#body').innerHTML = `<div class="pos-checkout">
      <section class="rp-card">
        <div class="rp-card-head"><h2>${esc(billLabel(b))}</h2><small class="muted">${b.pax} ท่าน · เปิด ${ftime(b.openedAt)}</small></div>
        ${unsent ? '<div class="pos-warn">มีรายการยังไม่ส่งครัว</div>' : ''}
        <table class="tbl"><thead><tr><th>รายการ</th><th class="num">จำนวน</th><th class="num">ราคา</th><th class="num">รวม</th></tr></thead>
        <tbody>${b.items.map(i => `<tr><td>${esc(i.menu)}</td><td class="num mono">${fmt(i.qty)}</td><td class="num mono">${money(i.price)}</td><td class="num mono">${money(i.qty * i.price)}</td></tr>`).join('') || '<tr><td colspan="4" class="inv-empty">ยังไม่มีรายการ</td></tr>'}</tbody></table>
      </section>
      <section class="rp-card pos-pay">
        <label>คูปองส่วนลด<div class="pos-row"><input id="coupon" value="${esc(b.coupon)}" placeholder="รหัสคูปอง" autocapitalize="characters">
          ${b.coupon ? '<button class="btn btn-ghost" id="cpDel" data-perm="w">เอาออก</button>' : '<button class="btn btn-ghost" id="cpApply" data-perm="w">ใช้</button>'}</div>
          <small class="${t.couponMsg ? 'ad-err' : 'muted'}" id="cpMsg">${t.couponMsg || (b.coupon ? 'ใช้คูปองแล้ว' : '')}</small></label>
        <dl class="pos-totals">
          <dt>รวม</dt><dd>${money(t.subtotal)}</dd>
          ${t.discount ? `<dt>ส่วนลด (${esc(b.coupon)})</dt><dd class="inv-pos">−${money(t.discount)}</dd>` : ''}
          <dt>Service ${Math.round(SERVICE * 100)}%</dt><dd>${money(t.service)}</dd>
          <dt>VAT ${Math.round(VAT * 100)}%</dt><dd>${money(t.vat)}</dd>
          <dt class="pos-grand">ยอดสุทธิ</dt><dd class="pos-grand">${money(t.total)}</dd>
        </dl>
        <div class="pos-methods">${Object.entries(PAY).map(([k, v], i) => `<label><input type="radio" name="pm" value="${k}"${i ? '' : ' checked'}> ${v}</label>`).join('')}</div>
        <label id="cashBox">รับเงิน<input id="received" type="number" min="0" step="any" placeholder="${money(t.total)}"><small class="muted" id="change"></small></label>
        <div class="ad-err" id="err" hidden></div>
        <div class="ad-btns">
          <button class="btn btn-ghost ad-del" id="btnVoid" data-perm="d">ยกเลิกบิล</button>
          <button class="btn btn-primary btn-lg" id="btnPay" data-perm="w"${b.items.length ? '' : ' disabled'}>ชำระเงิน ${money(t.total)}</button>
        </div>
      </section></div>`;
    const syncPay = () => {
      const cash = $('[name=pm]:checked').value === 'cash'; $('#cashBox').hidden = !cash;
      const r = +$('#received').value; $('#change').textContent = cash && r ? (r >= t.total ? `เงินทอน ${money(r - t.total)}` : `ขาดอีก ${money(t.total - r)}`) : '';
    };
    $('.pos-methods').onchange = syncPay; $('#received').oninput = syncPay; syncPay();
  }
  const mutate = fn => { const d = load(), b = d.bills.find(x => x.id === billId && x.status === 'open'); if (b) { fn(b, d); save(d); } render(); };
  root.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { $('#rcDlg').close(); return; }
    const id = e.target.closest('button')?.id;
    if (id === 'cpApply') {
      const d = load(), b = d.bills.find(x => x.id === billId), code = $('#coupon').value.trim().toUpperCase();
      const r = checkCoupon(d, code, totals(d, b).subtotal);
      if (!r.ok) { $('#cpMsg').textContent = r.msg; $('#cpMsg').className = 'ad-err'; return; }
      mutate(b => b.coupon = r.coupon.code); toast(`ใช้คูปอง ${r.coupon.code} ลด ${money(r.discount)}`);
    }
    if (id === 'cpDel') mutate(b => b.coupon = '');
    if (id === 'btnVoid' && confirm('ยกเลิกบิลนี้? (ไม่นับเป็นยอดขาย)')) mutate(b => { b.status = 'void'; b.voidAt = Date.now(); b.voidBy = me; });
    if (id === 'btnPay') {
      const d = load(), b = d.bills.find(x => x.id === billId && x.status === 'open'), t = totals(d, b);
      const method = $('[name=pm]:checked').value, received = method === 'cash' ? (+$('#received').value || t.total) : t.total;
      if (received < t.total) { $('#err').textContent = 'รับเงินไม่พอ'; $('#err').hidden = false; return; }
      if (t.couponMsg) b.coupon = ''; // คูปองใช้ไม่ได้แล้ว (เช่น ลดรายการจนต่ำกว่าขั้นต่ำ) → ไม่คิดส่วนลด
      const final = totals(d, b);
      if (b.coupon) d.coupons.find(c => c.code === b.coupon).used++;
      Object.assign(b, { status: 'paid', paidAt: Date.now(), cashier: me, paid: final,
        payment: { method, received, change: Math.round((received - final.total) * 100) / 100 } });
      save(d); setCur('');
      $('#rcBody').innerHTML = receipt(b); $('#rcDlg').showModal();
      billId = fill(); render();
    }
  });
  billId = fill(); render();
}

/* ---------- รายงานยอดขาย POS ---------- */
function reportPage() {
  root.innerHTML = head('รายงานยอดขาย (POS)', 'สรุปจากบิลที่ชำระแล้ว', `<div class="rp-actions"><input type="date" id="from"><input type="date" id="to">
    <button class="btn btn-ghost" id="btnIcs" data-perm="w" title="ส่งยอดขายเมนูไปเป็นประวัติในหน้าคำนวณวัตถุดิบ">ส่งไปคำนวณวัตถุดิบ</button></div>`) + `
  <section class="rp-stats pos-stats">
    <div class="rp-stat"><small>บิล</small><b id="sBills"></b></div><div class="rp-stat"><small>ยอดขายสุทธิ</small><b id="sNet"></b></div>
    <div class="rp-stat"><small>ส่วนลด</small><b id="sDisc"></b></div><div class="rp-stat"><small>เฉลี่ย/บิล</small><b id="sAvg"></b></div>
  </section>
  <section class="rp-card"><div class="rp-card-head"><h2>เมนูขายดี</h2><small class="muted">จำนวน · ยอดก่อนส่วนลด</small></div><div class="bars" id="cMenu"></div></section>
  <div class="pos-2col">
    <section class="rp-card"><div class="rp-card-head"><h2>ยอดตามช่วงเวลา</h2></div><div class="bars" id="cHour"></div></section>
    <section class="rp-card"><div class="rp-card-head"><h2>วิธีชำระ / คูปอง</h2></div><div class="bars" id="cPay"></div></section>
  </div>
  <section class="rp-card"><div class="rp-card-head"><h2>บิล</h2></div><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>เลขที่</th><th>เวลา</th><th>โต๊ะ</th><th class="num">รายการ</th><th class="num">ส่วนลด</th><th class="num">สุทธิ</th><th>ชำระ</th><th>แคชเชียร์</th></tr></thead>
    <tbody id="rows"></tbody></table></div></section>
  <dialog id="rcDlg" class="ad-dlg"><div id="rcBody"></div><div class="ad-btns pos-noprint"><button class="btn btn-ghost" onclick="print()">พิมพ์</button><button class="btn btn-primary" data-close>ปิด</button></div></dialog>`;
  $('#from').value = $('#to').value = today();
  const bars = rows => { const max = Math.max(1, ...rows.map(r => r.v));
    return rows.map(r => `<div class="lbl" title="${esc(r.k)}">${esc(r.k)}</div><div class="track"><div class="bar" style="width:${Math.max(0.5, r.v / max * 100)}%"></div><span class="val">${r.label}</span></div>`).join('') || '<div class="none">ไม่มีข้อมูล</div>'; };
  const group = (arr, key, val) => { const m = new Map(); arr.forEach(x => { const k = key(x); m.set(k, (m.get(k) || 0) + val(x)); }); return m; };
  let paid = [];
  function render() {
    const from = $('#from').value, to = $('#to').value;
    paid = load().bills.filter(b => b.status === 'paid' && dkey(b.paidAt) >= from && dkey(b.paidAt) <= to).sort((a, b) => b.paidAt - a.paidAt);
    const net = paid.reduce((s, b) => s + b.paid.total, 0), disc = paid.reduce((s, b) => s + b.paid.discount, 0);
    $('#sBills').textContent = fmt(paid.length); $('#sNet').textContent = money(net); $('#sDisc').textContent = money(disc); $('#sAvg').textContent = money(paid.length ? net / paid.length : 0);
    const items = paid.flatMap(b => b.items);
    const qty = group(items, i => i.menu, i => i.qty), amt = group(items, i => i.menu, i => i.qty * i.price);
    $('#cMenu').innerHTML = bars([...qty].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => ({ k, v, label: `${fmt(v)} · ${money(amt.get(k))}` })));
    $('#cHour').innerHTML = bars([...group(paid, b => String(new Date(b.paidAt).getHours()).padStart(2, '0') + ':00', b => b.paid.total)].sort().map(([k, v]) => ({ k, v, label: money(v) })));
    $('#cPay').innerHTML = bars([...[...group(paid, b => PAY[b.payment.method], b => b.paid.total)].map(([k, v]) => ({ k, v, label: money(v) })),
      ...[...group(paid.filter(b => b.coupon), b => 'คูปอง ' + b.coupon, () => 1)].map(([k, v]) => ({ k, v, label: `${v} บิล` }))]);
    $('#rows').innerHTML = paid.map(b => `<tr><td class="mono"><a href="#" data-rc="${b.id}">${b.id}</a></td><td>${dkey(b.paidAt) === today() ? ftime(b.paidAt) : fdt(b.paidAt)}</td>
      <td>${esc(b.table)}</td><td class="num">${b.items.reduce((s, i) => s + i.qty, 0)}</td><td class="num mono">${b.paid.discount ? money(b.paid.discount) : '-'}</td>
      <td class="num mono">${money(b.paid.total)}</td><td>${PAY[b.payment.method]}</td><td>${esc(b.cashier)}</td></tr>`).join('') || '<tr><td colspan="8" class="inv-empty">ไม่มีบิลในช่วงนี้</td></tr>';
  }
  root.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return $('#rcDlg').close();
    const rc = e.target.closest('[data-rc]');
    if (rc) { e.preventDefault(); $('#rcBody').innerHTML = receipt(paid.find(b => b.id === rc.dataset.rc)); $('#rcDlg').showModal(); }
  });
  // ส่งยอดขายเมนูไปเป็น 1 รายการในประวัติของหน้าคำนวณวัตถุดิบ (รูปแบบเดียวกับไฟล์ POS ที่อัปโหลด)
  $('#btnIcs').onclick = () => {
    if (!paid.length) return alert('ไม่มีบิลในช่วงนี้');
    const qty = group(paid.flatMap(b => b.items), i => i.menu, i => i.qty);
    const from = $('#from').value, to = $('#to').value, name = `POS ${from}${from === to ? '' : ' ถึง ' + to}`;
    let h = []; try { h = JSON.parse(localStorage.getItem('ics-history') || '[]'); } catch (_) {}
    h.unshift({ id: Date.now().toString(36), ts: Date.now(), fileName: name, sheet: 'ระบบหน้าร้าน', rowCount: qty.size, sales: [...qty].map(([d, q]) => ({ d, q })) });
    localStorage.setItem('ics-history', JSON.stringify(h.slice(0, 15))); // HISTORY_MAX ใน app.js
    alert(`ส่ง "${name}" (${qty.size} เมนู) ไปที่ประวัติของหน้าคำนวณวัตถุดิบแล้ว`);
  };
  $('#from').onchange = $('#to').onchange = render;
  render();
}

/* ---------- คูปองส่วนลด ---------- */
function couponsPage() {
  root.innerHTML = head('คูปองส่วนลด', 'ส่วนลดเป็น % หรือจำนวนเงิน กำหนดยอดขั้นต่ำ วันหมดอายุ และจำนวนครั้งได้', '<button class="btn btn-primary" id="btnNew" data-perm="w">+ เพิ่มคูปอง</button>') + `
  <section class="rp-card"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>รหัส</th><th>ส่วนลด</th><th class="num">ขั้นต่ำ</th><th>หมดอายุ</th><th class="num">ใช้แล้ว</th><th>เปิดใช้</th><th></th></tr></thead>
    <tbody id="rows"></tbody></table></div></section>
  <dialog id="dlg" class="ad-dlg"><form id="form">
    <h2 id="dlgTitle"></h2>
    <label>รหัสคูปอง <small class="muted">A-Z 0-9 (3–20 ตัว)</small><input name="code" required pattern="[A-Za-z0-9]{3,20}" autocapitalize="characters"></label>
    <div class="inv-grid"><label>ประเภท<select name="type"><option value="pct">ลด %</option><option value="amt">ลดเป็นบาท</option></select></label>
      <label>มูลค่า<input name="value" type="number" min="0.01" step="any" required></label></div>
    <div class="inv-grid"><label>ยอดขั้นต่ำ (บาท)<input name="min" type="number" min="0" step="any" value="0"></label>
      <label>จำกัดจำนวนครั้ง <small class="muted">0 = ไม่จำกัด</small><input name="limit" type="number" min="0" step="1" value="0"></label></div>
    <label>หมดอายุ <small class="muted">(ไม่บังคับ)</small><input name="expires" type="date"></label>
    <label>คำอธิบาย<input name="note" maxlength="80"></label>
    <div class="ad-err" id="err" hidden></div>
    <div class="ad-btns"><button type="button" class="btn btn-ghost" data-close>ยกเลิก</button><button class="btn btn-primary">บันทึก</button></div>
  </form></dialog>`;
  const form = $('#form'); let editing = null;
  const disc = c => c.type === 'pct' ? `${fmt(c.value)}%` : `${money(c.value)} บาท`;
  function render() {
    const d = load(), canW = can('w');
    $('#rows').innerHTML = d.coupons.map(c => { const expired = c.expires && today() > c.expires, full = c.limit && c.used >= c.limit;
      return `<tr><td class="mono"><b>${esc(c.code)}</b><br><small class="muted">${esc(c.note)}</small></td><td>${disc(c)}</td><td class="num mono">${c.min ? money(c.min) : '-'}</td>
      <td>${c.expires ? `<span class="${expired ? 'inv-neg' : ''}">${c.expires}${expired ? ' (หมดอายุ)' : ''}</span>` : '-'}</td>
      <td class="num mono">${c.used}${c.limit ? ' / ' + c.limit : ''}${full ? ' <span class="inv-neg">ครบ</span>' : ''}</td>
      <td><input type="checkbox" data-toggle="${esc(c.code)}"${c.active ? ' checked' : ''}${canW ? '' : ' disabled'}></td>
      <td class="ad-act"><button class="btn btn-ghost" data-edit="${esc(c.code)}" data-perm="w">แก้ไข</button><button class="btn btn-ghost ad-del" data-del="${esc(c.code)}" data-perm="d">ลบ</button></td></tr>`; }).join('')
      || '<tr><td colspan="7" class="inv-empty">ยังไม่มีคูปอง</td></tr>';
  }
  function open(code) {
    const c = load().coupons.find(x => x.code === code); editing = c ? c.code : null;
    form.reset(); $('#err').hidden = true; $('#dlgTitle').textContent = c ? `แก้ไข ${c.code}` : 'เพิ่มคูปอง';
    form.code.readOnly = !!c;
    if (c) ['code', 'type', 'value', 'min', 'limit', 'expires', 'note'].forEach(k => form[k].value = c[k]);
    $('#dlg').showModal();
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = load(), code = form.code.value.trim().toUpperCase();
    const v = { type: form.type.value, value: +form.value.value, min: +form.min.value || 0, limit: +form.limit.value || 0, expires: form.expires.value, note: form.note.value.trim() };
    if (v.type === 'pct' && v.value > 100) { $('#err').textContent = 'ลด % ต้องไม่เกิน 100'; $('#err').hidden = false; return; }
    if (editing) Object.assign(d.coupons.find(c => c.code === editing), v);
    else { if (d.coupons.some(c => c.code === code)) { $('#err').textContent = 'มีรหัสนี้แล้ว'; $('#err').hidden = false; return; }
      d.coupons.push({ code, ...v, used: 0, active: true }); }
    save(d); $('#dlg').close(); render();
  });
  root.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return $('#dlg').close();
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) open(ed.dataset.edit);
    if (del && confirm(`ลบคูปอง ${del.dataset.del}?`)) { const d = load(); d.coupons = d.coupons.filter(c => c.code !== del.dataset.del); save(d); render(); }
  });
  root.addEventListener('change', e => { const t = e.target.dataset.toggle; if (t) { const d = load(); d.coupons.find(c => c.code === t).active = e.target.checked; save(d); } });
  $('#btnNew').onclick = () => open(null);
  render();
}

/* ---------- เมนูและราคา ---------- */
function menuPage() {
  root.innerHTML = head('เมนูและราคา', 'ราคาตั้งต้นเป็นราคาตัวอย่าง แก้ราคาในช่องได้เลย · ชื่อเมนูควรตรงกับ Master เพื่อให้คำนวณวัตถุดิบได้', '<button class="btn btn-primary" id="btnNew" data-perm="w">+ เพิ่มเมนู</button>') + `
  <section class="rp-card"><div class="rp-card-head"><div class="rp-actions"><input id="q" type="search" placeholder="ค้นหาเมนู"><select id="fc"></select></div><small class="muted" id="count"></small></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>เมนู</th><th>หมวด</th><th class="num">ราคา</th><th>ขาย</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></section>
  <dialog id="dlg" class="ad-dlg"><form id="form"><h2>เพิ่มเมนู</h2>
    <label>ชื่อเมนู<input name="name" required maxlength="80" list="masterMenus"></label>
    <div class="inv-grid"><label>หมวด<input name="cat" required maxlength="30" list="catList"></label><label>ราคา<input name="price" type="number" min="0" step="any" required></label></div>
    <div class="ad-err" id="err" hidden></div>
    <div class="ad-btns"><button type="button" class="btn btn-ghost" data-close>ยกเลิก</button><button class="btn btn-primary">บันทึก</button></div>
  </form></dialog>
  <datalist id="catList"></datalist><datalist id="masterMenus">${[...new Set((typeof DEFAULT_MASTER !== 'undefined' ? DEFAULT_MASTER : []).flatMap(g => g.items.map(i => i.menu)))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
  const canW = can('w');
  function render() {
    const d = load(), q = norm($('#q').value), fc = $('#fc').value, cats = [...new Set(d.menu.map(m => m.cat))];
    $('#fc').innerHTML = '<option value="">ทุกหมวด</option>' + cats.map(c => `<option${c === fc ? ' selected' : ''}>${esc(c)}</option>`).join('');
    $('#catList').innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
    const list = d.menu.filter(m => (!fc || m.cat === fc) && (!q || norm(m.name).includes(q)));
    $('#count').textContent = `${list.length} / ${d.menu.length} เมนู`;
    $('#rows').innerHTML = list.map(m => `<tr><td>${esc(m.name)}</td><td><span class="badge">${esc(m.cat)}</span></td>
      <td class="num"><input class="inv-count num" type="number" min="0" step="any" value="${m.price}" data-price="${m.id}"${canW ? '' : ' disabled'}></td>
      <td><input type="checkbox" data-active="${m.id}"${m.active ? ' checked' : ''}${canW ? '' : ' disabled'}></td>
      <td class="ad-act"><button class="btn btn-ghost ad-del" data-del="${m.id}" data-perm="d">ลบ</button></td></tr>`).join('') || '<tr><td colspan="5" class="inv-empty">ไม่พบเมนู</td></tr>';
  }
  root.addEventListener('change', e => {
    const { price, active } = e.target.dataset; if (!price && !active) return;
    const d = load(), m = d.menu.find(x => x.id === (price || active));
    if (price) m.price = Math.max(0, +e.target.value || 0); else m.active = e.target.checked;
    save(d); toast(`บันทึก ${m.name}`);
  });
  root.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return $('#dlg').close();
    const del = e.target.closest('[data-del]');
    if (del) { const d = load(), m = d.menu.find(x => x.id === del.dataset.del);
      if (confirm(`ลบเมนู ${m.name}? (บิลเก่ายังเก็บชื่อและราคาไว้)`)) { d.menu = d.menu.filter(x => x !== m); save(d); render(); } }
  });
  $('#form').addEventListener('submit', e => {
    e.preventDefault();
    const d = load(), f = e.target, name = f.name.value.trim();
    if (d.menu.some(m => norm(m.name) === norm(name))) { $('#err').textContent = 'มีเมนูนี้แล้ว'; $('#err').hidden = false; return; }
    const id = 'M' + (Math.max(0, ...d.menu.map(m => +m.id.slice(1) || 0)) + 1);
    d.menu.push({ id, name, cat: f.cat.value.trim(), price: +f.price.value, active: true });
    save(d); $('#dlg').close(); render();
  });
  $('#btnNew').onclick = () => { $('#form').reset(); $('#err').hidden = true; $('#dlg').showModal(); };
  $('#q').addEventListener('input', render); $('#fc').addEventListener('change', render);
  render();
}

root.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); } });
({ 'pos-tables': tablesPage, 'pos-order': orderPage, 'pos-bill': billPage, 'pos-report': reportPage, 'pos-coupons': couponsPage, 'pos-menu': menuPage })[PAGE]();
})();
