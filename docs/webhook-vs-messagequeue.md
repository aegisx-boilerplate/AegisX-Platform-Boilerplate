# Webhook vs Message Queue Implementation Guide

## Overview

This guide explains the differences between Webhooks and Message Queues, when to use each approach, and how to implement them together for optimal system architecture in enterprise applications.

## Fundamental Differences

| Aspect | Webhook | Message Queue |
|--------|---------|---------------|
| **Communication Pattern** | Direct HTTP-based | Queue-based, Indirect |
| **Delivery Model** | Push (Real-time) | Pull/Push (Asynchronous) |
| **Reliability** | Limited retry, Best effort | High reliability, Guaranteed delivery |
| **Coupling** | Loosely coupled | Fully decoupled |
| **Protocol** | HTTP/HTTPS | AMQP, Redis, SQS, etc. |
| **Latency** | Low (immediate) | Variable (depends on consumer) |
| **Scalability** | Limited by HTTP timeouts | High (queue buffering) |
| **Error Handling** | Manual retry logic | Built-in retry, DLQ support |
| **Ordering** | No guarantee | Can guarantee order |
| **Persistence** | No (unless custom) | Yes (message durability) |

## Architecture Patterns

### 1. Webhook Architecture

```
[Producer] → HTTP POST → [Consumer]
     ↓              ↓
  Event occurs   Process immediately
```

**Characteristics:**
- Synchronous communication
- Direct endpoint-to-endpoint delivery
- Real-time processing
- Limited retry mechanisms

### 2. Message Queue Architecture

```
[Producer] → [Queue] → [Consumer]
     ↓         ↓         ↓
  Publish   Buffer    Process when ready
```

**Characteristics:**
- Asynchronous communication
- Reliable message delivery
- Buffering and load leveling
- Advanced retry and error handling

### 3. Hybrid Architecture (Recommended)

```
[Event Source] → [Message Queue] → [Internal Processors]
       ↓
   [Webhook System] → [External Systems]
```

## Implementation Strategies

### 1. Internal Processing with Message Queue

```typescript
// libs/core/messaging/event-publisher.ts
export class InternalEventPublisher {
  constructor(
    private rabbitmq: RabbitMQService,
    private redis: Redis
  ) {}

  async publishInternalEvent(event: InternalEvent): Promise<void> {
    // Publish to message queue for reliable internal processing
    await this.rabbitmq.publish('internal.events', event.type, {
      id: uuidv4(),
      type: event.type,
      tenantId: event.tenantId,
      data: event.data,
      timestamp: new Date(),
      source: 'api',
      version: '1.0'
    }, {
      persistent: true,     // Survive broker restart
      mandatory: true,      // Ensure delivery to queue
      priority: this.getEventPriority(event.type)
    });

    console.log(`Published internal event: ${event.type}`);
  }

  private getEventPriority(eventType: string): number {
    const priorityMap = {
      'user.created': 8,
      'payment.completed': 10,
      'inventory.low': 9,
      'audit.log': 3,
      'analytics.track': 1
    };
    
    return priorityMap[eventType] || 5;
  }
}

// Consumer for internal processing
export class InternalEventConsumer {
  constructor(
    private rabbitmq: RabbitMQService,
    private emailService: EmailService,
    private analyticsService: AnalyticsService,
    private auditService: AuditService
  ) {}

  async initialize(): Promise<void> {
    // Setup queues with proper configuration
    await this.setupQueues();
    
    // Subscribe to event types
    await this.rabbitmq.subscribe('user.events', 'user.created', this.handleUserCreated.bind(this));
    await this.rabbitmq.subscribe('payment.events', 'payment.completed', this.handlePaymentCompleted.bind(this));
    await this.rabbitmq.subscribe('inventory.events', 'stock.low', this.handleLowStock.bind(this));
  }

  private async setupQueues(): Promise<void> {
    // Configure queues with dead letter handling
    await this.rabbitmq.createQueue('user.events', {
      durable: true,
      deadLetterExchange: 'dlx.events',
      deadLetterRoutingKey: 'user.events.failed',
      messageTtl: 300000, // 5 minutes
      maxRetries: 3
    });

    await this.rabbitmq.createQueue('user.events.dlq', {
      durable: true
    });
  }

  async handleUserCreated(message: RabbitMQMessage): Promise<void> {
    const { userId, tenantId, userData } = message.content;
    
    try {
      // Process in sequence with proper error handling
      await this.processUserCreatedWorkflow(userId, tenantId, userData);
      
      // Acknowledge successful processing
      message.ack();
      
    } catch (error) {
      console.error(`Failed to process user.created event for user ${userId}:`, error);
      
      // Increment retry count
      const retryCount = (message.properties.headers?.['x-retry-count'] || 0) + 1;
      const maxRetries = 3;

      if (retryCount >= maxRetries) {
        // Send to dead letter queue
        message.nack(false, false);
        await this.auditService.logFailedEvent(message.content, error);
      } else {
        // Retry with exponential backoff
        const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
        
        await this.rabbitmq.publish('user.events', 'user.created', {
          ...message.content,
          retryAttempt: retryCount
        }, {
          delay,
          headers: { 'x-retry-count': retryCount }
        });
        
        message.ack();
      }
    }
  }

  private async processUserCreatedWorkflow(userId: string, tenantId: string, userData: any): Promise<void> {
    // 1. Send welcome email
    await this.emailService.sendWelcomeEmail(userId, userData.email);
    
    // 2. Create default user settings
    await this.userSettingsService.createDefaults(userId, tenantId);
    
    // 3. Track registration analytics
    await this.analyticsService.trackUserRegistration(userId, tenantId, {
      source: userData.source,
      timestamp: new Date()
    });
    
    // 4. Create audit log
    await this.auditService.logUserCreation(userId, tenantId, userData);
    
    // 5. Initialize RBAC permissions
    await this.rbacService.assignDefaultRole(userId, tenantId);
  }
}
```

