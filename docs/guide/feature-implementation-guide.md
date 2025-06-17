# Feature Implementation Guide

## 🎯 คู่มือการสร้าง Feature ใหม่ใน AegisX Platform

เอกสารนี้จะแนะนำขั้นตอนการสร้าง feature ใหม่ตามแนวทาง **Domain-Driven Design (DDD) with Layered Architecture** ของ AegisX Platform

## � ขั้นตอนแรก: กำหนดประเภท Feature

ก่อนเริ่มสร้าง feature ให้ตัดสินใจก่อนว่าเป็น **System Feature** หรือ **Business Feature**

### 🔐 System Features (Infrastructure/Boilerplate)

**เมื่อไหร่ใช้:** เมื่อ feature นี้เป็น infrastructure ที่ reuse ได้ในหลายโปรเจกต์

**ลักษณะ:**
- ✅ Reusable ข้ามโปรเจกต์
- ✅ Domain-independent
- ✅ Platform/Infrastructure level
- ❌ ไม่มี business logic เฉพาะ

**ตัวอย่าง:** Authentication, User Management, RBAC, Admin Panel, File Upload, Notifications

**โครงสร้าง:**
```text
libs/features/system/auth/
├── handlers/              # HTTP handlers only
├── routes/                # Route definitions
├── schemas/               # Validation schemas
└── plugin.ts              # DI + route registration
```

### 🏥 Business Features (Domain-Specific)

**เมื่อไหร่ใช้:** เมื่อ feature นี้มี business logic เฉพาะโปรเจกต์

**ลักษณะ:**
- ❌ Project-specific - ไม่ reuse ได้
- ✅ มี business logic ซับซ้อน
- ✅ มี domain-specific rules
- ✅ ต้องมี services/repositories

**ตัวอย่าง:** Patient Management, Appointment Booking, Billing, Medical Records

**โครงสร้าง:**
```text
libs/features/business/patient/
├── services/              # Business logic
├── repositories/          # Data access
├── models/                # Domain models
├── handlers/              # HTTP handlers
├── routes/                # Route definitions
├── schemas/               # Validation schemas
└── plugin.ts              # DI + route registration
```

## 📋 ขั้นตอนการสร้าง System Feature

### Step 1: สร้าง System Feature Library

```bash
nx g @nx/node:lib auth \
  --directory=libs/features/system \
  --importPath=@aegisx/features-system-auth \
  --tags=scope:feature,type:system \
  --strict=true \
  --unitTestRunner=jest \
  --linter=eslint
```

### Step 2: สร้างโครงสร้างไฟล์

```bash
# สร้าง directories
mkdir -p libs/features/system/auth/src/lib/{handlers,routes,schemas}
```

### Step 3: สร้าง Schemas

```typescript
// libs/features/system/auth/src/lib/schemas/auth.schemas.ts
import { Type, Static } from '@sinclair/typebox';

export const LoginSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 6 })
});

export const AuthResponseSchema = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String(),
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    firstName: Type.String(),
    lastName: Type.String()
  })
});

export type LoginRequest = Static<typeof LoginSchema>;
export type AuthResponse = Static<typeof AuthResponseSchema>;
```

### Step 4: สร้าง Handlers (HTTP Layer Only)

```typescript
// libs/features/system/auth/src/lib/handlers/auth.handlers.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { container } from 'tsyringe';
import { LoginRequest } from '../schemas';

export class AuthHandlers {
  async login(
    request: FastifyRequest<{ Body: LoginRequest }>,
    reply: FastifyReply
  ) {
    try {
      // Resolve service from core (injected via DI)
      const authService = container.resolve<AuthService>('AuthService');
      
      // Delegate to business logic
      const result = await authService.login(request.body);
      
      return reply.code(200).send(result);
    } catch (error) {
      request.log.error('Login error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }
}
```

### Step 5: สร้าง Routes

