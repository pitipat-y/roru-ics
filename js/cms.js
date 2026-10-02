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

  side.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    side.querySelectorAll('a').forEach(x => x.removeAttribute('aria-current'));
    a.setAttribute('aria-current', 'page');
    document.getElementById('pageTitle').textContent = a.textContent;
    app.classList.remove('open');
  }));

  // avatar: แสดงเมื่อ login (cookie ics-auth จาก ICS ใน iframe — same origin)
  // ponytail: ผู้ใช้มีคนเดียว (ics) ชื่อเลย hardcode; ดึงจาก server เมื่อมีระบบ user จริง
  const USER = 'ics';
  const authed = () => /(?:^|; )ics-auth=[^;]+/.test(document.cookie);
  const renderUser = () => {
    document.getElementById('user').hidden = !authed();
    document.querySelectorAll('[data-name]').forEach(el => el.textContent = USER);
    document.querySelectorAll('[data-initial]').forEach(el => el.textContent = USER[0]);
  };
  document.getElementById('userMenu').addEventListener('toggle', e => document.getElementById('user').classList.toggle('on', e.newState === 'open'));
  addEventListener('message', e => { if (e.source === document.querySelector('iframe').contentWindow && e.data === 'ics-auth') renderUser(); });
  document.getElementById('logout').onclick = () => {
    document.cookie = 'ics-auth=; max-age=0; path=/; SameSite=Strict';
    document.getElementById('userMenu').hidePopover();
    document.querySelector('iframe').contentWindow.location.reload();
    renderUser();
  };
  renderUser();

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
