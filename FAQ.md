# ❓ FAQ: Nx Monorepo (Node.js + Angular)

## Q: ควรตั้งค่า tsconfig อย่างไรใน monorepo ที่มีทั้ง Node.js (Fastify) และ Angular?

**A:**
- tsconfig.base.json: ใส่เฉพาะ option กลางที่ทุกโปรเจกต์ใช้ร่วมกัน (strict, target, paths, ฯลฯ)
- Node.js/Fastify: ใส่ module: nodenext, moduleResolution: nodenext, customConditions เฉพาะใน tsconfig ของแอป/ไลบรารี Node
- Angular: ใส่ module: esnext, moduleResolution: node, lib: ["es2022", "dom"], target: es2022 เฉพาะใน tsconfig ของแอป Angular
- ห้ามใส่ emitDeclarationOnly ใน base (Angular จะ error)
- ถ้าเจอ error TS4111 (process.env) ให้ใช้ process.env['KEY'] แทน dot notation

**ตัวอย่าง:**
- tsconfig.base.json (กลาง):
  - ไม่มี module, moduleResolution, dom, emitDeclarationOnly, customConditions
- apps/api/tsconfig.json (Node):
  - module: nodenext, moduleResolution: nodenext, customConditions
- apps/web/tsconfig.json (Angular):
  - module: esnext, moduleResolution: node, lib: ["es2022", "dom"], target: es2022

---

## Q: ถ้าอยากรัน Angular หลายแอปพร้อมกันไม่ให้ port ชนกัน ต้องตั้งค่ายังไง?

**A:**
- ใส่ "port": xxxx ใน section "options" ของ target "serve" ใน project.json ของแต่ละแอป
- ตัวอย่าง: web ใช้ 4200, admin ใช้ 4201
- หรือจะระบุ --port=xxxx ตอนรัน nx serve ก็ได้ 