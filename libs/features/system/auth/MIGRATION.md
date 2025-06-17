# Database Migration Guide

## 🗄️ Setting up Authentication Database

This guide will help you set up the database for the authentication system.

## Prerequisites

- PostgreSQL 12+ installed and running
- Database creation permissions
- Access to run SQL migrations

## 1. Create Database

```sql
CREATE DATABASE aegisx_platform;
```

## 2. Run Migration

```bash
# Connect to your database
psql -h localhost -U postgres -d aegisx_platform

# Run the migration file
\i database/migrations/001_create_users_table.sql
```

## 3. Verify Tables

```sql
-- Check tables were created
\dt

-- Should show:
-- users
-- refresh_tokens

-- Check user table structure
\d users;

-- Check default admin user
SELECT id, email, first_name, last_name, is_active FROM users;
```

## 4. Update Default Admin Password

The migration creates a default admin user with a placeholder password hash. You need to update it:

```sql
-- Generate a new password hash (use bcrypt with saltRounds=10)
-- For password 'admin123':
UPDATE users 
SET password_hash = '$2b$10$rQJ8P.6Y9Zm1LfKEQNV7ZeK8VGJ8n4K.8X9xQ4K8N7Y9Zm1LfKEQNV7Z'
WHERE email = 'admin@aegisx.com';
```

Or generate a new hash programmatically:

```javascript
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash('your-admin-password', 10);
console.log(hash);
```

## 5. Environment Configuration

Create a `.env` file with your database configuration:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aegisx_platform
DB_USER=postgres
DB_PASSWORD=your-db-password

# JWT Secrets (generate strong secrets for production)
JWT_ACCESS_SECRET=your-super-secret-access-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
```

## 6. Test Connection

Create a simple test script:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'aegisx_platform',
  user: 'postgres',
  password: 'your-password'
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    console.log('Database connected successfully!');
    console.log('Users count:', result.rows[0].count);
  } catch (error) {
    console.error('Database connection failed:', error);
  } finally {
    await pool.end();
  }
}

testConnection();
```

## Production Considerations

### Security
- Change default admin password
- Use strong, unique JWT secrets
- Enable SSL for database connections
- Implement proper firewall rules

### Performance
- Add database indexes for large user bases
- Configure connection pooling
- Monitor query performance

### Backup
- Set up regular database backups
- Test restore procedures
- Consider point-in-time recovery

## Troubleshooting

### Connection Issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
psql -l | grep aegisx_platform

# Check user permissions
psql -c "\du" aegisx_platform
```

### Migration Issues
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check if migration ran
SELECT * FROM users LIMIT 1;
```

### Password Hash Issues
```javascript
// Test password verification
const bcrypt = require('bcrypt');
const isValid = await bcrypt.compare('password123', stored_hash);
console.log('Password valid:', isValid);
```