```typescript
// libs/features/system/auth/src/lib/routes/auth.routes.ts
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthHandlers } from '../handlers/auth.handlers';
import { LoginSchema, AuthResponseSchema, ErrorSchema } from '../schemas';

export const authRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const handlers = new AuthHandlers();

  fastify.post('/login', {
    schema: {
      body: LoginSchema,
      response: {
        200: AuthResponseSchema,
        401: ErrorSchema
      }
    }
  }, handlers.login);
};
```

### Step 6: สร้าง Plugin

```typescript
// libs/features/system/auth/src/lib/plugin.ts
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authRoutes } from './routes/auth.routes';

export const authPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
};

export default authPlugin;
```

## 📋 ขั้นตอนการสร้าง Business Feature

### Step 1: วางแผน Domain Architecture

```text
Feature: Patient Management (HIS Domain)
├── Business Logic: PatientService, AdmissionService
├── Data Access: PatientRepository, MedicalRecordRepository
├── Domain Models: Patient, MedicalRecord, Admission
├── Business Rules: Admission policies, Discharge rules
└── HTTP Layer: Routes, Handlers, Schemas
```

### Step 2: สร้าง Business Feature Library

```bash
nx g @nx/node:lib patient \
  --directory=libs/features/business \
  --importPath=@aegisx/features-business-patient \
  --tags=scope:feature,type:business \
  --strict=true \
  --unitTestRunner=jest \
  --linter=eslint
```

### Step 3: สร้างโครงสร้างไฟล์ (Full Business Logic)

```bash
mkdir -p libs/features/business/patient/src/lib/{services,repositories,models,handlers,routes,schemas}
```

### Step 4: สร้าง Domain Models

```typescript
// libs/features/business/patient/src/lib/models/patient.model.ts
export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  phoneNumber: string;
  email?: string;
  address: Address;
  status: PatientStatus;
  medicalRecords: MedicalRecord[];
  admissions: Admission[];
  createdAt: Date;
  updatedAt: Date;
}

export enum PatientStatus {
  ACTIVE = 'active',
  ADMITTED = 'admitted',
  DISCHARGED = 'discharged',
  DECEASED = 'deceased'
}

export interface Admission {
  id: string;
  patientId: string;
  roomId: string;
  admissionDate: Date;
  dischargeDate?: Date;
  reason: string;
  attendingPhysician: string;
  status: AdmissionStatus;
}
```

### Step 5: สร้าง Business Services

```typescript
// libs/features/business/patient/src/lib/services/patient.service.ts
import { injectable, inject } from 'tsyringe';
import { PatientRepository } from '../repositories/patient.repository';
import { Patient, PatientStatus, Admission } from '../models';

@injectable()
export class PatientService {
  constructor(
    @inject('PatientRepository') 
    private readonly patientRepository: PatientRepository,
    @inject('AdmissionService')
    private readonly admissionService: AdmissionService
  ) {}

  async admitPatient(
    patientId: string, 
    roomId: string, 
    reason: string
  ): Promise<Admission> {
    // Complex business logic specific to healthcare
    const patient = await this.patientRepository.findById(patientId);
    
    if (!patient) {
      throw new PatientNotFoundError(patientId);
    }

    if (patient.status === PatientStatus.ADMITTED) {
      throw new PatientAlreadyAdmittedError(patientId);
    }

    if (patient.status === PatientStatus.DECEASED) {
      throw new InvalidPatientStatusError('Cannot admit deceased patient');
    }

    // Business rule: Check room availability
    const isRoomAvailable = await this.admissionService.isRoomAvailable(roomId);
    if (!isRoomAvailable) {
      throw new RoomNotAvailableError(roomId);
    }

    // Create admission record
    const admission = await this.admissionService.createAdmission({
      patientId,
      roomId,
      reason,
      admissionDate: new Date()
    });

    // Update patient status
    await this.patientRepository.updateStatus(patientId, PatientStatus.ADMITTED);

    return admission;
  }

  async dischargePatient(
    patientId: string,
    dischargeNotes: string
  ): Promise<void> {
    // More complex business logic...
    const patient = await this.patientRepository.findById(patientId);
    
    if (patient.status !== PatientStatus.ADMITTED) {
      throw new InvalidPatientStatusError('Patient is not currently admitted');
    }

    // Business rule: Ensure all treatments are completed
    const hasPendingTreatments = await this.hasPendingTreatments(patientId);
    if (hasPendingTreatments) {
      throw new PendingTreatmentsError('Cannot discharge patient with pending treatments');
    }

    // Discharge process...
    await this.admissionService.dischargePatient(patientId, dischargeNotes);
    await this.patientRepository.updateStatus(patientId, PatientStatus.DISCHARGED);
  }

  private async hasPendingTreatments(patientId: string): Promise<boolean> {
    // Business logic to check pending treatments
    return false; // Implementation...
  }
}
```

