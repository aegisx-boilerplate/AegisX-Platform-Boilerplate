
# 🚀 AegisX Platform Boilerplate

---

## 🎯 Purpose & Scope

AegisX Platform Boilerplate is designed as a blueprint for building secure, scalable, and maintainable enterprise-grade API platforms. It provides a modular monorepo structure, pre-configured integrations, and best practices for rapid project bootstrapping. This blueprint is intended for teams who want a strong foundation for modern web applications, with flexibility for customization and extension.

- **Purpose:** To accelerate the development of enterprise platforms with a proven, production-ready architecture.
- **Scope:** Covers backend API, frontend (optional), authentication, storage, messaging, CI/CD, and infrastructure setup.

---

## 🛠️ Customization Guide

Before using this boilerplate in a real project, review and customize the following:

- **Project Name & Branding:** Update names, logos, and references throughout the codebase and documentation.
- **Environment Variables:** Change all secrets, passwords, and salts in `.env` and Docker configs.
- **Authentication Providers:** Configure OAuth, API keys, and RBAC as needed for your organization.
- **Feature Modules:** Add, remove, or modify modules in `libs/modules/` to fit your business requirements.
- **CI/CD Pipeline:** Adjust GitHub Actions and deployment scripts for your environment.
- **Documentation:** Update internal links and add project-specific guides in `docs/`.

---

## ✅ Project Initialization Checklist

Before starting development, ensure you have completed the following:

- [ ] Fork or clone this repository
- [ ] Update project name, secrets, and branding
- [ ] Copy and configure `.env` file
- [ ] Start Docker infrastructure (`docker-compose up -d`)
- [ ] Run database migrations and seeds
- [ ] Review and update documentation in `docs/`
- [ ] Set up repository permissions and CI/CD secrets
- [ ] Test local development environment (`nx serve api`)

---

## 💡 Best Practices & Gotchas

- **Strict Typing:** Always use TypeScript strict mode for all new code.
- **Secrets Management:** Never commit real secrets or credentials to version control.
- **Modularization:** Keep business logic in feature modules, not in the app entrypoints.
- **Testing:** Write unit and integration tests for all new features.
- **Documentation:** Keep `README.md` and `docs/` up to date as the project evolves.
- **Error Handling:** Use centralized error handling and logging for all services.
- **Environment Parity:** Keep local, staging, and production environments as similar as possible.

---

## � Quick Start & Development Roadmap

### ⚡ MVP Development Strategy (Ready to Start)

**สำหรับการเริ่มต้นโปรเจ็กต์ใหม่:** ใช้ [**MVP Development Roadmap**](docs/mvp-development-roadmap.md) เป็นแนวทางหลัก

- 📅 **8-Week Development Plan** - จาก foundation ถึง production deployment
- 🎯 **Phase-by-Phase Implementation** - แบ่งเป็นขั้นตอนชัดเจน พร้อม checklist
- 💡 **Smart MVP Principles** - Single-tenant first, manual before automation
- ✅ **Quality Gates** - Checkpoint แต่ละสัปดาห์เพื่อความมั่นใจ
- 🔧 **Real Code Examples** - พร้อม command line และ implementation
- 📊 **Success Metrics** - KPIs และวิธีการวัดผล

**เหมาะสำหรับ:** Startup, Enterprise, Individual developers ที่ต้องการสร้าง production-ready platform

### 🎯 การเริ่มต้นแบบ Quick Start

```bash
# 1. สร้างโปรเจ็กต์ใหม่ตาม MVP Roadmap
npx create-nx-workspace@21 my-platform --preset=ts --packageManager=pnpm

# 2. ใช้ blueprint ที่มีอยู่เป็น implementation guide
# 3. Follow checklist ใน mvp-development-roadmap.md ทีละสัปดาห์
```

---

## �🔗 Internal Documentation Links

- [Authentication Guide](docs/authentication.md) - JWT, RBAC, API Keys, MFA
- [API Architecture](docs/architecture.md) - System design and patterns
- [Multi-Tenancy Implementation](docs/multi-tenancy.md) - Tenant isolation and management
- [WebSocket Real-time Features](docs/websocket.md) - Real-time communication setup
- [Webhook Integration](docs/webhook.md) - External system integration
- [Webhook vs Message Queue](docs/webhook-vs-messagequeue.md) - Comparison and implementation guide
- [Strapi-Style Webhook Guide](docs/strapi-style-webhook.md) - CMS-style lifecycle webhooks
- [DevOps & Deployment](docs/devops.md) - CI/CD and infrastructure
- [Storage & Object Management](docs/storage.md) - File handling with MinIO
- [FAQ](docs/faq.md) - Common questions and troubleshooting

