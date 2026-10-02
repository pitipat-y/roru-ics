# Maison Roru — ICS (Ingredient Calculation)

เว็บคำนวณวัตถุดิบจากยอดขายเมนู เป็น static HTML ล้วน ไม่มี build และไม่มี backend

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `login.html` | หน้า login → กลับไปหน้าที่ขอไว้ (`#material`, `#report`) |
| `js/db.js` | ฐานข้อมูลจำลอง: หน้า (`PAGES`), role, user (รหัสเก็บเป็น SHA-256) — แก้แล้วเก็บใน localStorage `ics-db` |
| `js/auth.js` | login/logout, `can(page, 'r'\|'w'\|'d')` + `guard()` ใส่ใน `<head>` ของทุกหน้าที่ต้อง login |
| `users.html`, `js/users.js` | จัดการผู้ใช้: เพิ่ม/แก้/ลบ, กำหนด role |
| `roles.html`, `js/roles.js` | สิทธิ์การใช้งาน: role × หน้า × R/W/D |
| `css/admin.css` | style ของหน้า users/roles |
| `pos-tables.html`, `pos-order.html`, `pos-bill.html`, `pos-report.html`, `pos-coupons.html`, `pos-menu.html` | หน้าร้าน (POS): เปลือก HTML ใช้ `js/pos.js` (เลือกโหมดจาก `data-type`) + `css/pos.css` |
| `pr.html`, `po.html`, `stock-in.html`, `stock-out.html`, `stock.html`, `tracker.html` | ระบบคลัง: เปลือก HTML บรรทัดเดียว ใช้ `js/inv.js` (เลือกโหมดจาก `data-type`) + `css/inv.css` |
| `index.html` | หน้าแรก (CMS): แถบหัว, เมนูซ้าย และ iframe เปิดหน้าตามเมนู |
| `css/cms.css`, `js/cms.js` | style และ logic ของ CMS (hamburger, ปรับความกว้างแถบเมนู, user menu) |
| `report.html`, `css/report.css`, `js/report.js` | รายงานการขาย: รวมยอดจากประวัติ (ชื่อไฟล์ซ้ำใช้อันล่าสุด) + แผนภูมิแท่ง CSS |
| `material.html` | หน้าคำนวณวัตถุดิบ (เปิดผ่าน CMS เท่านั้น) |
| `test.html` | redirect ไป `index.html#material` ให้ลิงก์เก่ายังใช้ได้ |
| `css/style.css` | CSS ที่เขียนเอง และ Tailwind ที่ compile แล้ว |
| `js/data.js` | `DEFAULT_MASTER` คือข้อมูลสูตร Master ตั้งต้น |
| `js/app.js` | logic ทั้งหมด |

ไลบรารี: `xlsx-js-style` ดึงจาก jsdelivr CDN

## Deeplink

- `index.html#material` เปิดหน้าคำนวณวัตถุดิบ
- `index.html#report` เปิดหน้ารายงานการขาย
- ถ้าไม่ใส่ hash หรือใส่ชื่อที่ไม่มีในเมนู จะเปิดเมนูแรก
- เพิ่มเมนูใหม่: เพิ่ม `<a href="#xxx">` ในแถบเมนูของ `index.html` แล้วจะเปิดไฟล์ `xxx.html`

## แก้ Master ตั้งต้น

1. แก้ `DEFAULT_MASTER` ใน `js/data.js`
2. เปลี่ยนวันที่ใน `MASTER_DEFAULT_NAME` ใน `js/app.js` เช่น `MaisonrRoru-ICS-03Oct69.xlsx`
3. Bump version (ดูหัวข้อถัดไป)

## Deploy

ทุกครั้งที่แก้ css หรือ js ต้องเปลี่ยนเลข `?v=` ใน ทุกไฟล์ `.html` (ยกเว้น `test.html`) เพื่อไม่ให้มือถือใช้ไฟล์เก่าในแคช:

```sh
V=$(date +%Y%m%d)$(printf %03d $((RANDOM%1000))); sed -i '' -E "s/\?v=[0-9]+/?v=$V/g" index.html login.html material.html report.html users.html roles.html pr.html po.html stock-in.html stock-out.html stock.html tracker.html pos-*.html
```

## ข้อมูลที่เก็บในเบราว์เซอร์

- ประวัติการคำนวณและ Master ที่อัปโหลด: เก็บใน `localStorage` และอยู่เฉพาะเครื่องนั้น
- การล็อกอิน: cookie `ics-auth` อายุ 30 วัน

## หน้าร้าน (POS)

```
รับลูกค้า (เปิดบิลโต๊ะ T1–T12 / กลับบ้าน) → สั่งออเดอร์ (ส่งครัว) → เช็คบิล (คูปอง, ชำระ, ใบเสร็จ)
                                                        ↓
                         รายงานยอดขาย → "ส่งไปคำนวณวัตถุดิบ" (เข้าประวัติของหน้าคำนวณ)
```