### 2. External Integration with Webhooks

```typescript
// libs/core/webhook/external-event-publisher.ts
export class ExternalEventPublisher {
  constructor(
    private webhookRegistry: WebhookRegistryService,
    private deliveryQueue: Queue,
    private redis: Redis
  ) {}

  async publishExternalEvent(event: ExternalEvent): Promise<void> {
    // Find webhook endpoints for this event type
    const webhooks = await this.webhookRegistry.findByEvent(event.tenantId, event.type);
    
    if (webhooks.length === 0) {
      console.log(`No webhook endpoints found for event ${event.type} in tenant ${event.tenantId}`);
      return;
    }

    // Create delivery jobs for each webhook
    const deliveries = webhooks.map(webhook => ({
      id: uuidv4(),
      webhookId: webhook.id,
      eventType: event.type,
      payload: this.buildWebhookPayload(event, webhook),
      tenantId: event.tenantId,
      status: 'pending',
      attempts: 0,
      maxAttempts: webhook.retryPolicy.maxAttempts,
      createdAt: new Date()
    }));

    // Batch queue webhook deliveries
    for (const delivery of deliveries) {
      await this.deliveryQueue.add('webhook-delivery', delivery, {
        attempts: 1, // We handle retries manually
        removeOnComplete: 100,
        removeOnFail: 100,
        priority: this.getWebhookPriority(event.type)
      });
    }

    console.log(`Queued ${deliveries.length} webhook deliveries for event ${event.type}`);
  }

  private buildWebhookPayload(event: ExternalEvent, webhook: WebhookEndpoint): any {
    return {
      id: uuidv4(),
      type: event.type,
      created_at: event.timestamp.toISOString(),
      data: event.data,
      webhook: {
        id: webhook.id,
        name: webhook.name
      },
      tenant: {
        id: event.tenantId
      }
    };
  }

  private getWebhookPriority(eventType: string): number {
    const priorityMap = {
      'payment.completed': 10,
      'order.shipped': 8,
      'user.created': 6,
      'analytics.event': 2
    };
    
    return priorityMap[eventType] || 5;
  }
}

// Webhook delivery worker
export class WebhookDeliveryWorker {
  constructor(
    private deliveryQueue: Queue,
    private webhookRegistry: WebhookRegistryService,
    private db: Knex
  ) {}

  async initialize(): Promise<void> {
    this.deliveryQueue.process('webhook-delivery', 10, this.processDelivery.bind(this));
    
    this.deliveryQueue.on('completed', (job) => {
      console.log(`Webhook delivery ${job.id} completed`);
    });

    this.deliveryQueue.on('failed', (job, error) => {
      console.error(`Webhook delivery ${job.id} failed:`, error);
    });
  }

  async processDelivery(job: Job): Promise<void> {
    const delivery = job.data;
    const webhook = await this.webhookRegistry.findById(delivery.webhookId);
    
    if (!webhook || !webhook.active) {
      await this.markDeliveryFailed(delivery.id, 'Webhook endpoint not found or inactive');
      return;
    }

    try {
      await this.attemptDelivery(delivery, webhook);
    } catch (error) {
      await this.handleDeliveryError(delivery, webhook, error);
    }
  }

  private async attemptDelivery(delivery: any, webhook: WebhookEndpoint): Promise<void> {
    const signature = this.generateSignature(webhook.secret, delivery.payload);
    const startTime = Date.now();

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature-256': signature,
          'X-Webhook-Event': delivery.eventType,
          'X-Webhook-Delivery': delivery.id,
          'X-Webhook-Timestamp': delivery.createdAt.toISOString(),
          'User-Agent': 'AegisX-Webhooks/1.0',
          ...webhook.headers
        },
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      const responseBody = await response.text();
      const duration = Date.now() - startTime;

      await this.updateDeliveryStatus(delivery.id, {
        status: response.ok ? 'success' : 'failed',
        attempts: delivery.attempts + 1,
        responseStatus: response.status,
        responseBody: responseBody.slice(0, 1000),
        lastAttemptAt: new Date(),
        completedAt: response.ok ? new Date() : null,
        duration
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Webhook delivery ${delivery.id} failed after ${duration}ms:`, error);
      throw error;
    }
  }

  private async handleDeliveryError(delivery: any, webhook: WebhookEndpoint, error: any): Promise<void> {
    const newAttempts = delivery.attempts + 1;
    const maxAttempts = webhook.retryPolicy.maxAttempts;

    if (newAttempts >= maxAttempts) {
      // Max attempts reached
      await this.updateDeliveryStatus(delivery.id, {
        status: 'failed',
        attempts: newAttempts,
        errorMessage: error.message,
        lastAttemptAt: new Date(),
        completedAt: new Date()
      });
      
      console.log(`Webhook delivery ${delivery.id} failed permanently after ${newAttempts} attempts`);
    } else {
      // Schedule retry with exponential backoff
      const delay = this.calculateRetryDelay(newAttempts, webhook.retryPolicy);
      
      await this.deliveryQueue.add('webhook-delivery', {
        ...delivery,
        attempts: newAttempts
      }, {
        delay,
        attempts: 1
      });

      await this.updateDeliveryStatus(delivery.id, {
        status: 'retrying',
        attempts: newAttempts,
        errorMessage: error.message,
        lastAttemptAt: new Date(),
        nextAttemptAt: new Date(Date.now() + delay)
      });
    }
  }

  private calculateRetryDelay(attempts: number, retryPolicy: RetryPolicy): number {
    let delay: number;

    switch (retryPolicy.backoffStrategy) {
      case 'linear':
        delay = retryPolicy.initialDelay * attempts;
        break;
      case 'exponential':
        delay = retryPolicy.initialDelay * Math.pow(2, attempts - 1);
        break;
      default:
        delay = retryPolicy.initialDelay;
    }

    return Math.min(delay, retryPolicy.maxDelay);
  }
}
```

### 3. Unified Event System

```typescript
// libs/core/events/unified-event-publisher.ts
export class UnifiedEventPublisher {
  constructor(
    private internalPublisher: InternalEventPublisher,
    private externalPublisher: ExternalEventPublisher,
    private auditService: AuditService
  ) {}