---

## 📋 Feature Implementation Blueprints

**🎯 สำหรับการพัฒนา MVP**: ใช้ [MVP Development Roadmap](docs/mvp-development-roadmap.md) เป็นแนวทางหลัก แล้วใช้ blueprint ด้านล่างเป็น implementation reference

Comprehensive step-by-step implementation guides for each major platform feature:

### 🚀 Strategic Development Guides

- [**MVP Development Roadmap**](docs/mvp-development-roadmap.md) - **เอกสารหลักสำหรับการเริ่มต้น** 8-week development plan พร้อม phase-by-phase implementation
- [Nx CRUD Generator Blueprint](docs/nx-crud-generator-blueprint.md) - Automated code generation for faster development
- [Angular TailwindCSS Templates](docs/nx-angular-tailwind-templates.md) - Beautiful, responsive UI components

### Core Features

- [Multi-Tenancy Feature Blueprint](docs/multi-tenancy-feature-blueprint.md) - Complete multi-tenant architecture implementation
- [Authentication Feature Blueprint](docs/authentication-feature-blueprint.md) - JWT, RBAC, MFA, and API Key authentication
- [WebSocket Feature Blueprint](docs/websocket-feature-blueprint.md) - Real-time communication and event streaming
- [Storage Feature Blueprint](docs/storage-feature-blueprint.md) - File upload, processing, and CDN integration
- [API Architecture Blueprint](docs/api-architecture-blueprint.md) - REST/GraphQL APIs with versioning and documentation
- [Webhook Feature Blueprint](docs/webhook-feature-blueprint.md) - External integrations and event webhooks
- [DevOps & CI/CD Blueprint](docs/devops-cicd-feature-blueprint.md) - Docker, Kubernetes, monitoring, and automation

### Essential Platform Features

- [Notification System Blueprint](docs/notification-system-blueprint.md) - Multi-channel notifications (email, SMS, push, in-app)
- [Configuration Management Blueprint](docs/configuration-management-blueprint.md) - Dynamic settings and feature flags

### Architecture & Code Quality

- [Dependency Injection Blueprint](docs/dependency-injection-blueprint.md) - Clean DI with TSyringe for testable, maintainable code

### Database & Implementation Guides

- [Knex.js CRUD Blueprint (Single-Tenant)](docs/knex-crud-blueprint.md) - Simple CRUD operations without multi-tenancy complexity
- [Knex.js Multi-Tenancy Blueprint](docs/knex-multi-tenancy-blueprint.md) - Complete Knex.js multi-tenant implementation with CRUD patterns
- [Knex.js Multi-Tenancy Quick Start](docs/knex-multi-tenancy-quickstart.md) - 5-minute setup guide with practical examples

### 💻 Code Examples

Working TypeScript examples สำหรับทุก feature ใน [`docs/examples/`](docs/examples/):
- [dependency-injection-example.ts](docs/examples/dependency-injection-example.ts) - Complete DI setup with TSyringe
- [knex-multi-tenancy-example.ts](docs/examples/knex-multi-tenancy-example.ts) - Multi-tenant CRUD operations
- [knex-crud-example.ts](docs/examples/knex-crud-example.ts) - Standard CRUD patterns
- [knex-simple-crud-example.ts](docs/examples/knex-simple-crud-example.ts) - Basic single-entity CRUD

Each blueprint includes:

- ✅ **Architecture Overview** - System design and component interactions
- ⚡ **Implementation Steps** - Code examples and configuration
- 🧪 **Testing Strategy** - Unit, integration, and e2e tests
- 🔒 **Security Considerations** - Best practices and vulnerability mitigation
- 📊 **Monitoring & Observability** - Metrics, logging, and alerting
- 🚀 **Performance Optimization** - Scaling and optimization techniques
- 🛠️ **Troubleshooting Guide** - Common issues and debugging

---

## 🎯 How to Use This Boilerplate

### For New Projects (Recommended)

1. **Start with MVP Strategy**: Follow the [MVP Development Roadmap](docs/mvp-development-roadmap.md) for systematic 8-week development
2. **Choose Your Approach**:
   - **Startup/MVP**: Single-tenant first → Multi-tenant later
   - **Enterprise**: Multi-tenant from start
   - **Learning**: Pick one feature blueprint and implement step-by-step

### For Existing Projects