### Step 6: สร้าง Repositories

```typescript
// libs/features/business/patient/src/lib/repositories/patient.repository.ts
import { injectable } from 'tsyringe';
import { Patient, PatientStatus, CreatePatientDto } from '../models';

@injectable()
export abstract class PatientRepository {
  abstract findById(id: string): Promise<Patient | null>;
  abstract findByEmail(email: string): Promise<Patient | null>;
  abstract create(data: CreatePatientDto): Promise<Patient>;
  abstract update(id: string, data: Partial<Patient>): Promise<Patient>;
  abstract updateStatus(id: string, status: PatientStatus): Promise<void>;
  abstract findActiveAdmissions(patientId: string): Promise<Admission[]>;
  abstract delete(id: string): Promise<void>;
}

// Implementation (usually in infrastructure layer)
@injectable()
export class PostgresPatientRepository extends PatientRepository {
  constructor(
    @inject('DatabaseConnection') private db: DatabaseConnection
  ) {
    super();
  }

  async findById(id: string): Promise<Patient | null> {
    // Database implementation
    const result = await this.db.query(
      'SELECT * FROM patients WHERE id = $1', 
      [id]
    );
    return result.rows[0] || null;
  }

  // ... other implementations
}
```

### Step 7: สร้าง HTTP Layer

```typescript
// libs/features/business/patient/src/lib/handlers/patient.handlers.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { container } from 'tsyringe';
import { PatientService } from '../services/patient.service';
import { AdmitPatientRequest, DischargePatientRequest } from '../schemas';

export class PatientHandlers {
  async admitPatient(
    request: FastifyRequest<{ Body: AdmitPatientRequest }>,
    reply: FastifyReply
  ) {
    try {
      const patientService = container.resolve<PatientService>('PatientService');
      const { patientId, roomId, reason } = request.body;
      
      const admission = await patientService.admitPatient(patientId, roomId, reason);
      
      return reply.code(201).send(admission);
    } catch (error) {
      // Error handling with proper HTTP codes
      if (error instanceof PatientNotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      
      if (error instanceof PatientAlreadyAdmittedError) {
        return reply.code(409).send({ error: error.message });
      }
      
      request.log.error('Admission error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }
}
```

## 🧪 Testing Strategy

### Unit Tests สำหรับ Business Logic

```typescript
// libs/features/business/patient/src/lib/services/patient.service.spec.ts
describe('PatientService', () => {
  let service: PatientService;
  let mockPatientRepo: jest.Mocked<PatientRepository>;
  let mockAdmissionService: jest.Mocked<AdmissionService>;

  beforeEach(() => {
    mockPatientRepo = createMockPatientRepository();
    mockAdmissionService = createMockAdmissionService();
    
    service = new PatientService(mockPatientRepo, mockAdmissionService);
  });

  describe('admitPatient', () => {
    it('should successfully admit a patient', async () => {
      // Arrange
      const patient = createMockPatient({ status: PatientStatus.ACTIVE });
      mockPatientRepo.findById.mockResolvedValue(patient);
      mockAdmissionService.isRoomAvailable.mockResolvedValue(true);
      
      const expectedAdmission = createMockAdmission();
      mockAdmissionService.createAdmission.mockResolvedValue(expectedAdmission);

      // Act
      const result = await service.admitPatient('patient-1', 'room-1', 'Surgery');

      // Assert
      expect(result).toEqual(expectedAdmission);
      expect(mockPatientRepo.updateStatus).toHaveBeenCalledWith(
        'patient-1', 
        PatientStatus.ADMITTED
      );
    });

    it('should throw error when patient is already admitted', async () => {
      // Arrange
      const patient = createMockPatient({ status: PatientStatus.ADMITTED });
      mockPatientRepo.findById.mockResolvedValue(patient);

      // Act & Assert
      await expect(
        service.admitPatient('patient-1', 'room-1', 'Surgery')
      ).rejects.toThrow(PatientAlreadyAdmittedError);
    });
  });
});
```

