# Strapi-Style Webhook Implementation

## Overview

This guide shows how to implement Strapi-style webhooks in AegisX Platform, featuring lifecycle hooks, admin UI management, and flexible event filtering similar to Strapi's webhook system.

## Core Features (Strapi-Inspired)

### 1. Lifecycle Hooks Integration
- Automatic webhook triggers on CRUD operations
- Configurable event types (create, update, delete, publish, etc.)
- Model-specific webhook subscriptions
- Before/After hook support

### 2. Admin UI Management
- Web-based webhook configuration
- Real-time delivery status monitoring
- Test webhook functionality
- Delivery logs and analytics

### 3. Event Filtering & Targeting
- Granular event selection
- Model/entity-specific webhooks
- Conditional webhook firing
- Custom payload transformation

## Implementation

### 1. Lifecycle Hook System

```typescript
// libs/core/lifecycle/lifecycle-manager.ts
export interface LifecycleHook {
  event: LifecycleEvent;
  model: string;
  phase: 'before' | 'after';
  handler: (data: any, context: LifecycleContext) => Promise<void>;
}

export enum LifecycleEvent {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  FIND = 'find',
  FIND_ONE = 'findOne',
  PUBLISH = 'publish',
  UNPUBLISH = 'unpublish'
}

export class LifecycleManager {
  private hooks = new Map<string, LifecycleHook[]>();
  
  constructor(
    private webhookService: WebhookService,
    private auditService: AuditService
  ) {}

  registerHook(hook: LifecycleHook): void {
    const key = `${hook.model}.${hook.event}.${hook.phase}`;
    
    if (!this.hooks.has(key)) {
      this.hooks.set(key, []);
    }
    
    this.hooks.get(key)!.push(hook);
  }

  async executeHooks(
    model: string, 
    event: LifecycleEvent, 
    phase: 'before' | 'after',
    data: any,
    context: LifecycleContext
  ): Promise<void> {
    const key = `${model}.${event}.${phase}`;
    const hooks = this.hooks.get(key) || [];

    for (const hook of hooks) {
      try {
        await hook.handler(data, context);
      } catch (error) {
        console.error(`Lifecycle hook failed for ${key}:`, error);
        
        // Don't break the main operation for webhook failures
        await this.auditService.logHookError(hook, error, context);
      }
    }
  }

  // Auto-register webhook hooks for all configured endpoints
  async initializeWebhookHooks(): Promise<void> {
    const webhookEndpoints = await this.webhookService.getAllActiveEndpoints();

    for (const endpoint of webhookEndpoints) {
      for (const eventPattern of endpoint.events) {
        const [model, event] = this.parseEventPattern(eventPattern);
        
        this.registerHook({
          event: event as LifecycleEvent,
          model,
          phase: 'after', // Webhooks typically fire after the operation
          handler: async (data, context) => {
            await this.webhookService.triggerWebhook(endpoint, {
              event: eventPattern,
              model,
              data,
              context: {
                tenantId: context.tenantId,
                userId: context.userId,
                timestamp: new Date()
              }
            });
          }
        });
      }
    }
  }

  private parseEventPattern(pattern: string): [string, string] {
    // Parse patterns like 'user.create', 'order.*', 'product.update'
    const [model, event] = pattern.split('.');
    return [model, event || '*'];
  }
}
```

### 2. Repository Integration with Lifecycle Hooks

