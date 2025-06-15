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

## การสร้างและตั้งค่า Nx Library สำหรับ Node.js (CommonJS) ใน Monorepo

### 1. การสร้าง lib ใหม่สำหรับ Node.js

ใช้คำสั่งนี้ (ตัวอย่าง):

```sh
nx g @nx/js:lib logger --directory=core --bundler=tsc --publishable --importPath=@aegisx/core-logger --strict --unitTestRunner=jest --linter=eslint
```

---

### 2. ตั้งค่า tsconfig ของ lib (Node.js/Backend)

**ไฟล์ `libs/core/<lib-name>/tsconfig.lib.json`**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo",
    "emitDeclarationOnly": false,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"],
    "module": "commonjs",              // <--- สำคัญ! ใช้ commonjs สำหรับ Node.js
    "moduleResolution": "node"         // <--- สำคัญ! ใช้ node สำหรับ Node.js
  },
  "include": ["src/**/*.ts"],
  "exclude": ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"]
}
```

---

### 3. package.json ของ lib

- **อย่าใส่** `"type": "module"` ถ้าต้องการ CommonJS
- ตัวอย่างที่ถูกต้อง:

```json
{
  "name": "@aegisx/core-logger",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "dependencies": {
    "tslib": "^2.3.0"
  }
}
```

---

### 4. การ import ในฝั่ง API (Node.js)

- ใช้ `require('@aegisx/core-logger')` หรือ `import { ... } from '@aegisx/core-logger'` ได้ (ถ้าใช้ TypeScript)
- ถ้า API เป็น CommonJS (default ของ Node.js) จะ require ได้ปกติ

---

### 5. การ build และใช้งาน

- build lib ด้วย `nx run <lib>:build`
- build api ด้วย `nx run @aegisx/api:build`
- serve api ด้วย `nx serve @aegisx/api`

---

### 6. ข้อควรระวัง

- ถ้า lib ใดมี `"type": "module"` หรือ build ออกมาเป็น ESM (`export ...`), แต่ API เป็น CommonJS จะ require ไม่ได้ (เกิด error `[ERR_REQUIRE_ESM]`)
- ถ้าต้องการ ESM จริง ๆ ให้ทั้ง API และ lib เป็น ESM ทั้งคู่ และต้องเปลี่ยน build config, import/export ให้เหมาะสม

---

### 7. สรุปแนวทางสำหรับ Node.js lib

- tsconfig.lib.json: `"module": "commonjs"`, `"moduleResolution": "node"`
- package.json: **อย่าใส่** `"type": "module"`
- build แล้วไฟล์ใน dist ต้องเป็น CommonJS (`module.exports`, `require`)
- ถ้าเจอ error ESM/CJS ให้เช็ค 2 จุดนี้ก่อนเสมอ

---

#### หมายเหตุ: ถ้าต้องการ ESM (optional)

- tsconfig.lib.json: `"module": "nodenext"` หรือ `"esnext"`
- package.json: ใส่ `"type": "module"`
- API ต้อง build เป็น ESM ด้วย (เปลี่ยน format ใน project.json, เปลี่ยน entrypoint เป็น .mjs หรือใช้ import/export)
- ต้องใช้ import/export เท่านั้น (require() ใช้ไม่ได้) 