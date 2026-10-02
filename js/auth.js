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
  const go = url => { document.documentElement.style.display = 'none'; top.location.replace(url); };

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
      if (!session()) return go('login.html' + (page ? '#' + page : location.hash));
      if (!page) return;
      if (!can(page, 'r')) return go('index.html');
      if (top === self) return go('index.html#' + page);
      if (!can(page, 'w')) document.documentElement.classList.add('no-w');
      if (!can(page, 'd')) document.documentElement.classList.add('no-d');
    },
  };
})();
