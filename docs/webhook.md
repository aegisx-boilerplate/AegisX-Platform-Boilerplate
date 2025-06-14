# Webhook Implementation Guide

## Overview

This guide covers implementing a robust webhook system in AegisX Platform for external integrations, event notifications, and real-time data synchronization with third-party services.

## Architecture

### Core Components

1. **Webhook Registry**: Manages webhook endpoint configurations
2. **Event Publisher**: Publishes events to registered webhooks
3. **Delivery System**: Handles HTTP delivery with retry logic
4. **Security Layer**: Signature verification and authentication
5. **Monitoring**: Tracks delivery status and performance

## Implementation

### Database Schema

```sql
-- Webhook endpoints
CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT true,
  headers JSONB DEFAULT '{}',
  retry_policy JSONB NOT NULL DEFAULT '{
    "max_attempts": 3,
    "backoff_strategy": "exponential",
    "initial_delay": 1000,
    "max_delay": 60000
  }',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook delivery logs
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id),
  event_type VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL, -- pending, success, failed, retrying
  attempt_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP,
  next_attempt_at TIMESTAMP,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_webhook_endpoints_tenant_id ON webhook_endpoints(tenant_id);
CREATE INDEX idx_webhook_endpoints_active ON webhook_endpoints(active) WHERE active = true;
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_attempt ON webhook_deliveries(next_attempt_at) WHERE status = 'retrying';
```

### Webhook Models

```typescript
// libs/modules/webhook/webhook.interfaces.ts
export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  headers: Record<string, string>;
  retryPolicy: RetryPolicy;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
}

export interface WebhookDelivery {
  id: string;
  webhookEndpointId: string;
  eventType: string;
  payload: any;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attemptCount: number;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface WebhookEvent {
  type: string;
  tenantId: string;
  data: any;
  timestamp: Date;
  id?: string;
}
```

### Webhook Registry Service