## 🚀 Best Practices

### 1. Error Handling

```typescript
// Custom domain errors
export class PatientNotFoundError extends Error {
  constructor(patientId: string) {
    super(`Patient with id ${patientId} not found`);
    this.name = 'PatientNotFoundError';
  }
}

export class PatientAlreadyAdmittedError extends Error {
  constructor(patientId: string) {
    super(`Patient ${patientId} is already admitted`);
    this.name = 'PatientAlreadyAdmittedError';
  }
}
```

### 2. Dependency Injection

```typescript
// Register dependencies in main app
container.register('PatientRepository', PostgresPatientRepository);
container.register('PatientService', PatientService);
container.register('AdmissionService', AdmissionService);
```

### 3. Validation

```typescript
// Business validation in services
async admitPatient(patientId: string, roomId: string): Promise<Admission> {
  // Validate business rules
  if (!patientId || !roomId) {
    throw new ValidationError('Patient ID and Room ID are required');
  }
  
  // Additional business validations...
}
```

## 📚 สรุปความแตกต่าง

| Aspect | System Features | Business Features |
|--------|----------------|-------------------|
| **สร้างโครงสร้าง** | Handlers, Routes, Schemas | Services, Repositories, Models + HTTP |
| **Business Logic** | ใน Core packages | ในตัว Feature เอง |
| **ความซับซ้อน** | HTTP layer อย่างเดียว | Full business complexity |
| **การทดสอบ** | Integration tests | Unit + Integration tests |
| **Dependencies** | Resolve จาก Core | Self-contained |

ใช้แนวทางนี้จะทำให้ architecture สะอาด แยกหน้าที่ชัดเจน และง่ายต่อการ maintain ครับ!
│   │   │   └── patient-validation.service.ts
│   │   ├── repositories/
│   │   │   └── patient.repository.ts
│   │   ├── schemas/
│   │   │   ├── patient.schema.ts
│   │   │   └── create-patient.schema.ts
│   │   └── types/
│   │       ├── patient.types.ts
│   │       └── index.ts
│   └── index.ts
├── package.json
├── project.json
├── tsconfig.lib.json
└── tsconfig.spec.json
```

#### ตัวอย่างโค้ด Core Package

**Domain Model:**

```typescript
// libs/core/patient/src/lib/models/patient.model.ts
export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  phoneNumber: string;
  email?: string;
  address: Address;
  medicalRecords: MedicalRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  province: string;
  postalCode: string;
}
```

**Business Service:**

```typescript
// libs/core/patient/src/lib/services/patient.service.ts
import { injectable, inject } from 'tsyringe';
import { PatientRepository } from '../repositories/patient.repository';
import { Patient, CreatePatientDto } from '../types';

@injectable()
export class PatientService {
  constructor(
    @inject('PatientRepository') 
    private readonly patientRepository: PatientRepository
  ) {}

  async createPatient(data: CreatePatientDto): Promise<Patient> {
    // Business logic validation
    await this.validatePatientData(data);
    
    // Create patient
    return this.patientRepository.create(data);
  }

  async getPatientById(id: string): Promise<Patient | null> {
    return this.patientRepository.findById(id);
  }

