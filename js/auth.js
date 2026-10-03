// ponytail: auth ฝั่ง client — คนอ่าน source ข้ามได้ กันได้แค่คนทั่วไป; ย้ายไปตรวจที่ server เมื่อมี backend
// ต้องโหลด js/db.js ก่อน; โหลดแบบ sync ใน <head> เพื่อให้ guard ทำงานก่อนหน้าแสดงผล
const ICS_AUTH = (() => {
  const COOKIE = 'ics-auth', MAX_AGE = 30 * 24 * 3600; // 1 เดือน
  const read = () => { const m = document.cookie.match(/(?:^|; )ics-auth=([^;]*)/); return m ? decodeURIComponent(m[1]) : ''; };
  const write = v => { document.cookie = `${COOKIE}=${encodeURIComponent(v)}; max-age=${v ? MAX_AGE : 0}; path=/; SameSite=Strict`; };
  // ponytail: ต้องมี crypto.subtle (https, localhost, file://) — http ธรรมดา login ไม่ได้
  const sha256 = async t => {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  };
  // กันเด้งวน: เด้งเกิน 3 ครั้งใน 5 วินาที (นับต่อแท็บ) → หยุด แล้วบอกสาเหตุบนหน้าแทนการ reload ไม่รู้จบ
  // (เช่น Firefox เปิดแบบ file:// แต่ละไฟล์เห็น cookie/localStorage ไม่ตรงกัน)
  const go = (url, why = '') => {
    let hops = [];
    try { hops = JSON.parse(sessionStorage.getItem('ics-hops') || '[]').filter(t => Date.now() - t < 5000); hops.push(Date.now()); sessionStorage.setItem('ics-hops', JSON.stringify(hops)); } catch (_) {}
    if (hops.length <= 3) { document.documentElement.style.display = 'none'; return top.location.replace(url); }
    try { sessionStorage.removeItem('ics-hops'); } catch (_) {}
    let stored = false; try { stored = !!localStorage.getItem('ics-db'); } catch (_) {}
    const info = [`${location.pathname.split('/').pop()} → ${url}`, why, `cookie: ${read() ? 'มี' : 'ไม่มี'}`, `ข้อมูลผู้ใช้: ${stored ? 'localStorage' : 'ค่าตั้งต้น'}`, `เปิดแบบ: ${location.protocol}`];
    addEventListener('DOMContentLoaded', () => {
      document.body.innerHTML = `<div style="max-width:560px;margin:48px auto;padding:20px;border:1px solid var(--line);border-radius:12px;font:15px/1.6 system-ui">
        <b>หยุดการเด้งหน้าวน</b><br>${info.map(s => String(s).replace(/</g, '&lt;')).join('<br>')}<br><br>
        ${location.protocol === 'file:' ? 'เปิดไฟล์ตรงจากเครื่อง: ให้เปิดผ่าน server แทน เช่น <code>python3 -m http.server</code> แล้วเข้า http://localhost:8000' : 'ลองออกจากระบบแล้วเข้าใหม่ หรือล้าง cookie ของเว็บนี้'}</div>`;
    });
  };

  // cookie = "username:hash" → ตรวจกับ DB ทุกครั้ง: เปลี่ยนรหัส/ลบ user แล้ว session เดิมใช้ไม่ได้ทันที
  const session = () => {
    const v = read(), i = v.lastIndexOf(':');
    if (i < 1) return null;
    const db = DB.load(), user = db.users.find(u => u.username === v.slice(0, i));
    if (!user || user.hash !== v.slice(i + 1)) return null;
    return { user, role: db.roles.find(r => r.id === user.role) || { id: '', name: '-', perms: {} } };
  };
  const can = (page, p = 'r') => { const s = session(); return !!s && (s.role.id === DB.ADMIN || !!s.role.perms[page]?.includes(p)); };

  return {
    session, can, sha256,
    ok: () => !!session(),
    async login(username, pwd) {
      const h = await sha256(pwd);
      const user = DB.load().users.find(u => u.username === username);
      if (!user || user.hash !== h) return false;
      write(`${username}:${h}`); return true;
    },
    logout() { write(''); go('login.html'); },
    // ยังไม่ login → login.html#page; ไม่มีสิทธิ์อ่าน → index.html (เปิดเมนูแรกที่มีสิทธิ์); เปิดตรง → index.html#page
    // ไม่มีสิทธิ์ w/d → ใส่ class no-w/no-d ที่ <html> ให้ CSS ซ่อน [data-perm="w"|"d"]
    // ใช้ #page (ชื่อเมนู) แทน URL เต็ม เลยไม่มี open redirect
    guard(page) {
      if (!session()) return go('login.html' + (page ? '#' + page : location.hash), 'ไม่พบ session (cookie ไม่ตรงกับข้อมูลผู้ใช้)');
      if (!page) return;
      // หน้าที่ไม่อยู่ใน DB.PAGES (เช่น home) แค่ต้อง login
      if (DB.PAGES.some(p => p.id === page) && !can(page, 'r')) return go('index.html', `ไม่มีสิทธิ์อ่านหน้า ${page}`);
      if (top === self) return go('index.html#' + page, 'เปิดหน้าตรง ไม่ได้อยู่ใน CMS');
      if (!can(page, 'w')) document.documentElement.classList.add('no-w');
      if (!can(page, 'd')) document.documentElement.classList.add('no-d');
    },
  };
})();