1. **Pick Individual Features**: Use specific blueprints as implementation guides
2. **Copy Code Examples**: Use TypeScript examples in `docs/examples/` as starting points
3. **Adapt Architecture**: Modify patterns to fit your existing codebase

### For Learning & Reference

1. **Study Architecture**: Each blueprint explains design decisions and trade-offs
2. **Run Examples**: All code examples are ready-to-run with minimal setup
3. **Compare Patterns**: See different approaches for similar problems

---

## 🛠️ Technology Stack

### Core Framework

| Layer          | Technology                       | Version  |
|----------------|----------------------------------|----------|
| Build System   | Nx Monorepo                      | v21      |
| API Framework  | Fastify                          | v5       |
| Language       | TypeScript                       | 5.x      |
| Frontend       | Angular (optional)               | v20      |

### Database & Storage

| Component      | Technology                       | Purpose  |
|----------------|----------------------------------|----------|
| Primary DB     | PostgreSQL                       | 15+      |
| Query Builder  | Knex.js                          | Latest   |
| Cache          | Redis                            | 7+       |
| Message Queue  | RabbitMQ                         | 3.12+    |
| Object Storage | MinIO                            | Latest   |

### Development & DevOps

| Tool           | Technology                       | Purpose  |
|----------------|----------------------------------|----------|
| Testing        | Jest                             | Unit/Integration |
| Linting        | ESLint + Prettier               | Code Quality |
| Auth           | JWT + RBAC + API Key             | Security |
| Documentation  | OpenAPI (Swagger)                | API Docs |
| CI/CD          | GitHub Actions                   | Automation |
| Container      | Docker + Docker Compose          | Development |

---

## 🏗️ Architecture & Structure

### Nx v21 Monorepo Layout

```txt
apps/
├── api/                    # Fastify v5 API server
├── worker/                 # RabbitMQ background workers
├── web/                    # Angular v20 web application
└── admin/                  # Admin dashboard (Angular v20)

libs/
├── core/
│   ├── config/            # Environment & configuration
│   ├── database/          # Knex.js client & transactions
│   ├── logger/            # Pino structured logging
│   ├── security/          # JWT, hashing, validation
│   ├── cache/             # Redis client & helpers
│   ├── storage/           # MinIO S3-compatible storage
│   └── queue/             # RabbitMQ wrapper
├── plugins/
│   ├── fastify-auth/      # JWT authentication plugin
│   ├── fastify-rbac/      # Role-based access control plugin
│   ├── fastify-api-key/   # API key authentication
│   ├── fastify-rate-limit/ # Redis-backed rate limiting
│   └── fastify-security/  # Security headers & validation
├── modules/
│   ├── auth/              # Authentication & authorization (includes RBAC)
│   ├── user/              # User management system
│   ├── tenant/            # Multi-tenancy support
│   ├── notification/      # Multi-channel notification system
│   ├── config/            # Configuration management & feature flags
│   ├── audit/             # Audit logging & compliance
│   └── analytics/         # Event tracking & metrics
└── shared/
    ├── interfaces/        # TypeScript interfaces
    ├── dto/               # Data transfer objects
    ├── constants/         # Application constants
    └── utils/             # Common utilities

tools/
├── scripts/               # Database migrations & seeds
├── generators/            # Custom Nx generators
└── docker/                # Docker configurations
```

---

## ✨ Core Features

### Authentication & Security

- JWT access & refresh token system
- Role-Based Access Control (RBAC)
- API Key support for external clients
- Redis-based rate limiting with sliding window
- Helmet.js for secure HTTP headers
- Advanced password hashing (argon2)
- Multi-factor authentication (MFA)
- OAuth 2.0 & OpenID Connect integration
- Secure file upload & storage with MinIO

### Multi-Tenancy & Configuration

- Complete tenant isolation (schema-per-tenant or shared schema)
- Tenant-aware database queries and storage
- Dynamic configuration management with feature flags
- Environment-specific settings and runtime configuration
- Tenant-specific customizations and white-labeling

### Communication & Notifications

- Real-time WebSocket communication
- Multi-channel notification system (email, SMS, push, in-app)
- Event-driven webhook integrations
- Template-based messaging with personalization
- Delivery tracking and notification preferences

### Storage & Media

- S3-compatible object storage with MinIO
- Secure file upload with virus scanning
- Image processing and optimization
- CDN integration for fast content delivery
- Backup and recovery systems

### Audit & Analytics

