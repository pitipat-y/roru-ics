(() => {
  const app = document.getElementById('app'), side = document.getElementById('side'), grip = document.getElementById('grip');
  const mobile = matchMedia('(max-width:768px)');
  const get = k => { try { return localStorage.getItem(k); } catch(_) { return null; } };
  const set = (k,v) => { try { localStorage.setItem(k,v); } catch(_) {} };

  // desktop: จำความกว้าง + สถานะซ่อน; มือถือ: drawer ปิดเสมอตอนเปิดหน้า
  const w = +get('cms-side-w'); if (w) side.style.setProperty('--w', w + 'px');
  if (get('cms-side-closed') === '1') app.classList.add('closed');

  document.getElementById('burger').onclick = () => {
    if (mobile.matches) app.classList.toggle('open');
    else set('cms-side-closed', app.classList.toggle('closed') ? '1' : '0');
  };
  document.getElementById('scrim').onclick = () => app.classList.remove('open');

  // เมนู: หน้าหลัก + หน้าที่มีสิทธิ์อ่าน จัดกลุ่ม/เรียงตาม DB.PAGES
  const pages = [UI.page('home'), ...DB.PAGES.filter(p => ICS_AUTH.can(p.id, 'r'))];
  const link = p => `<a href="#${p.id}" title="${p.name}">${UI.icon(p.icon)}<span>${p.name}</span></a>`;
  side.insertAdjacentHTML('afterbegin', link(pages[0]) + [...new Set(pages.slice(1).map(p => p.group))]
    .map(g => `<div class="nav-g"><div class="nav-h">${g}</div>${pages.filter(p => p.group === g).map(link).join('')}</div>`).join(''));

  // deeplink: index.html#report → เปิด report.html; รับเฉพาะหน้าที่อยู่ในเมนู (ไม่ใช่ path อิสระ)
  // ไม่มี hash → หน้าที่เปิดล่าสุดของผู้ใช้คนนี้ (ถ้ายังมีสิทธิ์) ไม่งั้นหน้าหลัก — แยกต่อผู้ใช้ เพราะเครื่องหน้าร้านใช้ร่วมกัน
  const LAST = 'cms-last:' + ICS_AUTH.session().user.username;
  const frame = document.querySelector('iframe');
  const route = () => {
    const links = [...side.querySelectorAll('a')];
    let a = links.find(x => x.hash === location.hash);
    if (!a) { a = links.find(x => x.hash === '#' + get(LAST)) || links[0]; history.replaceState(null, '', a.hash); }
    set(LAST, a.hash.slice(1));
    links.forEach(x => x.toggleAttribute('aria-current', x === a));
    const p = UI.page(a.hash.slice(1));
    document.getElementById('crumbIcon').innerHTML = UI.icon(p.icon);
    document.getElementById('pageGroup').textContent = p.id === 'home' ? 'Maison Roru' : 'Maison Roru · ' + p.group;
    document.getElementById('pageTitle').textContent = p.name;
    document.title = `${p.name} · Maison Roru`;
    const src = p.id + '.html?v=' + ICS_V; // ICS_V = เลขใน version.txt ตอน deploy (js/auth.js)
    // replace = ไม่เพิ่ม history ของ iframe, ปุ่ม back ย้อนตาม hash อย่างเดียว
    try { if (!frame.contentWindow.location.href.endsWith('/' + src)) frame.contentWindow.location.replace(src); } catch (_) { frame.src = src; }
    app.classList.remove('open');
  };
  addEventListener('hashchange', route);
  route();

  // ผู้ใช้: หน้านี้ผ่าน ICS_AUTH.guard() แล้ว (js/auth.js)
  const { user, role } = ICS_AUTH.session();
  document.querySelectorAll('[data-name]').forEach(el => el.textContent = user.name || user.username);
  document.querySelectorAll('[data-initial]').forEach(el => el.textContent = (user.name || user.username).trim()[0]);
  document.querySelectorAll('[data-role]').forEach(el => el.textContent = role.name);
  document.getElementById('userMenu').addEventListener('toggle', e => document.getElementById('user').classList.toggle('on', e.newState === 'open'));
  document.getElementById('logout').onclick = ICS_AUTH.logout;

  // ลากขอบขวาเพื่อยืด/หด (160–480px)
  grip.addEventListener('pointerdown', e => {
    grip.setPointerCapture(e.pointerId); app.classList.add('dragging');
    const move = e => side.style.setProperty('--w', Math.min(480, Math.max(160, e.clientX)) + 'px');
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', () => {
      grip.removeEventListener('pointermove', move); app.classList.remove('dragging');
      set('cms-side-w', parseInt(side.style.getPropertyValue('--w')));
    }, { once: true });
  });
})();
