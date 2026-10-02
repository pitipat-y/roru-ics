// ฐานข้อมูลจำลอง: users + roles
// ponytail: เก็บใน localStorage ของเบราว์เซอร์ — แก้ที่เครื่องไหนก็อยู่แค่เครื่องนั้น; ย้ายไป server/DB จริงเมื่อมี backend
const DB = (() => {
  const KEY = 'ics-db';

  // หน้าที่คุมสิทธิ์ได้ (id = ชื่อไฟล์ .html = #hash ในเมนู CMS)
  const PAGES = [
    { id: 'material', name: 'คำนวณวัตถุดิบ' },
    { id: 'report',   name: 'รายงานการขาย' },
    { id: 'users',    name: 'จัดการผู้ใช้' },
    { id: 'roles',    name: 'สิทธิ์การใช้งาน' },
    { id: 'pr',        name: 'ใบขอซื้อ (PR)' },
    { id: 'po',        name: 'ใบสั่งซื้อ (PO)' },
    { id: 'stock-in',  name: 'รับเข้า' },
    { id: 'stock-out', name: 'เบิกออก' },
    { id: 'stock',     name: 'สต๊อกคงเหลือ / ตรวจนับ' },
    { id: 'tracker',   name: 'ค้นหาวัตถุดิบ' },
    { id: 'pos-tables',  name: 'รับลูกค้า' },
    { id: 'pos-order',   name: 'สั่งออเดอร์' },
    { id: 'pos-bill',    name: 'เช็คบิล' },
    { id: 'pos-report',  name: 'รายงานยอดขาย (POS)' },
    { id: 'pos-coupons', name: 'คูปองส่วนลด' },
    { id: 'pos-menu',    name: 'เมนูและราคา' },
  ];
  const ADMIN = 'administrator'; // role นี้ล็อกให้มีสิทธิ์ทุกหน้าเสมอ กันระบบไม่มีผู้ดูแล

  // perms: { page: 'rwd' } r = read (เข้าหน้าได้), w = write (เพิ่ม/แก้), d = delete
  // hash = SHA-256 ของรหัสผ่าน
  const SEED = {
    roles: [
      { id: ADMIN,     name: 'Administrator', perms: {} }, // ทุกหน้าเสมอ (auth.js) — หน้าใหม่ไม่ต้องมาเพิ่มที่นี่
      { id: 'manager', name: 'Manager',       perms: { material: 'rwd', report: 'r', users: 'r', pr: 'rwd', po: 'rwd', 'stock-in': 'rwd', 'stock-out': 'rwd', stock: 'rw', tracker: 'r',
                                                 'pos-tables': 'rwd', 'pos-order': 'rwd', 'pos-bill': 'rwd', 'pos-report': 'rw', 'pos-coupons': 'rwd', 'pos-menu': 'rwd' } },
      { id: 'cashier', name: 'Cashier',       perms: { 'pos-tables': 'rw', 'pos-order': 'rw', 'pos-bill': 'rw', 'pos-report': 'r', 'pos-coupons': 'r', tracker: 'r' } },
      { id: 'waiter',  name: 'Waiter',        perms: { 'pos-tables': 'rw', 'pos-order': 'rw' } },
      { id: 'staff',   name: 'Staff',         perms: { material: 'rw', pr: 'rw', 'stock-in': 'rw', 'stock-out': 'rw', stock: 'rw', tracker: 'r' } },
      { id: 'viewer',  name: 'Viewer',        perms: { material: 'r', report: 'r', stock: 'r', tracker: 'r' } },
    ],
    users: [
      { username: 'ics',     name: 'ICS Admin',     role: ADMIN,     hash: 'adfd6d2e9530e67fab887cb2ff37d693397a40f2546e6c4b9c39ca9d3faa998d' },
      { username: 'manager', name: 'ผู้จัดการร้าน',   role: 'manager', hash: '7b7686ab7dddaa1566a4922a9f8f964eb2d0b2fd193648e4fd7c0a81a708164b' },
      { username: 'staff',   name: 'พนักงานครัว',    role: 'staff',   hash: '02defbfb8190f9d0719ef7a23da2049bd2e61442bc14021a6d8a4ae35ca334b7' },
      { username: 'viewer',  name: 'ผู้ดูรายงาน',     role: 'viewer',  hash: 'b842c07f3384db40b26fee223040febcd05d8144c576c2113d49280dbb1b0c2d' },
      { username: 'cashier', name: 'แคชเชียร์',       role: 'cashier', hash: '47f1b8909c0487ce80f148f601252fd3322e7a0076d61650fd83f3784f5a50d3' },
      { username: 'waiter',  name: 'พนักงานเสิร์ฟ',   role: 'waiter',  hash: '3b2b50a0127712826d129bd26e2ee143e19c601953c8a045e1bef51e8efb5a59' },
    ],
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  const load = () => {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.users && d?.roles) return d; } catch (_) {}
    return clone(SEED);
  };
  const save = d => localStorage.setItem(KEY, JSON.stringify(d));
  const reset = () => { try { localStorage.removeItem(KEY); } catch (_) {} };

  return { PAGES, ADMIN, load, save, reset };
})();