```typescript
// libs/core/database/lifecycle-repository.ts
export abstract class LifecycleRepository<T> extends BaseTenantRepository<T> {
  constructor(
    protected db: TenantQueryBuilder,
    protected tableName: string,
    protected lifecycleManager: LifecycleManager
  ) {
    super(db, tableName);
  }

  async create(data: Partial<T>): Promise<T> {
    const context = this.getLifecycleContext();

    // Before create hooks
    await this.lifecycleManager.executeHooks(
      this.tableName, 
      LifecycleEvent.CREATE, 
      'before', 
      data, 
      context
    );

    // Perform the actual create operation
    const created = await super.create(data);

    // After create hooks (including webhooks)
    await this.lifecycleManager.executeHooks(
      this.tableName, 
      LifecycleEvent.CREATE, 
      'after', 
      created, 
      context
    );

    return created;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const context = this.getLifecycleContext();
    const existing = await this.findById(id);

    if (!existing) return null;

    // Before update hooks
    await this.lifecycleManager.executeHooks(
      this.tableName, 
      LifecycleEvent.UPDATE, 
      'before', 
      { id, data, existing }, 
      context
    );

    // Perform the actual update
    const updated = await super.update(id, data);

    if (updated) {
      // After update hooks
      await this.lifecycleManager.executeHooks(
        this.tableName, 
        LifecycleEvent.UPDATE, 
        'after', 
        { id, data: updated, previous: existing }, 
        context
      );
    }

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const context = this.getLifecycleContext();
    const existing = await this.findById(id);

    if (!existing) return false;

    // Before delete hooks
    await this.lifecycleManager.executeHooks(
      this.tableName, 
      LifecycleEvent.DELETE, 
      'before', 
      existing, 
      context
    );

    // Perform the actual delete
    const deleted = await super.delete(id);

    if (deleted) {
      // After delete hooks
      await this.lifecycleManager.executeHooks(
        this.tableName, 
        LifecycleEvent.DELETE, 
        'after', 
        existing, 
        context
      );
    }

    return deleted;
  }

  private getLifecycleContext(): LifecycleContext {
    return {
      tenantId: this.db.tenantId,
      userId: this.getCurrentUserId(), // From request context
      timestamp: new Date(),
      source: 'api'
    };
  }

  private getCurrentUserId(): string | undefined {
    // Get from request context - implementation depends on your auth system
    return undefined;
  }
}
```

### 3. Strapi-Style Webhook Configuration

```typescript
// libs/modules/webhook/strapi-webhook.service.ts
export interface StrapiStyleWebhookConfig {
  id: string;
  name: string;
  url: string;
  headers: Record<string, string>;
  events: string[]; // ['user.create', 'order.*', 'product.update']
  enabled: boolean;
  triggers: {
    [model: string]: {
      create?: boolean;
      update?: boolean;
      delete?: boolean;
      publish?: boolean;
      unpublish?: boolean;
    };
  };
}

export class StrapiStyleWebhookService {
  constructor(
    private db: TenantQueryBuilder,
    private lifecycleManager: LifecycleManager,
    private deliveryService: WebhookDeliveryService
  ) {}

  async createWebhook(tenantId: string, config: Omit<StrapiStyleWebhookConfig, 'id'>): Promise<StrapiStyleWebhookConfig> {
    const webhook = await this.db.table('webhook_endpoints').insert({
      id: uuidv4(),
      tenant_id: tenantId,
      name: config.name,
      url: config.url,
      headers: JSON.stringify(config.headers || {}),
      events: this.generateEventPatterns(config.triggers),
      enabled: config.enabled,
      triggers: JSON.stringify(config.triggers),
      created_at: new Date()
    }).returning('*');

    // Register lifecycle hooks for this webhook
    await this.registerWebhookHooks(webhook[0]);

    return this.mapToConfig(webhook[0]);
  }

  async updateWebhook(id: string, updates: Partial<StrapiStyleWebhookConfig>): Promise<StrapiStyleWebhookConfig | null> {
    const webhook = await this.db.table('webhook_endpoints')
      .where('id', id)
      .update({
        ...updates,
        headers: updates.headers ? JSON.stringify(updates.headers) : undefined,
        events: updates.triggers ? this.generateEventPatterns(updates.triggers) : undefined,
        triggers: updates.triggers ? JSON.stringify(updates.triggers) : undefined,
        updated_at: new Date()
      })
      .returning('*');

    if (webhook[0]) {
      // Re-register hooks with new configuration
      await this.unregisterWebhookHooks(id);
      await this.registerWebhookHooks(webhook[0]);
    }

    return webhook[0] ? this.mapToConfig(webhook[0]) : null;
  }

  private generateEventPatterns(triggers: StrapiStyleWebhookConfig['triggers']): string[] {
    const patterns: string[] = [];

    for (const [model, events] of Object.entries(triggers)) {
      for (const [event, enabled] of Object.entries(events)) {
        if (enabled) {
          patterns.push(`${model}.${event}`);
        }
      }
    }

    return patterns;
  }

  private async registerWebhookHooks(webhook: any): Promise<void> {
    const triggers = JSON.parse(webhook.triggers);

    for (const [model, events] of Object.entries(triggers)) {
      for (const [event, enabled] of Object.entries(events as any)) {
        if (enabled) {
          this.lifecycleManager.registerHook({
            event: event as LifecycleEvent,
            model,
            phase: 'after',
            handler: async (data, context) => {
              await this.triggerWebhook(webhook, model, event, data, context);
            }
          });
        }
      }
    }
  }

  private async triggerWebhook(
    webhook: any, 
    model: string, 
    event: string, 
    data: any, 
    context: LifecycleContext
  ): Promise<void> {
    if (!webhook.enabled) return;

    const payload = this.buildStrapiStylePayload(model, event, data, context);
    
    await this.deliveryService.queueDelivery({
      webhookId: webhook.id,
      url: webhook.url,
      headers: JSON.parse(webhook.headers || '{}'),
      payload,
      event: `${model}.${event}`,
      tenantId: context.tenantId
    });
  }

  private buildStrapiStylePayload(
    model: string, 
    event: string, 
    data: any, 
    context: LifecycleContext
  ): any {
    return {
      event: `${model}.${event}`,
      createdAt: context.timestamp.toISOString(),
      model,
      entry: data, // Strapi calls the data "entry"
      meta: {
        tenantId: context.tenantId,
        userId: context.userId
      }
    };
  }

  private mapToConfig(webhook: any): StrapiStyleWebhookConfig {
    return {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      headers: JSON.parse(webhook.headers || '{}'),
      events: webhook.events,
      enabled: webhook.enabled,
      triggers: JSON.parse(webhook.triggers || '{}')
    };
  }
}
```

