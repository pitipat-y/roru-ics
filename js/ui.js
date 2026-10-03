// UI กลาง (ทุกหน้า ยกเว้น material.html ที่มีชุดของตัวเองใน app.js) — โหลดหลัง js/db.js
// ไอคอน · หัวหน้าจาก DB.PAGES · toast · ไปหน้าอื่นใน CMS · ส่งข้อมูลให้หน้าถัดไป
const UI = (() => {
  // ไอคอนเส้น 24px (สไตล์เดียวกับ app.js)
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    chart: '<path d="M4 20V11"/><path d="M10 20V5"/><path d="M16 20v-7"/><path d="M3 20h18"/>',
    tables: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    order: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h3"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    ticket: '<path d="M2 9a3 3 0 1 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M9 9h.01"/><path d="m15 9-6 6"/><path d="M15 15h.01"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    package: '<path d="M11 21.7a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="m7.5 4.3 9 5.1"/>',
    filePlus: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H5.1"/>',
    inbound: '<path d="M12 3v12"/><path d="m6 9 6 6 6-6"/><path d="M4 21h16"/>',
    outbound: '<path d="M12 15V3"/><path d="m6 9 6-6 6 6"/><path d="M4 21h16"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    edit: '<path d="M21.2 6.8a2.8 2.8 0 0 0-4-4L3.8 16.2a2 2 0 0 0-.5.8L2 21.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5z"/>',
    print: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M10.7 5.1A10.7 10.7 0 0 1 22 12a14 14 0 0 1-1.6 2.5"/><path d="M14.1 14.2a3 3 0 0 1-4.2-4.2"/><path d="M17.5 17.5A10.7 10.7 0 0 1 2 12a14 14 0 0 1 4.5-5.1"/><path d="m2 2 20 20"/>',
  };
  const icon = (n, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  const HOME = { id: 'home', group: 'Maison Roru', icon: 'home', name: 'หน้าหลัก', desc: 'งานที่รอทำ และทางลัดไปทุกเมนู' };
  const page = id => id === 'home' ? HOME : DB.PAGES.find(p => p.id === id) || { id, group: '', icon: '', name: id, desc: '' };

  // หัวหน้า: ไอคอน + กลุ่ม + ชื่อ + คำอธิบาย (จาก DB.PAGES ที่เดียว)
  const title = id => { const p = page(id);
    return `<div class="ph"><span class="ph-icon">${icon(p.icon)}</span><div><div class="eyebrow">${p.group}</div><h1>${p.name}</h1><p class="muted">${p.desc}</p></div></div>`; };
  const head = (id, actions = '') => `<header class="rp-head ad-head">${title(id)}${actions}</header>`;

  const toast = msg => {
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.append(t); setTimeout(() => t.remove(), 2400);
  };

  // ไปหน้าอื่นใน CMS (หน้าย่อยอยู่ใน iframe — เปิดตรง guard ส่งเข้า CMS อยู่แล้ว)
  const go = id => { top.location.hash = id; };
  // ส่งข้อมูลให้หน้าถัดไป เช่น เลือก PR ไว้ให้ตอนสร้าง PO — ใช้ครั้งเดียว หมดอายุใน 30 วินาที
  const handoff = (id, data) => { try { localStorage.setItem('ui-handoff', JSON.stringify({ id, data, ts: Date.now() })); } catch (_) {} go(id); };
  const take = id => {
    try { const h = JSON.parse(localStorage.getItem('ui-handoff'));
      if (h?.id === id) { localStorage.removeItem('ui-handoff'); if (Date.now() - h.ts < 30000) return h.data; } } catch (_) {}
    return null;
  };

  // HTML นิ่ง: <x data-icon="..."> และ <header data-page="..."> ; HTML ที่ JS สร้างให้ใช้ UI.icon() / UI.head() แทน
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
    document.querySelectorAll('header[data-page]').forEach(h => h.insertAdjacentHTML('afterbegin', title(h.dataset.page)));
  });
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g && !g.disabled) { e.preventDefault(); go(g.dataset.go); } });

  return { icon, page, head, toast, go, handoff, take };
})();
