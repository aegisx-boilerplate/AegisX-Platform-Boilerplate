# AegisX Platform Boilerplate Architecture

## 🏗️ Domain-Driven Design (DDD) with Layered Architecture

แนวทางสถาปัตยกรรมของ AegisX Platform Boilerplate ใช้หลักการ **Domain-Driven Design (DDD)** ร่วมกับ **Layered Architecture Pattern** เพื่อสร้างระบบที่มีโครงสร้างชัดเจน ง่ายต่อการพัฒนา และบำรุงรักษา

## 📁 โครงสร้าง Workspace

```text
libs/
├── core/                           # 🔧 Core Business Logic Layer
│   ├── auth/                       # @aegisx/core-auth ✅
│   ├── rbac/                       # @aegisx/core-rbac ✅
│   ├── user-management/            # @aegisx/core-user-management
│   ├── config/                     # @aegisx/core-config ✅
│   ├── database/                   # @aegisx/core-database ✅
│   ├── logger/                     # @aegisx/core-logger ✅
│   └── errors/                     # @aegisx/core-errors ✅
│
├── features/                       # 🚀 Application/Presentation Layer
│   ├── system/                     # 🔐 Core System Features (Boilerplate)
│   │   ├── auth/                   # @aegisx/features-system-auth
│   │   ├── user-management/        # @aegisx/features-system-user-management
│   │   ├── rbac/                   # @aegisx/features-system-rbac
│   │   └── admin/                  # @aegisx/features-system-admin
│   │
│   └── business/                   # 🏥 Business Domain Features
│       ├── patient/                # @aegisx/features-business-patient
│       ├── appointment/            # @aegisx/features-business-appointment
│       ├── billing/                # @aegisx/features-business-billing
│       └── inventory/              # @aegisx/features-business-inventory
│
├── shared/                         # 📦 Cross-cutting Concerns
│   ├── constants/                  # @aegisx/shared-constants ✅
│   ├── types/                      # @aegisx/shared-types ✅
│   ├── utils/                      # @aegisx/shared-utils ✅
│   └── validations/                # @aegisx/shared-validations ✅
│
└── integrations/                   # 🌐 Infrastructure Layer
    ├── minio/                      # @aegisx/integration-minio ✅
    ├── rabbitmq/                   # @aegisx/integration-rabbitmq ✅
    └── redis/                      # @aegisx/integration-redis ✅
```

## 🎯 Architecture Layers

### 1. Core Layer (`libs/core/*`)

#### Domain Layer ตาม Clean Architecture

- **หน้าที่**: Pure business logic, domain models, business rules
- **ลักษณะ**: Framework-agnostic, ไม่มี HTTP/Database dependencies
- **เทคโนโลยี**: TypeScript, tsyringe DI, TypeBox schemas
- **ตัวอย่าง**: `AuthService`, `PatientRepository`, `BillingCalculator`

```typescript
// libs/core/auth/src/services/auth.service.ts
@injectable()
export class AuthService {
  constructor(
    @inject('UserRepository') private userRepo: UserRepository,
    @inject('TokenService') private tokenService: TokenService
  ) {}

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    // Pure business logic
  }
}
```

### 2. Features Layer (`libs/features/*`)

#### Application + Presentation Layer

- **หน้าที่**: HTTP routes, request/response handling, orchestration
- **เทคโนโลยี**: Fastify, tsyringe DI, TypeBox validation
- **แบ่งเป็น 2 ประเภท**:
  - **System Features**: Boilerplate components (auth, rbac, user management)
  - **Business Features**: Domain-specific features (patient, appointment)

```typescript
// libs/features/system/auth/src/plugin.ts
export async function authPlugin(fastify: FastifyInstance) {
  // Register DI containers
  container.register('AuthService', AuthService);
  
  // Register routes
  await fastify.register(authRoutes);
}

// libs/features/system/auth/src/routes.ts
export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/login', async (request, reply) => {
    const authService = container.resolve<AuthService>('AuthService');
    // Handle HTTP layer
  });
}
```

### 3. Shared Layer (`libs/shared/*`)

#### Cross-cutting Concerns

- **หน้าที่**: Utilities, constants, types ที่ใช้ร่วมกัน
- **ตัวอย่าง**: Date utilities, validation schemas, common types

### 4. Integrations Layer (`libs/integrations/*`)

#### Infrastructure Layer

- **หน้าที่**: External services, databases, message queues
- **ตัวอย่าง**: MinIO, RabbitMQ, Redis integrations

## 🔄 Dependency Flow