### 4. Admin UI API Endpoints (Strapi-Style)

```typescript
// apps/api/src/routes/admin/webhooks.ts
export async function adminWebhookRoutes(fastify: FastifyInstance) {
  // List all webhooks (like Strapi admin)
  fastify.get('/admin/webhooks', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin')]
  }, async (request, reply) => {
    const webhooks = await fastify.strapiWebhookService.listWebhooks(request.tenant.id);
    
    return {
      data: webhooks,
      meta: {
        pagination: {
          total: webhooks.length
        }
      }
    };
  });

  // Create webhook
  fastify.post('/admin/webhooks', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin')],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'url'],
        properties: {
          name: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          headers: { type: 'object' },
          enabled: { type: 'boolean', default: true },
          triggers: {
            type: 'object',
            patternProperties: {
              '^[a-zA-Z_]+$': {
                type: 'object',
                properties: {
                  create: { type: 'boolean' },
                  update: { type: 'boolean' },
                  delete: { type: 'boolean' },
                  publish: { type: 'boolean' },
                  unpublish: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const webhook = await fastify.strapiWebhookService.createWebhook(
      request.tenant.id,
      request.body
    );
    
    return { data: webhook };
  });

  // Test webhook (like Strapi's trigger button)
  fastify.post('/admin/webhooks/:id/trigger', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin')]
  }, async (request, reply) => {
    const { id } = request.params;
    
    const result = await fastify.strapiWebhookService.testWebhook(id);
    
    return {
      data: result,
      statusCode: result.success ? 200 : 400
    };
  });

  // Get webhook deliveries (like Strapi's delivery log)
  fastify.get('/admin/webhooks/:id/deliveries', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin')]
  }, async (request, reply) => {
    const { id } = request.params;
    const { page = 1, pageSize = 25 } = request.query;
    
    const deliveries = await fastify.webhookDeliveryService.getDeliveries(id, {
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
    
    return {
      data: deliveries.data,
      meta: {
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: deliveries.total,
          pageCount: Math.ceil(deliveries.total / parseInt(pageSize))
        }
      }
    };
  });

  // Available events and models (for UI dropdown)
  fastify.get('/admin/webhooks/events', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin')]
  }, async (request, reply) => {
    const availableEvents = {
      user: ['create', 'update', 'delete'],
      order: ['create', 'update', 'delete', 'publish'],
      product: ['create', 'update', 'delete', 'publish', 'unpublish'],
      patient: ['create', 'update', 'delete'], // For HIS
      appointment: ['create', 'update', 'delete', 'confirm'], // For HIS
      invoice: ['create', 'update', 'delete', 'publish'] // For ERP
    };
    
    return { data: availableEvents };
  });
}
```

### 5. Frontend Admin UI (React/Angular Component Example)