  async publishEvent(event: {
    type: string;
    tenantId: string;
    data: any;
    internal?: boolean;
    external?: boolean;
    audit?: boolean;
  }): Promise<void> {
    const eventId = uuidv4();
    const timestamp = new Date();

    try {
      // 1. Audit logging (if enabled)
      if (event.audit !== false) {
        await this.auditService.logEvent({
          id: eventId,
          type: event.type,
          tenantId: event.tenantId,
          data: event.data,
          timestamp
        });
      }

      // 2. Internal processing (default: true)
      if (event.internal !== false) {
        await this.internalPublisher.publishInternalEvent({
          id: eventId,
          type: event.type,
          tenantId: event.tenantId,
          data: event.data,
          timestamp
        });
      }

      // 3. External webhooks (default: true)
      if (event.external !== false) {
        await this.externalPublisher.publishExternalEvent({
          id: eventId,
          type: event.type,
          tenantId: event.tenantId,
          data: event.data,
          timestamp
        });
      }

    } catch (error) {
      console.error(`Failed to publish event ${event.type}:`, error);
      
      // Log error but don't throw to prevent breaking the main flow
      await this.auditService.logEventError(eventId, event, error);
    }
  }

  // Convenience methods for common events
  async publishUserCreated(tenantId: string, user: any): Promise<void> {
    await this.publishEvent({
      type: 'user.created',
      tenantId,
      data: { user },
      internal: true,  // Process welcome email, analytics, etc.
      external: true,  // Notify external systems
      audit: true      // Log for compliance
    });
  }

