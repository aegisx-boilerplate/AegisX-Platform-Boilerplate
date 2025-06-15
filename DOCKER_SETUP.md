# AegisX Platform - Docker Development Environment

คู่มือสำหรับการตั้งค่า Development Environment ด้วย Docker Compose

## 📋 Services ที่รวมอยู่

- **PostgreSQL 16**: Database หลักของระบบ
- **Redis 7**: Cache และ Session Storage  
- **RabbitMQ 3**: Message Queue พร้อม Management UI
- **MinIO**: Object Storage (S3-compatible)
- **pgAdmin 4**: PostgreSQL Management Tool

## 🚀 Quick Start

### 1. Start Services

```bash
# ใช้ script ที่เตรียมไว้
chmod +x scripts/dev-services.sh
./scripts/dev-services.sh start

# หรือใช้ docker-compose โดยตรง
docker-compose up -d
```

### 2. ตรวจสอบสถานะ Services

```bash
./scripts/dev-services.sh status
```

### 3. ทดสอบการเชื่อมต่อ Database

```bash
./scripts/dev-services.sh test-db
```

## 🔧 Service Details

### PostgreSQL
- **Port**: 5432
- **Database**: `aegisx_db`
- **Username**: `postgres` 
- **Password**: `password`
- **Connection URL**: `postgresql://postgres:password@localhost:5432/aegisx_db`

### Redis
- **Port**: 6379
- **Password**: ไม่มี (development only)
- **Connection URL**: `redis://localhost:6379`

### RabbitMQ
- **AMQP Port**: 5672
- **Management UI**: http://localhost:15672
- **Username**: `admin`
- **Password**: `password`
- **Virtual Host**: `aegisx`
- **Connection URL**: `amqp://admin:password@localhost:5672/aegisx`

### MinIO Object Storage
- **API Port**: 9000
- **Console**: http://localhost:9001
- **Access Key**: `admin`
- **Secret Key**: `password123`
- **Endpoint**: `http://localhost:9000`

### pgAdmin
- **URL**: http://localhost:5050
- **Email**: `admin@aegisx.local`
- **Password**: `password`

## 📁 Database Initialization

Database จะถูก initialize อัตโนมัติด้วย script ใน `database/init/01-init.sql` ซึ่งจะ:

- สร้าง PostgreSQL Extensions ที่จำเป็น
- สร้าง Schemas สำหรับแต่ละ Feature Module
- สร้าง Table สำหรับ Health Check
- ตั้งค่า Permissions

## 🛠️ Management Commands

```bash
# เริ่ม services ทั้งหมด
./scripts/dev-services.sh start

# หยุด services ทั้งหมด  
./scripts/dev-services.sh stop

# Restart services ทั้งหมด
./scripts/dev-services.sh restart

# ดู status ของ services
./scripts/dev-services.sh status

# ดู logs ของ services ทั้งหมด
./scripts/dev-services.sh logs

# ดู logs ของ service เฉพาะ
./scripts/dev-services.sh logs postgres
./scripts/dev-services.sh logs redis

# ทดสอบการเชื่อมต่อ database
./scripts/dev-services.sh test-db

# Setup MinIO buckets
./scripts/dev-services.sh setup

# ลบ containers และ volumes ทั้งหมด (ระวัง!)
./scripts/dev-services.sh clean
```

## 📝 Environment Variables

คุณควรสร้างไฟล์ `.env.development` เพื่อตั้งค่า environment variables:

```bash
# คัดลอก template
cp .env.development.template .env.development

# แก้ไขค่าตามต้องการ
nano .env.development
```

### ตัวอย่าง Environment Variables สำคัญ:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/aegisx_db

# Redis  
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://admin:password@localhost:5672/aegisx

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password123
```

## 🔍 Troubleshooting

### Services ไม่สามารถ Start ได้

1. ตรวจสอบว่า Docker ทำงานอยู่:
   ```bash
   docker info
   ```

2. ตรวจสอบ Port conflicts:
   ```bash
   lsof -i :5432  # PostgreSQL
   lsof -i :6379  # Redis
   lsof -i :5672  # RabbitMQ
   ```

3. ลบ containers เก่าและเริ่มใหม่:
   ```bash
   ./scripts/dev-services.sh clean
   ./scripts/dev-services.sh start
   ```

### Database Connection ล้มเหลว

1. ตรวจสอบว่า PostgreSQL container ทำงานอยู่:
   ```bash
   docker ps | grep postgres
   ```

2. ตรวจสอบ logs:
   ```bash
   ./scripts/dev-services.sh logs postgres
   ```

3. ทดสอบการเชื่อมต่อ:
   ```bash
   ./scripts/dev-services.sh test-db
   ```

### Performance Issues

1. เพิ่ม Memory สำหรับ Docker
2. ปรับ Connection Pool Settings ใน Database Configuration
3. ตรวจสอบ Disk Space

## 🚨 Security Notes

⚠️ **สำคัญ**: Configuration นี้เหมาะสำหรับ Development เท่านั้น!

สำหรับ Production:
- เปลี่ยน passwords ทั้งหมด
- ใช้ strong secrets สำหรับ JWT
- ตั้งค่า SSL/TLS
- จำกัด network access
- ใช้ environment-specific configuration

## 📖 Next Steps

หลังจาก Services ทำงานแล้ว:

1. Start API Server:
   ```bash
   nx serve api
   ```

2. ตรวจสอบ API health check:
   ```bash
   curl http://localhost:3000/health
   ```

3. เข้าถึง Management UIs:
   - RabbitMQ: http://localhost:15672
   - MinIO Console: http://localhost:9001  
   - pgAdmin: http://localhost:5050

4. เริ่มพัฒนา Features ใหม่หรือ Test Integrations! 