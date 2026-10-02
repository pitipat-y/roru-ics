@README.md

## กฎ

- ตอบผู้ใช้เป็นภาษาไทย
- แก้ `css/` หรือ `js/` แล้วต้อง bump `?v=` ใน `test.html` และ `index.html` ทุกครั้ง
- ไม่มี build step ห้ามเพิ่ม bundler หรือ framework
- ชื่อเมนูจับคู่ผ่าน `norm()` ใน `js/app.js` ซึ่งไม่สนตัวพิมพ์เล็กใหญ่และวรรณยุกต์ เช่น ō = o