  private async validatePatientData(data: CreatePatientDto): Promise<void> {
    // Business validation rules
    if (data.dateOfBirth > new Date()) {
      throw new Error('Date of birth cannot be in the future');
    }
  }
}
```

**Repository Interface:**

```typescript
// libs/core/patient/src/lib/repositories/patient.repository.ts
import { injectable } from 'tsyringe';
import { Patient, CreatePatientDto, UpdatePatientDto } from '../types';

@injectable()
export abstract class PatientRepository {
  abstract create(data: CreatePatientDto): Promise<Patient>;
  abstract findById(id: string): Promise<Patient | null>;
  abstract findAll(filters?: PatientFilters): Promise<Patient[]>;
  abstract update(id: string, data: UpdatePatientDto): Promise<Patient>;
  abstract delete(id: string): Promise<void>;
}
```

**TypeBox Schemas:**

```typescript
// libs/core/patient/src/lib/schemas/patient.schema.ts
import { Type, Static } from '@sinclair/typebox';

export const AddressSchema = Type.Object({
  street: Type.String({ minLength: 1 }),
  city: Type.String({ minLength: 1 }),
  province: Type.String({ minLength: 1 }),
  postalCode: Type.String({ pattern: '^[0-9]{5}$' })
});

export const CreatePatientSchema = Type.Object({
  firstName: Type.String({ minLength: 1, maxLength: 100 }),
  lastName: Type.String({ minLength: 1, maxLength: 100 }),
  dateOfBirth: Type.String({ format: 'date' }),
  phoneNumber: Type.String({ pattern: '^[0-9-+()\\s]+$' }),
  email: Type.Optional(Type.String({ format: 'email' })),
  address: AddressSchema
});

export const UpdatePatientSchema = Type.Partial(CreatePatientSchema);

export type CreatePatientDto = Static<typeof CreatePatientSchema>;
export type UpdatePatientDto = Static<typeof UpdatePatientSchema>;
```

### Step 3: สร้าง Feature Package

```bash
# สร้าง feature library
nx g @nx/node:lib patient \
  --directory=libs/features/business \
  --importPath=@aegisx/features-business-patient \
  --tags=scope:feature,type:business \
  --strict=true \
  --unitTestRunner=jest \
  --linter=eslint
```

#### Feature Package Structure

```text
libs/features/business/patient/
├── src/
│   ├── lib/
│   │   ├── routes/
│   │   │   └── patient.routes.ts
│   │   ├── handlers/
│   │   │   └── patient.handlers.ts
│   │   └── plugin.ts
│   └── index.ts
├── package.json
├── project.json
├── tsconfig.lib.json
└── tsconfig.spec.json
```

#### ตัวอย่างโค้ด Feature Package

**Fastify Plugin:**

```typescript
// libs/features/business/patient/src/lib/plugin.ts
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { container } from 'tsyringe';
import { PatientService } from '@aegisx/core-patient';
import { PatientRepositoryImpl } from './repositories/patient.repository.impl';
import { patientRoutes } from './routes/patient.routes';

export const patientPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Register dependencies
  container.register('PatientRepository', PatientRepositoryImpl);
  container.register('PatientService', PatientService);

  // Register routes
  await fastify.register(patientRoutes, { prefix: '/api/patients' });
};

export default patientPlugin;
```

**Routes Definition:**

```typescript
// libs/features/business/patient/src/lib/routes/patient.routes.ts
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { 
  CreatePatientSchema, 
  UpdatePatientSchema 
} from '@aegisx/core-patient';
import { PatientHandlers } from '../handlers/patient.handlers';

