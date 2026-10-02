@README.md

## กฎ

- ตอบผู้ใช้เป็นภาษาไทย
- แก้ `css/` หรือ `js/` แล้วต้อง bump `?v=` ใน `index.html`, `login.html`, `material.html` และ `report.html` ทุกครั้ง
- ไม่มี build step ห้ามเพิ่ม bundler หรือ framework
- ชื่อเมนูจับคู่ผ่าน `norm()` ใน `js/app.js` ซึ่งไม่สนตัวพิมพ์เล็กใหญ่และวรรณยุกต์ เช่น ō = o
- หน้าใหม่ที่ต้อง login ต้องเรียก `ICS_AUTH.guard()` ใน `<head>` (ดู `js/auth.js`)