- Comprehensive audit logging of all actions
- Event-driven architecture via RabbitMQ
- Real-time analytics & monitoring
- Compliance-ready audit trails
- Performance metrics collection
- Custom event tracking system

### Developer Experience

- Full TypeScript support with strict typing
- Modular Nx v21 workspace architecture
- Comprehensive Jest testing with coverage
- Auto-generated OpenAPI (Swagger) documentation
- GitHub Actions CI/CD pipeline
- Dockerized development environment
- Hot reload & fast builds
- Code generation with Nx generators

---

## 🎯 Optional Features (Not Recommended for MVP)

The following features are powerful but add significant complexity. Consider implementing them only after your core platform is stable and proven:

### Advanced Analytics & Reporting

- Complex data visualization dashboards
- Custom report builders
- Advanced analytics with ML/AI
- Business intelligence integrations
- Data warehousing and ETL processes

### Advanced Communication Features

- Real-time chat and messaging systems
- Video/audio calling integration
- Advanced workflow automation
- Complex notification rules engines
- Social features and user interactions

### Enterprise Integrations

- Advanced webhook orchestration
- Complex third-party API integrations
- Legacy system connectors
- Advanced SSO providers (SAML, LDAP)
- Enterprise directory synchronization

### Performance & Scaling

- Advanced caching strategies (Redis Cluster)
- Database sharding and partitioning
- Microservices architecture
- Advanced load balancing
- Edge computing and CDN optimization

**Recommendation:** Start with the core features above, validate your product-market fit, then gradually add these optional features based on actual user needs and feedback.

---

## 🗺️ Feature Implementation Roadmap

### Phase 1: MVP Core (Week 1-4)

1. **Authentication & Security** - JWT, RBAC, basic API keys
2. **API Architecture** - REST APIs with basic error handling
3. **Database & Storage** - PostgreSQL setup with basic file storage
4. **Basic Multi-Tenancy** - Shared schema with tenant isolation

### Phase 2: Essential Features (Week 5-8)

1. **Configuration Management** - Dynamic settings and feature flags
2. **Notification System** - Email notifications and basic templates
3. **WebSocket Real-time** - Basic real-time communication
4. **Audit Logging** - Comprehensive activity tracking

### Phase 3: Production Ready (Week 9-12)

1. **Advanced Authentication** - MFA, OAuth, API key management
2. **Enhanced Storage** - Image processing, CDN integration
3. **Webhook System** - External integrations and event delivery
4. **DevOps & Monitoring** - CI/CD, Docker, basic monitoring

### Phase 4: Scale & Optimize (Week 13+)

1. **Advanced Multi-Tenancy** - Schema-per-tenant options
2. **Enhanced Notifications** - SMS, push, in-app notifications
3. **Advanced Analytics** - Custom metrics and reporting
4. **Performance Optimization** - Caching, rate limiting, scaling

---

## 🚀 Quick Start Guide

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** 8+ (package manager)
- **Docker** & **Docker Compose** (for local development)
- **Git** (version control)

### 1. Create Nx v21 Workspace

```bash
# Create new workspace with TypeScript preset
npx create-nx-workspace@21 aegisx-platform --preset=ts --packageManager=pnpm --nxCloud=skip

# Navigate to project
cd aegisx-platform
```

### 2. Install Core Dependencies

```bash
# Fastify v5 & core packages
pnpm add fastify@5 @fastify/cors @fastify/helmet @fastify/jwt @fastify/rate-limit
pnpm add knex pg redis ioredis amqplib
pnpm add minio @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
pnpm add pino pino-pretty bcryptjs argon2 joi

# Development dependencies
pnpm add -D @types/node @types/pg @types/bcryptjs
pnpm add -D typescript ts-node nodemon
```

### 3. Generate Applications & Libraries

```bash
# Generate main API application
nx g @nx/node:application api --framework=fastify

# Generate Angular v20 web application (optional)
nx g @angular/core:application web --routing --style=scss

# Generate core libraries
nx g @nx/js:library core-config --directory=libs/core
nx g @nx/js:library core-database --directory=libs/core
nx g @nx/js:library core-logger --directory=libs/core
nx g @nx/js:library core-storage --directory=libs/core

# Generate feature modules
nx g @nx/js:library auth --directory=libs/modules  # Includes RBAC
nx g @nx/js:library user --directory=libs/modules
nx g @nx/js:library tenant --directory=libs/modules
nx g @nx/js:library notification --directory=libs/modules
nx g @nx/js:library config --directory=libs/modules
```

### 4. Setup Local Environment

