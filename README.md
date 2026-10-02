# Maison Roru — ICS (Ingredient Calculation)

เว็บคำนวณวัตถุดิบจากยอดขายเมนู เป็น static HTML ล้วน ไม่มี build และไม่มี backend

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `login.html` | หน้า login → กลับไปหน้าที่ขอไว้ (`#material`, `#report`) |
| `js/auth.js` | login/logout + `guard()` ใส่ใน `<head>` ของทุกหน้าที่ต้อง login |
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

ทุกครั้งที่แก้ css หรือ js ต้องเปลี่ยนเลข `?v=` ใน `index.html`, `login.html`, `material.html` และ `report.html` เพื่อไม่ให้มือถือใช้ไฟล์เก่าในแคช:

```sh
V=$(date +%Y%m%d)$(printf %03d $((RANDOM%1000))); sed -i '' -E "s/\?v=[0-9]+/?v=$V/g" index.html login.html material.html report.html
```

## ข้อมูลที่เก็บในเบราว์เซอร์

- ประวัติการคำนวณและ Master ที่อัปโหลด: เก็บใน `localStorage` และอยู่เฉพาะเครื่องนั้น
- การล็อกอิน: cookie `ics-auth` อายุ 30 วัน

## การเข้าถึง

- ทุกหน้าต้อง login ก่อน ถ้ายังไม่ login จะถูกส่งไป `login.html`
- `material.html` และ `report.html` เปิดตรงไม่ได้ จะถูกส่งเข้า CMS (`index.html#...`)
- หน้าใหม่ที่ต้อง login: ใส่ `<script src="js/auth.js"></script><script>ICS_AUTH.guard('ชื่อเมนู')</script>` ใน `<head>`

## ⚠️ ความปลอดภัย

รหัสผ่านตรวจในหน้าเว็บเอง ใครเปิดดู source ก็หาเจอ ระบบนี้กันได้แค่คนทั่วไป ห้ามใช้กับข้อมูลลับ