```typescript
// libs/modules/webhook/webhook-registry.service.ts
export class WebhookRegistryService {
  constructor(
    private db: TenantQueryBuilder,
    private redis: Redis
  ) {}

  async createEndpoint(data: Partial<WebhookEndpoint>): Promise<WebhookEndpoint> {
    const secret = this.generateSecret();
    
    const endpoint = await this.db.table('webhook_endpoints')
      .insert({
        ...data,
        secret,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // Clear cache
    await this.clearEndpointCache(data.tenantId!);

    return endpoint[0];
  }

  async updateEndpoint(id: string, data: Partial<WebhookEndpoint>): Promise<WebhookEndpoint | null> {
    const [updated] = await this.db.table('webhook_endpoints')
      .where('id', id)
      .update({
        ...data,
        updated_at: new Date()
      })
      .returning('*');

    if (updated) {
      await this.clearEndpointCache(updated.tenant_id);
    }

    return updated || null;
  }

  async deleteEndpoint(id: string): Promise<boolean> {
    const endpoint = await this.findById(id);
    if (!endpoint) return false;

    const deleted = await this.db.table('webhook_endpoints')
      .where('id', id)
      .del();

    if (deleted > 0) {
      await this.clearEndpointCache(endpoint.tenantId);
    }

    return deleted > 0;
  }

  async findById(id: string): Promise<WebhookEndpoint | null> {
    const endpoint = await this.db.table('webhook_endpoints')
      .where('id', id)
      .first();

    return endpoint || null;
  }

  async findByTenant(tenantId: string): Promise<WebhookEndpoint[]> {
    return this.db.table('webhook_endpoints')
      .where('active', true)
      .orderBy('created_at', 'desc');
  }

  async findByEvent(tenantId: string, eventType: string): Promise<WebhookEndpoint[]> {
    // Check cache first
    const cacheKey = `webhooks:${tenantId}:${eventType}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database with JSON array contains
    const endpoints = await this.db.table('webhook_endpoints')
      .where('active', true)
      .whereRaw('? = ANY(events) OR ? = ANY(events)', [eventType, '*']);

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(endpoints));

    return endpoints;
  }

  async testEndpoint(id: string): Promise<{ success: boolean; response?: any; error?: string }> {
    const endpoint = await this.findById(id);
    if (!endpoint) {
      return { success: false, error: 'Endpoint not found' };
    }

    const testPayload = {
      type: 'webhook.test',
      data: {
        message: 'This is a test webhook delivery',
        timestamp: new Date().toISOString()
      },
      webhook: {
        id: endpoint.id,
        name: endpoint.name
      }
    };

    try {
      const signature = this.generateSignature(endpoint.secret, testPayload);
      
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature-256': signature,
          'X-Webhook-Event': 'webhook.test',
          'User-Agent': 'AegisX-Webhooks/1.0',
          ...endpoint.headers
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      const responseText = await response.text();

      return {
        success: response.ok,
        response: {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateSignature(secret: string, payload: any): string {
    const body = JSON.stringify(payload);
    return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  private async clearEndpointCache(tenantId: string): Promise<void> {
    const pattern = `webhooks:${tenantId}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### Event Publisher

```typescript
// libs/core/webhook/webhook-publisher.service.ts
export class WebhookPublisher {
  constructor(
    private registryService: WebhookRegistryService,
    private deliveryQueue: Queue,
    private db: Knex
  ) {}

  async publishEvent(event: WebhookEvent): Promise<void> {
    const endpoints = await this.registryService.findByEvent(event.tenantId, event.type);
    
    if (endpoints.length === 0) {
      console.log(`No webhook endpoints found for event ${event.type} in tenant ${event.tenantId}`);
      return;
    }

    const deliveries: Partial<WebhookDelivery>[] = [];

    for (const endpoint of endpoints) {
      const delivery: Partial<WebhookDelivery> = {
        id: uuidv4(),
        webhookEndpointId: endpoint.id,
        eventType: event.type,
        payload: this.buildPayload(event, endpoint),
        status: 'pending',
        attemptCount: 0,
        createdAt: new Date()
      };

      deliveries.push(delivery);
    }

    // Batch insert deliveries
    if (deliveries.length > 0) {
      await this.db('webhook_deliveries').insert(deliveries);

      // Queue for immediate delivery
      for (const delivery of deliveries) {
        await this.deliveryQueue.add('deliver-webhook', {
          deliveryId: delivery.id
        }, {
          attempts: 1, // We handle retries manually
          removeOnComplete: 100,
          removeOnFail: 100
        });
      }
    }

    console.log(`Queued ${deliveries.length} webhook deliveries for event ${event.type}`);
  }

  private buildPayload(event: WebhookEvent, endpoint: WebhookEndpoint): any {
    return {
      id: event.id || uuidv4(),
      type: event.type,
      created_at: event.timestamp.toISOString(),
      data: event.data,
      webhook: {
        id: endpoint.id,
        name: endpoint.name
      }
    };
  }

  // Convenience methods for common events
  async publishUserCreated(tenantId: string, user: any): Promise<void> {
    await this.publishEvent({
      type: 'user.created',
      tenantId,
      data: { user },
      timestamp: new Date()
    });
  }

  async publishOrderUpdated(tenantId: string, order: any): Promise<void> {
    await this.publishEvent({
      type: 'order.updated',
      tenantId,
      data: { order },
      timestamp: new Date()
    });
  }

  async publishCustomEvent(tenantId: string, eventType: string, data: any): Promise<void> {
    await this.publishEvent({
      type: eventType,
      tenantId,
      data,
      timestamp: new Date()
    });
  }
}
```

### Delivery System

```typescript
// libs/core/webhook/webhook-delivery.service.ts
export class WebhookDeliveryService {
  constructor(
    private db: Knex,
    private registryService: WebhookRegistryService
  ) {}

  async deliverWebhook(deliveryId: string): Promise<void> {
    const delivery = await this.getDelivery(deliveryId);
    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    const endpoint = await this.registryService.findById(delivery.webhookEndpointId);
    if (!endpoint || !endpoint.active) {
      await this.markDeliveryFailed(deliveryId, 'Endpoint not found or inactive');
      return;
    }

    try {
      await this.attemptDelivery(delivery, endpoint);
    } catch (error) {
      await this.handleDeliveryError(delivery, endpoint, error);
    }
  }

  private async attemptDelivery(delivery: WebhookDelivery, endpoint: WebhookEndpoint): Promise<void> {
    const signature = this.generateSignature(endpoint.secret, delivery.payload);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature-256': signature,
          'X-Webhook-Event': delivery.eventType,
          'X-Webhook-Delivery': delivery.id,
          'X-Webhook-Timestamp': delivery.createdAt.toISOString(),
          'User-Agent': 'AegisX-Webhooks/1.0',
          ...endpoint.headers
        },
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      const responseBody = await response.text();
      const duration = Date.now() - startTime;

      await this.updateDeliveryAttempt(delivery.id, {
        attemptCount: delivery.attemptCount + 1,
        lastAttemptAt: new Date(),
        responseStatus: response.status,
        responseBody: responseBody.slice(0, 1000), // Limit response body size
        status: response.ok ? 'success' : 'failed',
        completedAt: response.ok ? new Date() : undefined,
        errorMessage: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      });

      console.log(`Webhook delivery ${delivery.id} completed in ${duration}ms with status ${response.status}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Webhook delivery ${delivery.id} failed after ${duration}ms:`, error);
      throw error;
    }
  }

  private async handleDeliveryError(
    delivery: WebhookDelivery, 
    endpoint: WebhookEndpoint, 
    error: any
  ): Promise<void> {
    const attemptCount = delivery.attemptCount + 1;
    const maxAttempts = endpoint.retryPolicy.maxAttempts;

    const updateData: Partial<WebhookDelivery> = {
      attemptCount,
      lastAttemptAt: new Date(),
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    };

    if (attemptCount >= maxAttempts) {
      // Max attempts reached, mark as failed
      updateData.status = 'failed';
      updateData.completedAt = new Date();
      
      console.log(`Webhook delivery ${delivery.id} failed permanently after ${attemptCount} attempts`);
    } else {
      // Schedule retry
      updateData.status = 'retrying';
      updateData.nextAttemptAt = this.calculateNextAttempt(
        attemptCount, 
        endpoint.retryPolicy
      );

      // Queue retry
      await this.scheduleRetry(delivery.id, updateData.nextAttemptAt!);
      
      console.log(`Webhook delivery ${delivery.id} scheduled for retry at ${updateData.nextAttemptAt}`);
    }

    await this.updateDeliveryAttempt(delivery.id, updateData);
  }

  private calculateNextAttempt(attemptCount: number, retryPolicy: RetryPolicy): Date {
    let delay: number;

    switch (retryPolicy.backoffStrategy) {
      case 'linear':
        delay = retryPolicy.initialDelay * attemptCount;
        break;
      case 'exponential':
        delay = retryPolicy.initialDelay * Math.pow(2, attemptCount - 1);
        break;
      default:
        delay = retryPolicy.initialDelay;
    }

    // Cap the delay at maxDelay
    delay = Math.min(delay, retryPolicy.maxDelay);

    return new Date(Date.now() + delay);
  }

  private async scheduleRetry(deliveryId: string, nextAttempt: Date): Promise<void> {
    const delay = nextAttempt.getTime() - Date.now();
    
    // Queue for retry with delay
    await this.deliveryQueue.add('deliver-webhook', {
      deliveryId
    }, {
      delay: Math.max(delay, 0),
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100
    });
  }

  private async getDelivery(deliveryId: string): Promise<WebhookDelivery | null> {
    const delivery = await this.db('webhook_deliveries')
      .where('id', deliveryId)
      .first();

    return delivery || null;
  }

  private async updateDeliveryAttempt(
    deliveryId: string, 
    data: Partial<WebhookDelivery>
  ): Promise<void> {
    await this.db('webhook_deliveries')
      .where('id', deliveryId)
      .update(data);
  }

  private async markDeliveryFailed(deliveryId: string, reason: string): Promise<void> {
    await this.updateDeliveryAttempt(deliveryId, {
      status: 'failed',
      errorMessage: reason,
      completedAt: new Date()
    });
  }

  private generateSignature(secret: string, payload: any): string {
    const body = JSON.stringify(payload);
    return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  }

  // Cleanup old deliveries
  async cleanupDeliveries(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const deleted = await this.db('webhook_deliveries')
      .where('created_at', '<', cutoffDate)
      .whereIn('status', ['success', 'failed'])
      .del();

    console.log(`Cleaned up ${deleted} old webhook deliveries`);
    return deleted;
  }
}
```

### Queue Worker Setup

```typescript
// libs/core/webhook/webhook-worker.ts
import { Worker, Job } from 'bullmq';

export class WebhookWorker {
  private worker: Worker;

  constructor(
    private deliveryService: WebhookDeliveryService,
    private redis: Redis
  ) {
    this.worker = new Worker('webhooks', this.processJob.bind(this), {
      connection: redis,
      concurrency: 10, // Process up to 10 webhooks concurrently
      limiter: {
        max: 100, // Max 100 jobs per minute
        duration: 60000
      }
    });

    this.worker.on('completed', (job) => {
      console.log(`Webhook job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Webhook job ${job?.id} failed:`, err);
    });
  }

  private async processJob(job: Job): Promise<void> {
    const { deliveryId } = job.data;
    await this.deliveryService.deliverWebhook(deliveryId);
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
```

### REST API Endpoints

```typescript
// apps/api/src/routes/webhooks.ts
export async function webhookRoutes(fastify: FastifyInstance) {
  // List webhook endpoints
  fastify.get('/webhooks', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const webhooks = await fastify.webhookRegistry.findByTenant(request.tenant.id);
    return { webhooks };
  });

  // Create webhook endpoint
  fastify.post('/webhooks', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'url', 'events'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          url: { type: 'string', format: 'uri' },
          events: { type: 'array', items: { type: 'string' } },
          headers: { type: 'object' },
          retryPolicy: {
            type: 'object',
            properties: {
              maxAttempts: { type: 'number', minimum: 1, maximum: 10 },
              backoffStrategy: { type: 'string', enum: ['linear', 'exponential'] },
              initialDelay: { type: 'number', minimum: 100 },
              maxDelay: { type: 'number', minimum: 1000 }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const webhook = await fastify.webhookRegistry.createEndpoint({
      ...request.body,
      tenantId: request.tenant.id
    });
    
    return { webhook };
  });

  // Update webhook endpoint
  fastify.put('/webhooks/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const webhook = await fastify.webhookRegistry.updateEndpoint(id, request.body);
    
    if (!webhook) {
      reply.code(404).send({ error: 'Webhook not found' });
      return;
    }
    
    return { webhook };
  });

  // Delete webhook endpoint
  fastify.delete('/webhooks/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const deleted = await fastify.webhookRegistry.deleteEndpoint(id);
    
    if (!deleted) {
      reply.code(404).send({ error: 'Webhook not found' });
      return;
    }
    
    reply.code(204).send();
  });

  // Test webhook endpoint
  fastify.post('/webhooks/:id/test', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const result = await fastify.webhookRegistry.testEndpoint(id);
    
    return { result };
  });

  // Get webhook deliveries
  fastify.get('/webhooks/:id/deliveries', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { page = 1, limit = 20 } = request.query;
    
    const deliveries = await fastify.db('webhook_deliveries')
      .where('webhook_endpoint_id', id)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);
    
    return { deliveries };
  });

  // Retry webhook delivery
  fastify.post('/webhooks/deliveries/:deliveryId/retry', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { deliveryId } = request.params;
    
    // Reset delivery status and queue for retry
    await fastify.db('webhook_deliveries')
      .where('id', deliveryId)
      .update({
        status: 'pending',
        next_attempt_at: new Date(),
        error_message: null
      });

    await fastify.webhookQueue.add('deliver-webhook', { deliveryId });
    
    return { message: 'Delivery queued for retry' };
  });
}
```

### Integration Examples

```typescript
// Example: User service integration
export class UserService {
  constructor(
    private webhookPublisher: WebhookPublisher
  ) {}