- ยอดสุทธิ = (รวม − ส่วนลด) + Service 10% + VAT 7% (ค่าคงที่ `SERVICE`, `VAT`, `TABLES` ใน `js/pos.js`)
- เมนูตั้งต้น = เมนูหลักจาก Master (ไม่รวมชิ้นส่วนคอร์ส "1/4 …", "6. …") **ราคาเป็นราคาตัวอย่าง** แก้ที่หน้า "เมนูและราคา"
- ชื่อเมนูตรงกับ Master → ยอดขาย POS ส่งไปคำนวณวัตถุดิบได้เลย
- คูปอง: ลด % หรือบาท, ยอดขั้นต่ำ, วันหมดอายุ, จำกัดจำนวนครั้ง, เปิด/ปิด; ตัวอย่าง `WELCOME10`, `SAVE200`
- รายการที่ส่งครัวแล้ว ลบได้เฉพาะคนที่มีสิทธิ์ D; ยกเลิกบิลต้องมีสิทธิ์ D
- ข้อมูลเก็บใน localStorage `ics-pos` (เครื่องเดียว — แคชเชียร์กับพนักงานเสิร์ฟต้องใช้เครื่องเดียวกันจนกว่าจะมี backend)

## ระบบคลัง

```
PR (รออนุมัติ → อนุมัติ) → PO (รอรับของ) → รับเข้า (+สต๊อก)
                                             เบิกออก (−สต๊อก)
                                             ตรวจนับ (± ปรับให้ตรงยอดนับจริง)
```

- วัตถุดิบ + หน่วยมาจาก Master (`js/data.js`) และพิมพ์ชื่อใหม่เองได้
- คงเหลือ = ผลรวมความเคลื่อนไหว (`moves`) ทั้งหมด, ดูย้อนหลังรายวัตถุดิบได้ที่หน้า "ค้นหาวัตถุดิบ"
- สร้าง PO จาก PR / รับเข้าจาก PO → ดึงรายการมาให้และเปลี่ยนสถานะเอกสารต้นทาง
- ลบเอกสาร → ย้อนยอดสต๊อกและคืนสถานะเอกสารต้นทาง; เอกสารที่ถูกใช้ต่อแล้ว (PR สั่งซื้อแล้ว / PO รับของแล้ว) ลบไม่ได้
- เบิกเกินคงเหลือได้แต่ต้องยืนยัน (ยอดติดลบ แสดงสีแดง)
- ข้อมูลเก็บใน localStorage `ics-inv` (เครื่องเดียว)

## ผู้ใช้และสิทธิ์

ผู้ใช้ตั้งต้น (ใน `js/db.js`):

| user | รหัส | role |
|---|---|---|
| `ics` | `ics1234` | Administrator: ทุกหน้า R/W/D เสมอ รวมหน้าใหม่ (ล็อกไว้ แก้ไม่ได้) |
| `manager` | `manager1234` | Manager: คำนวณ RWD, รายงาน R, ผู้ใช้ R, PR/PO/รับเข้า/เบิกออก RWD, สต๊อก RW, ค้นหา R, หน้าร้านทั้งหมด |
| `staff` | `staff1234` | Staff: คำนวณ RW, PR/รับเข้า/เบิกออก RW, สต๊อก RW, ค้นหา R |
| `viewer` | `viewer1234` | Viewer: คำนวณ R, รายงาน R, สต๊อก R, ค้นหา R |
| `cashier` | `cashier1234` | Cashier: รับลูกค้า/สั่ง/เช็คบิล RW, รายงาน POS R, คูปอง R, ค้นหาวัตถุดิบ R |
| `waiter` | `waiter1234` | Waiter: รับลูกค้า/สั่งออเดอร์ RW |

- **R** เข้าหน้าได้ / **W** เพิ่ม-แก้ไข (เช่น อัปโหลดไฟล์) / **D** ลบ
- เมนูใน CMS แสดงเฉพาะหน้าที่มีสิทธิ์ R; เปิดหน้าที่ไม่มีสิทธิ์ → เด้งไปเมนูแรกที่มีสิทธิ์
- ปุ่มที่ต้องใช้สิทธิ์ ใส่ `data-perm="w"` หรือ `data-perm="d"` → ซ่อนอัตโนมัติ
- ยังไม่ login → `login.html`; เปิด `material.html` ฯลฯ ตรง ๆ → เด้งเข้า CMS (`index.html#...`)
- กันล็อกตัวเองออก: ลบ/เปลี่ยน role ตัวเองไม่ได้, ลบ role ที่มีผู้ใช้อยู่ไม่ได้, Administrator แก้สิทธิ์ไม่ได้
- เปลี่ยนรหัสผ่านหรือลบผู้ใช้ → session เดิมของคนนั้นใช้ไม่ได้ทันที
- หน้าใหม่: เพิ่มใน `DB.PAGES`, ใส่ `<script>ICS_AUTH.guard('ชื่อ')</script>` ใน `<head>` และเพิ่มลิงก์ `#ชื่อ` ในกลุ่มเมนู (`.nav-g`) ของ `index.html`

## ⚠️ ความปลอดภัย

ผู้ใช้/สิทธิ์/รหัสผ่าน (hash) อยู่ในเบราว์เซอร์ทั้งหมด: แก้ที่เครื่องไหนก็มีผลแค่เครื่องนั้น และคนที่เปิด DevTools แก้สิทธิ์ตัวเองได้ ระบบนี้กันได้แค่คนทั่วไป ห้ามใช้กับข้อมูลลับ