```bash
# Copy environment configuration
cp .env.example .env

# Start infrastructure services
docker-compose up -d postgres redis rabbitmq minio

# Run database migrations
nx run api:migrate

# Seed initial data
nx run api:seed
```

### 5. Start Development

```bash
# Start API server (http://localhost:3000)
nx serve api

# Start web application (http://localhost:4200) - if created
nx serve web

# View project graph
nx graph
```

---

## � Docker Development Environment

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: aegisx-postgres
    environment:
      POSTGRES_DB: aegisx_platform
      POSTGRES_USER: aegisx
      POSTGRES_PASSWORD: SecurePassword123!
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./tools/docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aegisx"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: aegisx-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --requirepass RedisPassword123!
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    container_name: aegisx-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: aegisx
      RABBITMQ_DEFAULT_PASS: RabbitPassword123!
      RABBITMQ_DEFAULT_VHOST: aegisx_platform
    ports:
      - "5672:5672"    # AMQP port
      - "15672:15672"  # Management UI
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  minio:
    image: minio/minio:latest
    container_name: aegisx-minio
    environment:
      MINIO_ROOT_USER: aegisx
      MINIO_ROOT_PASSWORD: MinioPassword123!
      MINIO_DOMAIN: localhost
    ports:
      - "9000:9000"    # API port
      - "9001:9001"    # Console port
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
  minio_data:
```

### Environment Configuration

```bash
# .env
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://aegisx:SecurePassword123!@localhost:5432/aegisx_platform
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis
REDIS_URL=redis://:RedisPassword123!@localhost:6379
REDIS_TTL=3600

# RabbitMQ
RABBITMQ_URL=amqp://aegisx:RabbitPassword123!@localhost:5672/aegisx_platform

# MinIO Object Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=aegisx
MINIO_SECRET_KEY=MinioPassword123!
MINIO_USE_SSL=false
MINIO_BUCKET=aegisx-storage

# JWT
JWT_SECRET=your-super-secret-jwt-key-256-bits-long
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# API Keys
API_KEY_SALT=your-api-key-salt

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000  # 15 minutes

# Logging
LOG_LEVEL=info
LOG_PRETTY=true
```

---

## 🛠️ Development Commands

### Core Development

| Command                    | Description                          |
|----------------------------|--------------------------------------|
| `nx serve api`             | Start Fastify API server (dev mode) |
| `nx serve web`             | Start Angular web app (dev mode)    |
| `nx build api`             | Build API for production            |
| `nx build web`             | Build web app for production        |

### Testing & Quality

| Command                    | Description                          |
|----------------------------|--------------------------------------|
| `nx test api`              | Run API unit tests                   |
| `nx test web`              | Run web app tests                    |
| `nx e2e api-e2e`           | Run API integration tests           |
| `nx affected:test`         | Test only affected projects         |
| `nx lint api`              | Lint API code                       |
| `nx format:check`          | Check code formatting               |

### Database & Infrastructure

| Command                    | Description                          |
|----------------------------|--------------------------------------|
| `nx run api:migrate`       | Run database migrations             |
| `nx run api:migrate:rollback` | Rollback last migration          |
| `nx run api:seed`          | Seed database with sample data      |
| `nx run api:db:reset`      | Reset database (dev only)           |

### Monorepo Management

| Command                    | Description                          |
|----------------------------|--------------------------------------|
| `nx graph`                 | View project dependency graph       |
| `nx affected:build`        | Build only affected projects        |
| `nx dep-graph`             | Interactive dependency graph        |
| `nx workspace-generator`   | Run custom workspace generators     |

---

## 🧪 Testing Strategy

### Unit Testing with Jest

- **Business Logic**: Core services and utilities
- **Database Layer**: Repository patterns and queries
- **Authentication**: JWT handling and security
- **Validation**: Input validation and sanitization

### Integration Testing

- **API Endpoints**: Full request/response cycles
- **Database Operations**: Real database interactions
- **External Services**: Redis, RabbitMQ integration
- **Authentication Flow**: Complete auth workflows

### E2E Testing

- **User Journeys**: Complete user workflows
- **API Contracts**: OpenAPI specification compliance
- **Performance**: Load testing and benchmarks
- **Security**: Penetration testing scenarios

---

## � Production Deployment

### GitHub Actions CI/CD

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: nx affected:lint
      - run: nx affected:test
      - run: nx affected:build
```