  async createUser(tenantId: string, userData: any): Promise<User> {
    const user = await this.userRepository.create(userData);

    // Publish webhook event
    await this.webhookPublisher.publishUserCreated(tenantId, {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      createdAt: user.createdAt
    });

    return user;
  }

  async updateUser(tenantId: string, userId: string, updates: any): Promise<User> {
    const user = await this.userRepository.update(userId, updates);

    // Publish webhook event
    await this.webhookPublisher.publishCustomEvent(tenantId, 'user.updated', {
      id: user.id,
      changes: updates,
      updatedAt: user.updatedAt
    });

    return user;
  }
}
```

### Security Considerations

1. **Signature Verification**: Always verify webhook signatures
2. **HTTPS Only**: Only allow HTTPS webhook URLs
3. **Rate Limiting**: Implement delivery rate limits
4. **Timeout Handling**: Set reasonable timeouts for deliveries
5. **Secret Rotation**: Provide mechanism to rotate webhook secrets
6. **IP Whitelisting**: Optional IP restriction for webhook endpoints

### Monitoring & Analytics

```typescript
// Webhook analytics service
export class WebhookAnalyticsService {
  async getDeliveryStats(tenantId: string, period: string): Promise<any> {
    const stats = await this.db('webhook_deliveries wd')
      .join('webhook_endpoints we', 'wd.webhook_endpoint_id', 'we.id')
      .where('we.tenant_id', tenantId)
      .where('wd.created_at', '>=', this.getPeriodStart(period))
      .groupBy('wd.status')
      .select('wd.status')
      .count('* as count');

    return {
      total: stats.reduce((sum, stat) => sum + parseInt(stat.count), 0),
      breakdown: stats.reduce((acc, stat) => {
        acc[stat.status] = parseInt(stat.count);
        return acc;
      }, {})
    };
  }

  async getEndpointHealth(endpointId: string): Promise<any> {
    const recentDeliveries = await this.db('webhook_deliveries')
      .where('webhook_endpoint_id', endpointId)
      .where('created_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .select('status')
      .count('* as count')
      .groupBy('status');

    const total = recentDeliveries.reduce((sum, d) => sum + parseInt(d.count), 0);
    const successful = recentDeliveries
      .find(d => d.status === 'success')?.count || 0;

    return {
      successRate: total > 0 ? (successful / total) * 100 : 0,
      totalDeliveries: total,
      lastDelivery: await this.getLastDelivery(endpointId)
    };
  }
}
```

This comprehensive webhook implementation provides a robust foundation for external integrations with proper error handling, retry logic, security, and monitoring capabilities.
