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

  // deeplink: index.html#report → เปิด report.html; รับเฉพาะชื่อที่มีในเมนูและมีสิทธิ์อ่าน (ไม่ใช่ path อิสระ)
  const frame = document.querySelector('iframe');
  side.querySelectorAll('a').forEach(a => { if (!ICS_AUTH.can(a.hash.slice(1), 'r')) a.remove(); });
  side.querySelectorAll('.nav-g').forEach(g => { if (!g.querySelector('a')) g.remove(); });
  const route = () => {
    const links = [...side.querySelectorAll('a')];
    if (!links.length) { frame.hidden = true; document.getElementById('noaccess').hidden = false; return; }
    const a = links.find(x => x.hash === location.hash) || links[0];
    links.forEach(x => x.toggleAttribute('aria-current', x === a));
    if (a === links[0] && location.hash !== a.hash) history.replaceState(null, '', a.hash);
    document.getElementById('pageTitle').textContent = a.textContent;
    const src = a.hash.slice(1) + '.html';
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