  async publishPaymentCompleted(tenantId: string, payment: any): Promise<void> {
    await this.publishEvent({
      type: 'payment.completed',
      tenantId,
      data: { payment },
      internal: true,  // Update order status, send receipt
      external: true,  // Notify merchant, accounting system
      audit: true      // Critical for financial compliance
    });
  }

  async publishAnalyticsEvent(tenantId: string, analyticsData: any): Promise<void> {
    await this.publishEvent({
      type: 'analytics.tracked',
      tenantId,
      data: analyticsData,
      internal: true,  // Process analytics internally
      external: false, // Don't send analytics via webhooks
      audit: false     // Not required for audit
    });
  }
}
```

## Use Case Guidelines

### When to Use Message Queue

✅ **Use Message Queue for:**

1. **Internal System Communication**
   ```typescript
   // Reliable processing between microservices
   await messageQueue.publish('user.events', {
     type: 'user.created',
     userId: user.id,
     workflow: ['email', 'analytics', 'permissions']
   });
   ```

2. **Complex Business Workflows**
   ```typescript
   // Multi-step order processing
   await messageQueue.publish('order.workflow', {
     type: 'order.created',
     orderId: order.id,
     steps: [
       'validate_inventory',
       'reserve_stock',
       'calculate_shipping',
       'charge_payment',
       'send_confirmation'
     ]
   });
   ```

3. **High-Volume Background Processing**
   ```typescript
   // Batch analytics processing
   await messageQueue.publish('analytics.batch', {
     type: 'daily_report',
     tenantId: tenant.id,
     reportDate: new Date()
   });
   ```

4. **Critical System Events**
   ```typescript
   // Events that must not be lost
   await messageQueue.publish('audit.events', {
     type: 'security.breach_detected',
     severity: 'critical',
     details: securityEvent
   }, { persistent: true, priority: 10 });
   ```

### When to Use Webhooks

✅ **Use Webhooks for:**

1. **Real-time External Notifications**
   ```typescript
   // Immediate notification to external systems
   await webhookPublisher.publish({
     type: 'payment.completed',
     data: { payment },
     tenantId: merchant.id
   });
   ```

2. **Third-party Integrations**
   ```typescript
   // Integration with external services
   await webhookPublisher.publish({
     type: 'user.subscription_changed',
     data: { subscription, user },
     tenantId: tenant.id
   });
   ```

3. **Event Streaming to Partners**
   ```typescript
   // Real-time data feeds
   await webhookPublisher.publish({
     type: 'inventory.updated',
     data: { item, oldStock, newStock },
     tenantId: supplier.id
   });
   ```

## Monitoring and Observability

### Message Queue Monitoring

```typescript
// libs/core/monitoring/queue-monitor.ts
export class MessageQueueMonitor {
  constructor(
    private rabbitmq: RabbitMQService,
    private redis: Redis
  ) {}

  async getQueueHealth(): Promise<QueueHealthStatus> {
    return {
      queues: await this.getQueueStats(),
      consumers: await this.getConsumerStats(),
      deadLetterQueues: await this.getDLQStats(),
      processingRates: await this.getProcessingRates()
    };
  }

  private async getQueueStats(): Promise<QueueStats[]> {
    const queues = ['user.events', 'payment.events', 'order.events', 'analytics.events'];
    const stats = [];

    for (const queueName of queues) {
      const info = await this.rabbitmq.getQueueInfo(queueName);
      stats.push({
        name: queueName,
        messageCount: info.messageCount,
        consumerCount: info.consumerCount,
        messageRate: info.messageRate,
        publishRate: info.publishRate
      });
    }

    return stats;
  }

  async alertOnQueueBacklog(queueName: string, threshold: number): Promise<void> {
    const info = await this.rabbitmq.getQueueInfo(queueName);
    
    if (info.messageCount > threshold) {
      await this.sendAlert({
        type: 'queue_backlog',
        queue: queueName,
        messageCount: info.messageCount,
        threshold,
        severity: 'warning'
      });
    }
  }
}
```

### Webhook Monitoring

```typescript
// libs/core/monitoring/webhook-monitor.ts
export class WebhookMonitor {
  constructor(
    private db: Knex,
    private redis: Redis
  ) {}

  async getWebhookHealth(): Promise<WebhookHealthStatus> {
    return {
      endpoints: await this.getEndpointStats(),
      deliveries: await this.getDeliveryStats(),
      successRates: await this.getSuccessRates(),
      responseTimeStats: await this.getResponseTimeStats()
    };
  }