### Docker Production Setup

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN nx build api --prod

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
COPY --from=builder /app/dist/apps/api ./
COPY --from=builder /app/node_modules ./node_modules
USER nestjs
EXPOSE 3000
CMD ["node", "main.js"]
```

---

## 📚 Documentation & Resources

### API Documentation

- **OpenAPI/Swagger**: Auto-generated API documentation
- **Postman Collection**: Ready-to-use API testing collection
- **TypeScript Types**: Comprehensive type definitions
- **Code Examples**: Sample implementation guides

---

## 🎉 Ready to Build Your Platform?

### 🚀 Quick Decision Guide

**If you're starting a new project:**
- 👉 **Go to [MVP Development Roadmap](docs/mvp-development-roadmap.md)** - Complete 8-week development plan
- ⚡ Start with single-tenant MVP → Scale to multi-tenant later
- 🎯 Focus on core user value first

**If you're adding features to existing project:**
- 🔍 Browse [Feature Implementation Blueprints](#-feature-implementation-blueprints)
- 💻 Copy code from [`docs/examples/`](docs/examples/)
- 📖 Follow step-by-step implementation guides

**If you're learning or evaluating:**
- 📚 Start with [Architecture Overview](docs/architecture.md)
- 🧪 Try code examples in [`docs/examples/`](docs/examples/)
- 🎨 Compare different architectural patterns

### 💡 Success Tips

- ✅ **Start Simple**: Single-tenant → Multi-tenant → Advanced features
- ✅ **Ship Fast**: MVP in 8 weeks → Iterate based on feedback  
- ✅ **Follow Patterns**: Use blueprints as implementation guides
- ✅ **Test Everything**: 80%+ test coverage for production confidence
- ✅ **Monitor Always**: Implement observability from day one

---

## 📚 Documentation & Resources

### API Documentation

- **OpenAPI/Swagger**: Auto-generated API documentation
- **Postman Collection**: Ready-to-use API testing collection
- **TypeScript Types**: Comprehensive type definitions
- **Code Examples**: Sample implementation guides

### Learning Resources

- [Nx Documentation](https://nx.dev/getting-started)
- [Fastify v5 Guide](https://fastify.dev/docs/latest/)
- [Angular v20 Documentation](https://angular.dev/)
- [PostgreSQL Best Practices](https://www.postgresql.org/docs/)

---

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following coding standards
4. Write/update tests for your changes
5. Run quality checks (`nx affected:lint && nx affected:test`)
6. Commit changes (`git commit -m 'feat: add amazing feature'`)
7. Push to branch (`git push origin feature/amazing-feature`)
8. Create Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration with custom rules
- **Prettier**: Consistent code formatting
- **Commit Convention**: Conventional Commits specification

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support & Community

- 📧 **Email**: [support@aegisx.dev](mailto:support@aegisx.dev)
- 💬 **Discord**: [AegisX Community](https://discord.gg/aegisx)
- 📖 **Documentation**: [docs.aegisx.dev](https://docs.aegisx.dev)
- 🐛 **Issues**: [GitHub Issues](https://github.com/aegisx/platform-boilerplate/issues)
- 💡 **Discussions**: [GitHub Discussions](https://github.com/aegisx/platform-boilerplate/discussions)

---

Built with ❤️ by the AegisX Team - Enterprise-grade solutions for modern applications

# NX 

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/js?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Generate a library

```sh
npx nx g @nx/js:lib packages/pkg1 --publishable --importPath=@my-org/pkg1
```

## Run tasks

To build the library use:

```sh
npx nx build pkg1
```

To run any task with Nx use:

```sh
npx nx <target> <project-name>
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Versioning and releasing

To version and release the library use

```
npx nx release
```

Pass `--dry-run` to see what would happen without actually releasing the library.

[Learn more about Nx release &raquo;](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Keep TypeScript project references up to date

Nx automatically updates TypeScript [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) in `tsconfig.json` files to ensure they remain accurate based on your project dependencies (`import` or `require` statements). This sync is automatically done when running tasks such as `build` or `typecheck`, which require updated references to function correctly.

To manually trigger the process to sync the project graph dependencies information to the TypeScript project references, run the following command:

```sh
npx nx sync
```

You can enforce that the TypeScript project references are always in the correct state when running in CI by adding a step to your CI job configuration that runs the following command:

```sh
npx nx sync:check
```

[Learn more about nx sync](https://nx.dev/reference/nx-commands#sync)

## Set up CI!

### Step 1

To connect to Nx Cloud, run the following command:

```sh
npx nx connect
```

Connecting to Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Step 2

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/js?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:
- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