```typescript
// Example React component for webhook management
export const WebhookManager: React.FC = () => {
  const [webhooks, setWebhooks] = useState<StrapiStyleWebhookConfig[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<StrapiStyleWebhookConfig | null>(null);
  const [availableEvents, setAvailableEvents] = useState<Record<string, string[]>>({});

  const handleCreateWebhook = async (data: any) => {
    const response = await fetch('/admin/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    setWebhooks([...webhooks, result.data]);
  };

  const handleTestWebhook = async (id: string) => {
    const response = await fetch(`/admin/webhooks/${id}/trigger`, {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.data.success) {
      toast.success('Webhook test successful!');
    } else {
      toast.error('Webhook test failed: ' + result.data.error);
    }
  };

  return (
    <div className="webhook-manager">
      <div className="webhook-list">
        <h2>Webhooks</h2>
        <button onClick={() => setSelectedWebhook({} as any)}>
          Add Webhook
        </button>
        
        {webhooks.map(webhook => (
          <div key={webhook.id} className="webhook-item">
            <h3>{webhook.name}</h3>
            <p>{webhook.url}</p>
            <div className="webhook-actions">
              <button onClick={() => setSelectedWebhook(webhook)}>
                Edit
              </button>
              <button onClick={() => handleTestWebhook(webhook.id)}>
                Test
              </button>
              <span className={`status ${webhook.enabled ? 'enabled' : 'disabled'}`}>
                {webhook.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedWebhook && (
        <WebhookForm 
          webhook={selectedWebhook}
          availableEvents={availableEvents}
          onSave={handleCreateWebhook}
          onCancel={() => setSelectedWebhook(null)}
        />
      )}
    </div>
  );
};

// Webhook configuration form
export const WebhookForm: React.FC<{
  webhook: StrapiStyleWebhookConfig;
  availableEvents: Record<string, string[]>;
  onSave: (data: any) => void;
  onCancel: () => void;
}> = ({ webhook, availableEvents, onSave, onCancel }) => {
  const [formData, setFormData] = useState(webhook);

  const handleTriggerChange = (model: string, event: string, enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      triggers: {
        ...prev.triggers,
        [model]: {
          ...prev.triggers[model],
          [event]: enabled
        }
      }
    }));
  };

  return (
    <div className="webhook-form">
      <h3>{webhook.id ? 'Edit' : 'Create'} Webhook</h3>
      
      <div className="form-group">
        <label>Name</label>
        <input 
          value={formData.name} 
          onChange={e => setFormData({...formData, name: e.target.value})}
        />
      </div>

      <div className="form-group">
        <label>URL</label>
        <input 
          type="url"
          value={formData.url} 
          onChange={e => setFormData({...formData, url: e.target.value})}
        />
      </div>

      <div className="form-group">
        <label>Events</label>
        <div className="events-grid">
          {Object.entries(availableEvents).map(([model, events]) => (
            <div key={model} className="model-events">
              <h4>{model}</h4>
              {events.map(event => (
                <label key={event}>
                  <input
                    type="checkbox"
                    checked={formData.triggers[model]?.[event] || false}
                    onChange={e => handleTriggerChange(model, event, e.target.checked)}
                  />
                  {event}
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="form-actions">
        <button onClick={() => onSave(formData)}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};
```

## Key Differences from Standard Implementation

### **Strapi Advantages:**
1. **Model-Centric** - Webhooks ผูกกับ data models
2. **Lifecycle Integration** - Auto-trigger บน CRUD operations
3. **Admin UI** - จัดการได้ง่ายผ่าน web interface
4. **Event Granularity** - เลือกได้ว่าต้องการ event ไหนบ้าง
5. **Visual Configuration** - ไม่ต้องเขียนโค้ด

### **Implementation Benefits:**
- **Developer Friendly** - ไม่ต้องจำ manual trigger
- **Consistent** - ทุก CRUD operation จะ trigger webhook
- **Manageable** - Admin สามารถจัดการได้เอง
- **Reliable** - Built-in retry และ delivery tracking

### **Use Cases ใน HIS/ERP:**
```typescript
// Hospital: Patient admission webhook
{
  triggers: {
    patient: { create: true },
    appointment: { create: true, update: true },
    prescription: { create: true }
  }
}

// ERP: Inventory management webhook  
{
  triggers: {
    product: { create: true, update: true },
    order: { create: true, update: true },
    inventory: { update: true }
  }
}
```

การ implement แบบ Strapi จะทำให้ระบบมีความยืดหยุ่นและใช้งานง่ายมากขึ้น โดยเฉพาะสำหรับ admin ที่ต้องการจัดการ integration โดยไม่ต้องพึ่งพา developer!