export const patientRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const handlers = new PatientHandlers();

  // GET /api/patients
  fastify.get('/', {
    schema: {
      summary: 'Get all patients',
      tags: ['patients'],
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: 'patient#' } },
            total: { type: 'number' }
          }
        }
      }
    }
  }, handlers.getAllPatients);

  // GET /api/patients/:id
  fastify.get('/:id', {
    schema: {
      summary: 'Get patient by ID',
      tags: ['patients'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        200: { $ref: 'patient#' },
        404: { $ref: 'error#' }
      }
    }
  }, handlers.getPatientById);

  // POST /api/patients
  fastify.post('/', {
    schema: {
      summary: 'Create new patient',
      tags: ['patients'],
      body: CreatePatientSchema,
      response: {
        201: { $ref: 'patient#' },
        400: { $ref: 'error#' }
      }
    }
  }, handlers.createPatient);

  // PUT /api/patients/:id
  fastify.put('/:id', {
    schema: {
      summary: 'Update patient',
      tags: ['patients'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      body: UpdatePatientSchema,
      response: {
        200: { $ref: 'patient#' },
        404: { $ref: 'error#' }
      }
    }
  }, handlers.updatePatient);

  // DELETE /api/patients/:id
  fastify.delete('/:id', {
    schema: {
      summary: 'Delete patient',
      tags: ['patients'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        204: { type: 'null' },
        404: { $ref: 'error#' }
      }
    }
  }, handlers.deletePatient);
};
```

**Route Handlers:**

```typescript
// libs/features/business/patient/src/lib/handlers/patient.handlers.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { container } from 'tsyringe';
import { PatientService, CreatePatientDto, UpdatePatientDto } from '@aegisx/core-patient';

export class PatientHandlers {
  async getAllPatients(
    request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
    reply: FastifyReply
  ) {
    try {
      const patientService = container.resolve<PatientService>('PatientService');
      const { page = 1, limit = 10 } = request.query;
      
      const patients = await patientService.getAllPatients({ page, limit });
      
      return reply.code(200).send({
        data: patients.data,
        total: patients.total,
        page,
        limit
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }

  async getPatientById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const patientService = container.resolve<PatientService>('PatientService');
      const { id } = request.params;
      
      const patient = await patientService.getPatientById(id);
      
      if (!patient) {
        return reply.code(404).send({ error: 'Patient not found' });
      }
      
      return reply.code(200).send(patient);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }

  async createPatient(
    request: FastifyRequest<{ Body: CreatePatientDto }>,
    reply: FastifyReply
  ) {
    try {
      const patientService = container.resolve<PatientService>('PatientService');
      const patientData = request.body;
      
      const patient = await patientService.createPatient(patientData);
      
      return reply.code(201).send(patient);
    } catch (error) {
      request.log.error(error);
      
      if (error.message.includes('validation')) {
        return reply.code(400).send({ error: error.message });
      }
      
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }

  async updatePatient(
    request: FastifyRequest<{ 
      Params: { id: string }; 
      Body: UpdatePatientDto 
    }>,
    reply: FastifyReply
  ) {
    try {
      const patientService = container.resolve<PatientService>('PatientService');
      const { id } = request.params;
      const updateData = request.body;
      
      const patient = await patientService.updatePatient(id, updateData);
      
      return reply.code(200).send(patient);
    } catch (error) {
      request.log.error(error);
      
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: 'Patient not found' });
      }
      
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }

  async deletePatient(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const patientService = container.resolve<PatientService>('PatientService');
      const { id } = request.params;
      
      await patientService.deletePatient(id);
      
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error);
      
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: 'Patient not found' });
      }
      
      return reply.code(500).send({ error: 'Internal server error' });
    }
  }
}
```

### Step 4: เพิ่ม Dependencies

**อัปเดต tsconfig.base.json:**

```json
{
  "paths": {
    "@aegisx/core-patient": ["libs/core/patient/src/index.ts"],
    "@aegisx/features-business-patient": ["libs/features/business/patient/src/index.ts"]
  }
}
```

**อัปเดต Feature Package dependencies:**

```json
// libs/features/business/patient/project.json
{
  "implicitDependencies": ["@aegisx/core-patient"]
}
```

### Step 5: Register ใน Main Application

```typescript
// apps/api/src/main.ts
import patientPlugin from '@aegisx/features-business-patient';

