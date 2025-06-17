# AegisX Platform Boilerplate Architecture

## 🏗️ Domain-Driven Design (DDD) with Layered Architecture

แนวทางสถาปัตยกรรมของ AegisX Platform Boilerplate ใช้หลักการ **Domain-Driven Design (DDD)** ร่วมกับ **Layered Architecture Pattern** เพื่อสร้างระบบที่มีโครงสร้างชัดเจน ง่ายต่อการพัฒนา และบำรุงรักษา

## 📁 โครงสร้าง Workspace

```text
libs/
├── core/                           # 🔧 Core Business Logic Layer
│   ├── auth/                       # @aegisx/core-auth ✅
│   ├── rbac/                       # @aegisx/core-rbac ✅
│   ├── user/                       # @aegisx/core-user
│   ├── config/                     # @aegisx/core-config ✅
│   ├── database/                   # @aegisx/core-database ✅
│   ├── logger/                     # @aegisx/core-logger ✅
│   └── errors/                     # @aegisx/core-errors ✅
│
├── features/                       # 🚀 Application/Presentation Layer
│   ├── system/                     # 🔐 Infrastructure Features (Boilerplate)
│   │   ├── auth/                   # @aegisx/features-system-auth ✅
│   │   ├── user-management/        # @aegisx/features-system-user-management
│   │   ├── rbac/                   # @aegisx/features-system-rbac
│   │   ├── admin/                  # @aegisx/features-system-admin
│   │   ├── notification/           # @aegisx/features-system-notification
│   │   ├── audit-log/              # @aegisx/features-system-audit-log
│   │   └── file-upload/            # @aegisx/features-system-file-upload
│   │
│   └── business/                   # 🏥 Business Domain Features
│       ├── patient/                # @aegisx/features-business-patient
│       ├── appointment/            # @aegisx/features-business-appointment
│       ├── billing/                # @aegisx/features-business-billing
│       ├── inventory/              # @aegisx/features-business-inventory
│       ├── doctor/                 # @aegisx/features-business-doctor
│       └── medical-record/         # @aegisx/features-business-medical-record
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
- **ตัวอย่าง**: `AuthService`, `UserRepository`, `PatientService`

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

#### แบ่งเป็น 2 ประเภทหลัก:

## 🔐 **System Features** (`libs/features/system/*`)

**Infrastructure/Platform Features (Boilerplate)**

### **ลักษณะ:**
- ✅ **Reusable** ได้ในหลายโปรเจกต์
- ✅ **Framework agnostic** core logic
- ✅ **HTTP layer เท่านั้น** - ไม่มี business logic
- ✅ ใช้ services จาก `@aegisx/core-*`

### **โครงสร้าง System Feature:**
```text
libs/features/system/auth/
├── handlers/              # HTTP request handlers
├── routes/                # Route definitions
├── schemas/               # Validation schemas
└── plugin.ts              # DI + route registration
```

### **ตัวอย่าง System Features:**
- **auth** - Authentication (login, register, JWT)
- **user-management** - User CRUD, profile management
- **rbac** - Role-based access control
- **admin** - Admin panel, system settings
- **notification** - Push notifications, emails
- **audit-log** - System audit trails
- **file-upload** - File upload/download

### **ตัวอย่างโค้ด System Feature:**
```typescript
// libs/features/system/auth/src/handlers/auth.handlers.ts
export class AuthHandlers {
  async login(request: FastifyRequest, reply: FastifyReply) {
    // HTTP layer only - delegate to core service
    const authService = container.resolve<AuthService>('AuthService');
    const result = await authService.login(request.body);
    return reply.send(result);
  }
}
```

## 🏥 **Business Features** (`libs/features/business/*`)

**Domain-Specific Features**

### **ลักษณะ:**
- ❌ **Project-specific** - ไม่ reuse ได้
- ✅ **มี business logic** เป็นของตัวเอง
- ✅ **มี services/repositories** สำหรับ domain logic
- ✅ Complex business rules และ domain models

### **โครงสร้าง Business Feature:**
```text
libs/features/business/patient/
├── services/              # Business logic services
│   ├── patient.service.ts
│   └── medical-record.service.ts
├── repositories/          # Data access
│   ├── patient.repository.ts
│   └── medical-record.repository.ts
├── models/                # Domain models
├── handlers/              # HTTP handlers
├── routes/                # Route definitions
├── schemas/               # Validation schemas
└── plugin.ts              # DI + route registration
```

### **ตัวอย่าง Business Features:**
- **patient** - Patient management (HIS specific)
- **appointment** - Appointment booking
- **billing** - Billing & payments
- **inventory** - Medical inventory
- **doctor** - Doctor management
- **medical-record** - Medical records

### **ตัวอย่างโค้ด Business Feature:**
```typescript
// libs/features/business/patient/src/services/patient.service.ts
@injectable()
export class PatientService {
  constructor(
    @inject('PatientRepository') private patientRepo: PatientRepository
  ) {}

  async admitPatient(patientId: string, roomId: string): Promise<void> {
    // Complex business logic specific to healthcare domain
    const patient = await this.patientRepo.findById(patientId);
    
    if (patient.status === 'discharged') {
      throw new Error('Cannot admit discharged patient');
    }
    
    // Business rules...
    await this.patientRepo.updateStatus(patientId, 'admitted');
  }
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
┌─────────────────────────┐    ┌─────────────────────────┐
│  System Features        │───▶│  Core Services          │
│  (HTTP layer only)      │    │  (Business logic)       │
└─────────────────────────┘    └─────────────────────────┘
┌─────────────────────────┐              │
│  Business Features      │──────────────┘
│  (Full business logic)  │    
└─────────────────────────┘    
         │                               │
         ▼                               ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│  Integrations           │    │  Shared                 │
│  (External services)    │    │  (Utilities)            │
└─────────────────────────┘    └─────────────────────────┘
```

## 📦 Package Naming Convention

### System Features (Boilerplate)

```text
@aegisx/features-system-auth
@aegisx/features-system-user-management
@aegisx/features-system-rbac
@aegisx/features-system-admin
@aegisx/features-system-notification
@aegisx/features-system-audit-log
@aegisx/features-system-file-upload
```

### Business Features (Project-specific)

```text
@aegisx/features-business-patient
@aegisx/features-business-appointment
@aegisx/features-business-billing
@aegisx/features-business-inventory
@aegisx/features-business-doctor
@aegisx/features-business-medical-record
```

### Core Packages

```text
@aegisx/core-auth
@aegisx/core-user
@aegisx/core-rbac
@aegisx/core-patient        # Business domain
@aegisx/core-appointment    # Business domain
@aegisx/core-billing        # Business domain
```

## 🎯 การตัดสินใจ: System vs Business

### **ถาม 3 คำถาม:**

1. **Reusable?** - ใช้ได้ในโปรเจกต์อื่นไหม?
   - ✅ System: Authentication ใช้ได้ทุกโปรเจกต์
   - ❌ Business: Patient management ใช้เฉพาะ HIS

2. **Domain-Independent?** - ไม่ผูกกับ business domain เฉพาะไหม?
   - ✅ System: User management ทั่วไป
   - ❌ Business: Medical records เฉพาะโรงพยาบาล

3. **Infrastructure?** - เป็น platform/infrastructure ไหม?
   - ✅ System: File upload, notifications
   - ❌ Business: Appointment booking

## 📋 Feature Comparison

| Aspect | System Features | Business Features |
|--------|----------------|-------------------|
| **Purpose** | Infrastructure/Platform | Domain Logic |
| **Reusability** | ✅ Cross-project | ❌ Project-specific |
| **Services** | ❌ Use core services | ✅ Own business logic |
| **Repositories** | ❌ Use core repos | ✅ Domain-specific data |
| **Location** | `features/system/` | `features/business/` |
| **Examples** | Auth, RBAC, Admin | Patient, Billing, Orders |
| **Complexity** | HTTP layer only | Full business logic |

## 🎯 การสร้าง Feature ใหม่

### 1. สร้าง System Feature

```bash
# System feature (HTTP layer only)
nx g @nx/node:lib auth \
  --directory=libs/features/system \
  --importPath=@aegisx/features-system-auth \
  --tags=scope:feature,type:system
```

### 2. สร้าง Business Feature

```bash
# Business feature (with business logic)
nx g @nx/node:lib patient \
  --directory=libs/features/business \
  --importPath=@aegisx/features-business-patient \
  --tags=scope:feature,type:business
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
  await app.register(userManagementPlugin);
  
  // Register business features
  await app.register(patientPlugin);
  await app.register(appointmentPlugin);
  await app.register(billingPlugin);
  
  await app.listen({ port: 3000 });
}
```

## 💡 ประโยชน์ของแนวทางนี้

### 1. Modular Monolith

- ได้ประโยชน์ของ microservices (modularity)
- ยังคงความง่ายของ monolith (single deployment)

### 2. Clear Separation

- **System features** = Platform/Infrastructure
- **Business features** = Domain Logic
- **Core** = Pure business abstractions

### 3. Reusable Boilerplate

- System features ใช้ซ้ำได้ในหลายโปรเจกต์
- Business features specific ต่อโปรเจกต์

### 4. Scalable Architecture

- เพิ่ม feature ใหม่ได้ง่าย
- แยก team development ได้ชัดเจน
- ย้าย microservices ได้ในอนาคต

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
- **Hexagonal Architecture (Ports & Adapters)**

## 📚 อ้างอิง

- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Clean Architecture by Robert Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Nx Monorepo Best Practices](https://nx.dev/concepts/more-concepts/applications-and-libraries)
- [Fastify Plugin System](https://fastify.dev/docs/latest/Guides/Plugins-Guide/)
