# Maison Roru — ICS (Ingredient Calculation)

เว็บคำนวณวัตถุดิบจากยอดขายเมนู เป็น static HTML ล้วน ไม่มี build และไม่มี backend

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าแรก (CMS): แถบหัว, เมนูซ้าย และ iframe ที่เปิด `test.html` |
| `css/cms.css`, `js/cms.js` | style และ logic ของ CMS (hamburger, ปรับความกว้างแถบเมนู, user menu) |
| `report.html`, `css/report.css`, `js/report.js` | รายงานการขาย: รวมยอดจากประวัติ (ชื่อไฟล์ซ้ำใช้อันล่าสุด) + แผนภูมิแท่ง CSS |
| `test.html` | หน้า ICS (HTML อย่างเดียว) เปิดเดี่ยว ๆ ได้หรือเปิดใน CMS ก็ได้ |
| `css/style.css` | CSS ที่เขียนเอง และ Tailwind ที่ compile แล้ว |
| `js/data.js` | `DEFAULT_MASTER` คือข้อมูลสูตร Master ตั้งต้น |
| `js/app.js` | logic ทั้งหมด |

ไลบรารี: `xlsx-js-style` ดึงจาก jsdelivr CDN

## แก้ Master ตั้งต้น

1. แก้ `DEFAULT_MASTER` ใน `js/data.js`
2. เปลี่ยนวันที่ใน `MASTER_DEFAULT_NAME` ใน `js/app.js` เช่น `MaisonrRoru-ICS-03Oct69.xlsx`
3. Bump version (ดูหัวข้อถัดไป)

## Deploy

ทุกครั้งที่แก้ css หรือ js ต้องเปลี่ยนเลข `?v=` ใน `test.html`, `index.html` และ `report.html` เพื่อไม่ให้มือถือใช้ไฟล์เก่าในแคช:

```sh
V=$(date +%Y%m%d)$(printf %03d $((RANDOM%1000))); sed -i '' -E "s/\?v=[0-9]+/?v=$V/g" test.html index.html report.html
```

## ข้อมูลที่เก็บในเบราว์เซอร์

- ประวัติการคำนวณและ Master ที่อัปโหลด: เก็บใน `localStorage` และอยู่เฉพาะเครื่องนั้น
- การล็อกอิน: cookie `ics-auth` อายุ 30 วัน

## ⚠️ ความปลอดภัย

รหัสผ่านตรวจในหน้าเว็บเอง ใครเปิดดู source ก็หาเจอ ระบบนี้กันได้แค่คนทั่วไป ห้ามใช้กับข้อมูลลับ