```text
┌─────────────────┐    ┌─────────────────┐
│  Features       │───▶│  Core           │
│  (Routes/HTTP)  │    │  (Business)     │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  Integrations   │    │  Shared         │
│  (External)     │    │  (Utils)        │
└─────────────────┘    └─────────────────┘
```

**หลักการ**: Features ขึ้นอยู่กับ Core, แต่ Core ไม่ขึ้นอยู่กับ Features (Dependency Inversion)

## 📦 Package Naming Convention

### System Features (Boilerplate)

```text
@aegisx/features-system-auth
@aegisx/features-system-user-management
@aegisx/features-system-rbac
@aegisx/features-system-admin
```

### Business Features (Project-specific)

```text
@aegisx/features-business-patient
@aegisx/features-business-appointment
@aegisx/features-business-billing
@aegisx/features-business-inventory
```

### Core Packages

```text
@aegisx/core-auth
@aegisx/core-patient
@aegisx/core-appointment
@aegisx/core-billing
```

## 🎯 การสร้าง Feature ใหม่

### 1. สร้าง Core Package

```bash
nx g @nx/node:lib patient --directory=libs/core --importPath=@aegisx/core-patient --tags=scope:core,type:patient
```

### 2. สร้าง Feature Package

```bash
# System feature
nx g @nx/node:lib auth --directory=libs/features/system --importPath=@aegisx/features-system-auth --tags=scope:feature,type:system

# Business feature  
nx g @nx/node:lib patient --directory=libs/features/business --importPath=@aegisx/features-business-patient --tags=scope:feature,type:business
```

### 3. โครงสร้างไฟล์

**Core Package:**

```text
libs/core/patient/
├── src/
│   ├── services/           # PatientService, PatientValidator
│   ├── repositories/       # PatientRepository  
│   ├── models/            # Patient domain models
│   ├── types/             # Patient interfaces
│   └── schemas/           # TypeBox validation schemas
├── package.json           # @aegisx/core-patient
└── project.json
```

**Feature Package:**

```text
libs/features/business/patient/
├── src/
│   ├── plugin.ts          # DI setup + register routes
│   ├── routes.ts          # Patient CRUD routes
│   └── index.ts           # Export plugin
├── package.json           # @aegisx/features-business-patient  
└── project.json
```

## 🔥 Plugin Architecture

### การทำงานของ Fastify Plugin System

```typescript
// apps/api/src/main.ts
async function bootstrap() {
  const app = Fastify();
  
  // Register system features
  await app.register(authPlugin);
  await app.register(rbacPlugin);
  
  // Register business features
  await app.register(patientPlugin);
  await app.register(appointmentPlugin);
  
  await app.listen({ port: 3000 });
}
```

### DI Container Setup

```typescript
// libs/features/system/auth/src/plugin.ts
import { container } from 'tsyringe';
import { AuthService } from '@aegisx/core-auth';

export async function authPlugin(fastify: FastifyInstance) {
  // Register dependencies
  container.register('AuthService', AuthService);
  container.register('UserRepository', UserRepository);
  
  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
}
```

## 💡 ประโยชน์ของแนวทางนี้

### 1. Modular Monolith

- ได้ประโยชน์ของ microservices (modularity)
- ยังคงความง่ายของ monolith (single deployment)

### 2. Separation of Concerns

- Business logic แยกจาก HTTP layer
- ง่ายต่อการ test และ maintain

### 3. Reusable Boilerplate

- System features ใช้ซ้ำได้ในหลายโปรเจกต์
- Business features specific ต่อโปรเจกต์

### 4. Scalable Architecture

- เพิ่ม feature ใหม่ได้ง่าย
- แยก team development ได้ชัดเจน

### 5. Technology Agnostic Core

- Core business logic ไม่ผูกกับ framework
- เปลี่ยน presentation layer ได้ (REST → GraphQL)

## 🏷️ Pattern Names

แนวทางนี้รู้จักกันในชื่อ:

- **Domain-Driven Design (DDD) Architecture**
- **Clean Architecture (Uncle Bob)**
- **Layered Architecture Pattern**
- **Modular Monorepo Architecture**
- **Feature-Sliced Design (FSD)**
- **Plugin-Based Architecture**

## 📚 อ้างอิง

- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Clean Architecture by Robert Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Nx Monorepo Best Practices](https://nx.dev/concepts/more-concepts/applications-and-libraries)
- [Fastify Plugin System](https://fastify.dev/docs/latest/Guides/Plugins-Guide/)