  async getDeliveryStats(period: string = '24h'): Promise<DeliveryStats> {
    const since = this.getPeriodStart(period);
    
    const stats = await this.db('webhook_deliveries')
      .where('created_at', '>=', since)
      .groupBy('status')
      .select('status')
      .count('* as count');

    return {
      total: stats.reduce((sum, stat) => sum + parseInt(stat.count), 0),
      breakdown: stats.reduce((acc, stat) => {
        acc[stat.status] = parseInt(stat.count);
        return acc;
      }, {}),
      period
    };
  }

  async getEndpointHealth(endpointId: string): Promise<EndpointHealth> {
    const recentDeliveries = await this.db('webhook_deliveries')
      .where('webhook_endpoint_id', endpointId)
      .where('created_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .select('status', 'duration', 'created_at');

    const total = recentDeliveries.length;
    const successful = recentDeliveries.filter(d => d.status === 'success').length;
    const avgResponseTime = recentDeliveries
      .filter(d => d.duration)
      .reduce((sum, d) => sum + d.duration, 0) / recentDeliveries.length;

    return {
      endpointId,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      totalDeliveries: total,
      averageResponseTime: avgResponseTime || 0,
      lastDelivery: recentDeliveries[0]?.created_at || null,
      status: this.calculateEndpointStatus(successful, total, avgResponseTime)
    };
  }
}
```

## Best Practices

### 1. Event Design

```typescript
// Standard event structure
interface StandardEvent {
  id: string;                    // Unique event identifier
  type: string;                  // Event type (dot notation)
  version: string;               // Event schema version
  timestamp: Date;               // When event occurred
  source: string;                // Source system/service
  tenantId: string;              // Tenant isolation
  userId?: string;               // User context (if applicable)
  data: any;                     // Event payload
  metadata?: {                   // Additional context
    traceId?: string;
    sessionId?: string;
    correlationId?: string;
  };
}
```

### 2. Error Handling

```typescript
// Comprehensive error handling
export class ErrorHandler {
  static async handleMessageQueueError(error: Error, message: any): Promise<void> {
    // Log error with context
    console.error('Message queue processing error:', {
      error: error.message,
      stack: error.stack,
      message: message.content,
      queue: message.fields.routingKey,
      timestamp: new Date()
    });

    // Increment retry count
    const retryCount = message.properties.headers?.['x-retry-count'] || 0;
    
    if (retryCount >= 3) {
      // Send to dead letter queue
      message.nack(false, false);
      await this.notifyAdministrators(error, message);
    } else {
      // Schedule retry with exponential backoff
      await this.scheduleRetry(message, retryCount + 1);
    }
  }

  static async handleWebhookError(error: Error, delivery: any): Promise<void> {
    // Update delivery status
    await this.updateDeliveryStatus(delivery.id, {
      status: 'failed',
      errorMessage: error.message,
      lastAttemptAt: new Date()
    });

    // Check if retry is needed
    if (delivery.attempts < delivery.maxAttempts) {
      await this.scheduleWebhookRetry(delivery);
    } else {
      await this.markWebhookFailed(delivery);
    }
  }
}
```

### 3. Performance Optimization

```typescript
// Batch processing for better performance
export class BatchProcessor {
  async processBatch<T>(items: T[], batchSize: number, processor: (batch: T[]) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await processor(batch);
      
      // Prevent overwhelming the system
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  async batchWebhookDeliveries(deliveries: WebhookDelivery[]): Promise<void> {
    await this.processBatch(deliveries, 10, async (batch) => {
      const promises = batch.map(delivery => this.processDelivery(delivery));
      await Promise.allSettled(promises);
    });
  }
}
```

## Summary

| Scenario | Recommended Approach | Reasoning |
|----------|---------------------|-----------|
| **Internal Service Communication** | Message Queue | Reliability, error handling, decoupling |
| **External API Integration** | Webhook | Real-time, simple HTTP-based |
| **Complex Business Workflows** | Message Queue | Sequential processing, state management |
| **Real-time Notifications** | Webhook | Low latency, immediate delivery |
| **High-Volume Processing** | Message Queue | Buffering, load leveling |
| **Third-party SaaS Integration** | Webhook | Standard integration pattern |
| **Critical System Events** | Message Queue + Webhook | Reliability + real-time notification |
| **Analytics/Reporting** | Message Queue | Batch processing, aggregation |

### Key Takeaways

1. **Use both technologies together** - They complement each other
2. **Message Queue for reliability** - When you can't afford to lose messages
3. **Webhook for real-time** - When immediate notification is critical
4. **Monitor everything** - Queue depth, delivery rates, error rates
5. **Plan for failures** - Implement proper retry logic and dead letter queues
6. **Maintain event schemas** - Version your events for backward compatibility
7. **Secure all communications** - Use signatures, HTTPS, authentication
8. **Design for scale** - Consider load balancing, horizontal scaling
