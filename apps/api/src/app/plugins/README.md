# API Plugins

โฟลเดอร์นี้เก็บ Fastify plugins ที่ใช้ในแอปพลิเคชัน AegisX Platform API

## Plugins ที่มีอยู่

### 1. Swagger Plugin (`swagger.ts`)

Plugin สำหรับการจัดการ API documentation ด้วย OpenAPI 3.0 specification

#### Features:
- **OpenAPI 3.0 Specification**: มาตรฐาน API documentation
- **Swagger UI**: Interface สำหรับทดสอบ API
- **Authentication Schemes**: รองรับ JWT Bearer และ API Key
- **Comprehensive Schemas**: Schema สำหรับ Error, User, Pagination
- **Environment-aware**: ปรับแต่งตาม environment
- **Multi-tenant Support**: รองรับ X-Tenant-ID header

#### Endpoints ที่เพิ่มเข้ามา:
- `/docs` - Swagger UI interface
- `/docs/json` - OpenAPI JSON specification
- `/docs/yaml` - OpenAPI YAML specification

### 2. Helmet Plugin (`helmet.ts`)

Plugin สำหรับ security headers ด้วย @fastify/helmet

#### Features:
- **Content Security Policy (CSP)**: ป้องกัน XSS attacks
- **HTTP Strict Transport Security (HSTS)**: บังคับใช้ HTTPS
- **X-Frame-Options**: ป้องกัน clickjacking
- **X-Content-Type-Options**: ป้องกัน MIME type sniffing
- **X-XSS-Protection**: เปิดใช้ XSS filter
- **Referrer-Policy**: ควบคุม referrer information
- **Permissions Policy**: ควบคุม browser features

#### Environment-specific:
- **Development**: CSP report-only mode, ไม่มี HSTS
- **Production**: เปิดใช้ HSTS, Expect-CT
- **Swagger UI Support**: อนุญาต unsafe-inline, unsafe-eval

### 3. Rate Limit Plugin (`rate-limit.ts`)

Plugin สำหรับจำกัดจำนวน requests ด้วย @fastify/rate-limit

#### Features:
- **IP-based Rate Limiting**: จำกัดตาม IP address
- **Environment-aware Limits**: ปรับแต่งตาม environment
- **Custom Error Responses**: ข้อความ error ที่เป็นมิตร
- **Logging Integration**: บันทึก rate limit events
- **Redis Store Support**: สำหรับ production clustering
- **Localhost Bypass**: ใน development mode

#### Rate Limits:
- **Development**: 1,000 requests/minute + localhost bypass
- **Staging**: 500 requests/minute + localhost bypass
- **Production**: 100 requests/minute + Redis store

#### Headers ที่ส่งกลับ:
- `X-RateLimit-Limit` - จำนวน requests ที่อนุญาต
- `X-RateLimit-Remaining` - จำนวน requests ที่เหลือ
- `X-RateLimit-Reset` - เวลาที่ reset
- `Retry-After` - เวลาที่ควรลองใหม่

### 4. Sensible Plugin (`sensible.ts`)

Plugin เริ่มต้นของ Fastify ที่เพิ่ม utilities และ best practices

## การเพิ่ม Plugin ใหม่

1. สร้างไฟล์ใหม่ในโฟลเดอร์นี้
2. Export default function ที่ wrap ด้วย `fastify-plugin`
3. Plugin จะถูก auto-load โดย Fastify AutoLoad

### ตัวอย่าง Plugin:

```typescript
import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

export default fp(async function myPlugin(fastify: FastifyInstance) {
  // Plugin logic here
  
  fastify.log.info('✅ My Plugin loaded');
}, {
  name: 'my-plugin',
  dependencies: ['other-plugin'] // optional
});
```

## Best Practices

1. **ใช้ fastify-plugin**: เพื่อให้ plugin encapsulation ทำงานถูกต้อง
2. **ตั้งชื่อ plugin**: ใช้ `name` property เพื่อ debugging
3. **กำหนด dependencies**: ถ้า plugin ต้องการ plugin อื่น
4. **Logging**: เพิ่ม log เมื่อ plugin load สำเร็จ
5. **Error Handling**: จัดการ error ที่อาจเกิดขึ้น
6. **TypeScript**: ใช้ proper typing สำหรับ FastifyInstance

## การ Debug

ใช้ Fastify's built-in logging เพื่อ debug plugin loading:

```bash
# เปิด debug logs
DEBUG=fastify* npm run serve
```

## อ้างอิง

- [Fastify Plugins](https://www.fastify.io/docs/latest/Reference/Plugins/)
- [fastify-plugin](https://github.com/fastify/fastify-plugin)
- [Fastify AutoLoad](https://github.com/fastify/fastify-autoload) 