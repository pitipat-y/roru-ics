// ponytail: auth ฝั่ง client — คนอ่าน source ข้ามได้ กันได้แค่คนทั่วไป; ย้ายไปตรวจที่ server เมื่อมี backend
// โหลดแบบ sync ใน <head> ของทุกหน้า เพื่อให้ guard ทำงานก่อนหน้าแสดงผล
const ICS_AUTH = (() => {
  const COOKIE = 'ics-auth', MAX_AGE = 30 * 24 * 3600; // 1 เดือน
  const USER = 'ics';
  const HASH = 'adfd6d2e9530e67fab887cb2ff37d693397a40f2546e6c4b9c39ca9d3faa998d';
  const FALLBACK = atob('aWNz') + atob('MTIzNA=='); // ใช้เมื่อไม่มี crypto.subtle (http ที่ไม่ใช่ localhost)
  const read = () => { const m = document.cookie.match(/(?:^|; )ics-auth=([^;]*)/); return m ? decodeURIComponent(m[1]) : ''; };
  const write = v => { document.cookie = `${COOKIE}=${encodeURIComponent(v)}; max-age=${v ? MAX_AGE : 0}; path=/; SameSite=Strict`; };
  const ok = () => { const v = read(); return v === HASH || v === FALLBACK; };
  const sha256 = async t => {
    if (!window.crypto?.subtle) return null;
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  };
  const go = url => { document.documentElement.style.display = 'none'; top.location.replace(url); };

  return {
    USER, ok,
    async login(user, pwd) {
      const h = await sha256(pwd);
      if (user !== USER || !(h === HASH || pwd === FALLBACK)) return false;
      write(h || FALLBACK); return true;
    },
    logout() { write(''); go('login.html'); },
    // หน้าที่ต้อง login: ยังไม่ login → login.html#page; login แล้วแต่เปิดตรง (ไม่อยู่ใน CMS) → index.html#page
    // ใช้ #page (ชื่อเมนู) แทน URL เต็ม เลยไม่มี open redirect
    guard(page) {
      if (!ok()) return go('login.html' + (page ? '#' + page : location.hash));
      if (page && top === self) go('index.html#' + page);
    },
  };
})();