async function bootstrap() {
  const app = Fastify({
    logger: true
  });

  // Register business features
  await app.register(patientPlugin);

  await app.listen({ 
    port: process.env.PORT || 3000,
    host: '0.0.0.0'
  });
}

bootstrap();
```

## 🧪 Testing Strategy

### Unit Tests สำหรับ Core Package

```typescript
// libs/core/patient/src/lib/services/patient.service.spec.ts
import { PatientService } from './patient.service';
import { PatientRepository } from '../repositories/patient.repository';

describe('PatientService', () => {
  let service: PatientService;
  let mockRepository: jest.Mocked<PatientRepository>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    service = new PatientService(mockRepository);
  });

  it('should create a patient successfully', async () => {
    const patientData = {
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      phoneNumber: '081-234-5678',
      address: {
        street: '123 Main St',
        city: 'Bangkok',
        province: 'Bangkok',
        postalCode: '10110'
      }
    };

    const expectedPatient = { id: '1', ...patientData };
    mockRepository.create.mockResolvedValue(expectedPatient as any);

    const result = await service.createPatient(patientData);

    expect(result).toEqual(expectedPatient);
    expect(mockRepository.create).toHaveBeenCalledWith(patientData);
  });
});
```

### Integration Tests สำหรับ Feature Package

```typescript
// libs/features/business/patient/src/lib/patient.plugin.spec.ts
import Fastify from 'fastify';
import { patientPlugin } from './plugin';

describe('Patient Plugin', () => {
  let app: any;

  beforeEach(async () => {
    app = Fastify();
    await app.register(patientPlugin);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should create a patient via POST /api/patients', async () => {
    const patientData = {
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      phoneNumber: '081-234-5678',
      address: {
        street: '123 Main St',
        city: 'Bangkok',
        province: 'Bangkok',
        postalCode: '10110'
      }
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/patients',
      payload: patientData
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.payload)).toMatchObject({
      firstName: 'John',
      lastName: 'Doe'
    });
  });
});
```

## 🚀 Best Practices

### 1. Error Handling

```typescript
// Create custom error classes
export class PatientNotFoundError extends Error {
  constructor(id: string) {
    super(`Patient with id ${id} not found`);
    this.name = 'PatientNotFoundError';
  }
}

export class PatientValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatientValidationError';
  }
}
```

### 2. Logging

```typescript
// Use structured logging
async createPatient(data: CreatePatientDto): Promise<Patient> {
  this.logger.info('Creating patient', { 
    operation: 'createPatient',
    firstName: data.firstName,
    lastName: data.lastName 
  });

  try {
    const patient = await this.patientRepository.create(data);
    
    this.logger.info('Patient created successfully', {
      operation: 'createPatient',
      patientId: patient.id
    });
    
    return patient;
  } catch (error) {
    this.logger.error('Failed to create patient', {
      operation: 'createPatient',
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
```

### 3. Validation

```typescript
// Validate at boundary (HTTP layer)
fastify.post('/patients', {
  schema: {
    body: CreatePatientSchema
  },
  preValidation: async (request, reply) => {
    // Additional business validation
    const { dateOfBirth } = request.body;
    
    if (new Date(dateOfBirth) > new Date()) {
      throw new Error('Date of birth cannot be in the future');
    }
  }
}, handlers.createPatient);
```

### 4. Security

```typescript
// Add authentication/authorization
fastify.addHook('preHandler', async (request, reply) => {
  // Verify JWT token
  await request.jwtVerify();
  
  // Check permissions
  const hasPermission = await rbacService.hasPermission(
    request.user.id, 
    'patient:create'
  );
  
  if (!hasPermission) {
    throw new Error('Insufficient permissions');
  }
});
```

## 📚 อ้างอิง

- [Fastify Documentation](https://fastify.dev/)
- [TypeBox Documentation](https://github.com/sinclairzx81/typebox)
- [tsyringe Documentation](https://github.com/microsoft/tsyringe)
- [Nx Node.js Guide](https://nx.dev/getting-started/tutorials/node-server-tutorial)
