@README.md

## กฎ

- ตอบผู้ใช้เป็นภาษาไทย
- แก้ `css/` หรือ `js/` แล้วต้อง bump `?v=` ใน ทุกไฟล์ `.html` และ `version.txt` ทุกครั้ง (ดูคำสั่งใน README)
- ไม่มี build step ห้ามเพิ่ม bundler หรือ framework
- ชื่อเมนูจับคู่ผ่าน `norm()` ใน `js/app.js` ซึ่งไม่สนตัวพิมพ์เล็กใหญ่และวรรณยุกต์ เช่น ō = o
- หน้าใหม่: เพิ่มใน `DB.PAGES` (`js/db.js`) พร้อม group/icon/desc, เรียก `ICS_AUTH.guard('id')` ใน `<head>` แล้วโหลด `js/ui.js`, ปุ่มที่ต้องใช้สิทธิ์ใส่ `data-perm="w"|"d"`
- UI ใหม่ใช้ของกลางใน `js/ui.js` (ไอคอน, หัวหน้า, toast, handoff) — ไม่เพิ่มไลบรารี icon/UI; `material.html` ใช้ชุดของตัวเองใน `app.js`
- Tailwind preflight ใน `style.css` ตั้ง `svg{display:block}` → ไอคอนในข้อความใช้คลาส `.ic` (inline-block)
