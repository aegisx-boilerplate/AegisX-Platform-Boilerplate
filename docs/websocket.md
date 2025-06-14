# WebSocket Implementation Guide

## Overview

This guide covers implementing real-time communication features using WebSocket in AegisX Platform, supporting multi-tenant environments and event-driven architecture.

## Architecture

### Core Components

1. **Connection Manager**: Manages WebSocket connections per tenant/user
2. **Event Bus**: Publishes and subscribes to real-time events
3. **Channel System**: Organizes connections by topics/rooms
4. **Authentication**: Secures WebSocket connections
5. **Scaling**: Redis-based pub/sub for multi-instance support

## Implementation

### WebSocket Plugin Setup

```typescript
// libs/plugins/fastify-websocket/index.ts
import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import fp from 'fastify-plugin';

export default fp(async function websocketPlugin(fastify: FastifyInstance) {
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
      idleTimeout: 120000,  // 2 minutes
      verifyClient: (info) => {
        // Optional: verify client before upgrade
        return true;
      }
    }
  });

  // Register WebSocket routes
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, async (connection, request) => {
      const handler = new WebSocketHandler(connection, request, fastify);
      await handler.initialize();
    });

    fastify.get('/ws/admin', { 
      websocket: true,
      preHandler: [fastify.authenticate, fastify.requireRole('admin')]
    }, async (connection, request) => {
      const handler = new AdminWebSocketHandler(connection, request, fastify);
      await handler.initialize();
    });
  });
});
```

### Connection Manager

```typescript
// libs/core/websocket/connection-manager.ts
import { WebSocket } from 'ws';
import Redis from 'ioredis';

export interface WebSocketConnection {
  id: string;
  socket: WebSocket;
  userId?: string;
  tenantId: string;
  channels: Set<string>;
  metadata: Record<string, any>;
  lastPing: Date;
}

export class ConnectionManager {
  private connections = new Map<string, WebSocketConnection>();
  private userConnections = new Map<string, Set<string>>(); // userId -> connection ids
  private tenantConnections = new Map<string, Set<string>>(); // tenantId -> connection ids
  private channelConnections = new Map<string, Set<string>>(); // channel -> connection ids

  constructor(private redis: Redis) {
    this.setupCleanup();
    this.setupRedisSubscriber();
  }

  addConnection(connection: WebSocketConnection): void {
    this.connections.set(connection.id, connection);

    // Track by tenant
    if (!this.tenantConnections.has(connection.tenantId)) {
      this.tenantConnections.set(connection.tenantId, new Set());
    }
    this.tenantConnections.get(connection.tenantId)!.add(connection.id);

    // Track by user
    if (connection.userId) {
      if (!this.userConnections.has(connection.userId)) {
        this.userConnections.set(connection.userId, new Set());
      }
      this.userConnections.get(connection.userId)!.add(connection.id);
    }

    console.log(`Connection ${connection.id} added for tenant ${connection.tenantId}`);
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from tenant tracking
    this.tenantConnections.get(connection.tenantId)?.delete(connectionId);

    // Remove from user tracking
    if (connection.userId) {
      this.userConnections.get(connection.userId)?.delete(connectionId);
    }

    // Remove from channel tracking
    connection.channels.forEach(channel => {
      this.channelConnections.get(channel)?.delete(connectionId);
    });

    this.connections.delete(connectionId);
    console.log(`Connection ${connectionId} removed`);
  }

  joinChannel(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    // Add to connection's channels
    connection.channels.add(channel);

    // Track channel membership
    if (!this.channelConnections.has(channel)) {
      this.channelConnections.set(channel, new Set());
    }
    this.channelConnections.get(channel)!.add(connectionId);

    return true;
  }

  leaveChannel(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    connection.channels.delete(channel);
    this.channelConnections.get(channel)?.delete(connectionId);

    return true;
  }

  // Send to specific connection
  sendToConnection(connectionId: string, message: any): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Failed to send message to ${connectionId}:`, error);
      this.removeConnection(connectionId);
      return false;
    }
  }

  // Broadcast to all connections in a tenant
  broadcastToTenant(tenantId: string, message: any, excludeConnectionId?: string): number {
    const connectionIds = this.tenantConnections.get(tenantId);
    if (!connectionIds) return 0;

    let sent = 0;
    for (const connectionId of connectionIds) {
      if (excludeConnectionId && connectionId === excludeConnectionId) continue;
      if (this.sendToConnection(connectionId, message)) {
        sent++;
      }
    }

    return sent;
  }

  // Broadcast to specific channel
  broadcastToChannel(channel: string, message: any, excludeConnectionId?: string): number {
    const connectionIds = this.channelConnections.get(channel);
    if (!connectionIds) return 0;

    let sent = 0;
    for (const connectionId of connectionIds) {
      if (excludeConnectionId && connectionId === excludeConnectionId) continue;
      if (this.sendToConnection(connectionId, message)) {
        sent++;
      }
    }

    return sent;
  }

  // Send to specific user (all their connections)
  sendToUser(userId: string, tenantId: string, message: any): number {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) return 0;

    let sent = 0;
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      if (connection && connection.tenantId === tenantId) {
        if (this.sendToConnection(connectionId, message)) {
          sent++;
        }
      }
    }

    return sent;
  }

  getConnectionStats(): {
    total: number;
    byTenant: Record<string, number>;
    byChannel: Record<string, number>;
  } {
    return {
      total: this.connections.size,
      byTenant: Object.fromEntries(
        Array.from(this.tenantConnections.entries()).map(([tenantId, connections]) => [
          tenantId,
          connections.size
        ])
      ),
      byChannel: Object.fromEntries(
        Array.from(this.channelConnections.entries()).map(([channel, connections]) => [
          channel,
          connections.size
        ])
      )
    };
  }

  private setupCleanup(): void {
    // Cleanup inactive connections every 30 seconds
    setInterval(() => {
      const now = new Date();
      const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [connectionId, connection] of this.connections) {
        if (now.getTime() - connection.lastPing.getTime() > inactiveThreshold) {
          console.log(`Removing inactive connection ${connectionId}`);
          this.removeConnection(connectionId);
        }
      }
    }, 30000);
  }

  private setupRedisSubscriber(): void {
    // Subscribe to Redis for cross-instance communication
    const subscriber = this.redis.duplicate();
    
    subscriber.subscribe('ws:broadcast', 'ws:tenant', 'ws:channel', 'ws:user');
    
    subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        
        switch (channel) {
          case 'ws:broadcast':
            this.handleBroadcastMessage(data);
            break;
          case 'ws:tenant':
            this.handleTenantMessage(data);
            break;
          case 'ws:channel':
            this.handleChannelMessage(data);
            break;
          case 'ws:user':
            this.handleUserMessage(data);
            break;
        }
      } catch (error) {
        console.error('Failed to process Redis message:', error);
      }
    });
  }

  private handleBroadcastMessage(data: any): void {
    for (const connectionId of this.connections.keys()) {
      this.sendToConnection(connectionId, data.message);
    }
  }

  private handleTenantMessage(data: { tenantId: string; message: any }): void {
    this.broadcastToTenant(data.tenantId, data.message);
  }

  private handleChannelMessage(data: { channel: string; message: any }): void {
    this.broadcastToChannel(data.channel, data.message);
  }

  private handleUserMessage(data: { userId: string; tenantId: string; message: any }): void {
    this.sendToUser(data.userId, data.tenantId, data.message);
  }
}
```

### WebSocket Handler

```typescript
// libs/core/websocket/ws-handler.ts
import { SocketStream } from '@fastify/websocket';
import { FastifyRequest, FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

export class WebSocketHandler {
  private connectionId: string;
  private connection: WebSocketConnection;

  constructor(
    private socket: SocketStream,
    private request: FastifyRequest,
    private fastify: FastifyInstance
  ) {
    this.connectionId = uuidv4();
  }

  async initialize(): Promise<void> {
    try {
      // Authenticate the connection
      const { user, tenant } = await this.authenticate();

      // Create connection object
      this.connection = {
        id: this.connectionId,
        socket: this.socket.socket,
        userId: user?.id,
        tenantId: tenant.id,
        channels: new Set(),
        metadata: {
          userAgent: this.request.headers['user-agent'],
          ip: this.request.ip
        },
        lastPing: new Date()
      };

      // Add to connection manager
      this.fastify.connectionManager.addConnection(this.connection);

      // Setup event handlers
      this.setupEventHandlers();

      // Send welcome message
      this.send({
        type: 'connection',
        data: {
          connectionId: this.connectionId,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`WebSocket connection established: ${this.connectionId}`);
    } catch (error) {
      console.error('WebSocket initialization failed:', error);
      this.socket.socket.close(1000, 'Authentication failed');
    }
  }

  private async authenticate(): Promise<{ user?: any; tenant: any }> {
    // Extract token from query, header, or cookie
    const token = 
      this.request.query.token ||
      this.request.headers.authorization?.replace('Bearer ', '') ||
      this.request.cookies?.token;

    if (!token) {
      throw new Error('No authentication token provided');
    }

    try {
      const decoded = this.fastify.jwt.verify(token) as any;
      const user = await this.fastify.userService.findById(decoded.userId);
      const tenant = await this.fastify.tenantService.findById(decoded.tenantId);

      if (!tenant || tenant.status !== 'active') {
        throw new Error('Invalid or inactive tenant');
      }

      return { user, tenant };
    } catch (error) {
      throw new Error('Invalid authentication token');
    }
  }

  private setupEventHandlers(): void {
    this.socket.socket.on('message', (data) => {
      this.handleMessage(data);
    });

    this.socket.socket.on('ping', () => {
      this.connection.lastPing = new Date();
      this.socket.socket.pong();
    });

    this.socket.socket.on('close', () => {
      this.handleClose();
    });

    this.socket.socket.on('error', (error) => {
      console.error(`WebSocket error for ${this.connectionId}:`, error);
      this.handleClose();
    });
  }

  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      this.processMessage(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.sendError('Invalid message format');
    }
  }

  private async processMessage(message: any): Promise<void> {
    const { type, data } = message;

    switch (type) {
      case 'ping':
        this.send({ type: 'pong', data: { timestamp: new Date().toISOString() } });
        break;

      case 'join_channel':
        await this.handleJoinChannel(data.channel);
        break;

      case 'leave_channel':
        await this.handleLeaveChannel(data.channel);
        break;

      case 'send_message':
        await this.handleSendMessage(data);
        break;

      case 'subscribe_notifications':
        await this.handleSubscribeNotifications(data);
        break;

      default:
        this.sendError(`Unknown message type: ${type}`);
    }
  }

  private async handleJoinChannel(channel: string): Promise<void> {
    // Validate channel access
    if (!await this.canAccessChannel(channel)) {
      this.sendError('Access denied to channel');
      return;
    }

    const success = this.fastify.connectionManager.joinChannel(this.connectionId, channel);
    
    if (success) {
      this.send({
        type: 'channel_joined',
        data: { channel }
      });
    } else {
      this.sendError('Failed to join channel');
    }
  }

  private async handleLeaveChannel(channel: string): Promise<void> {
    const success = this.fastify.connectionManager.leaveChannel(this.connectionId, channel);
    
    if (success) {
      this.send({
        type: 'channel_left',
        data: { channel }
      });
    }
  }

  private async handleSendMessage(data: any): Promise<void> {
    const { channel, message } = data;

    // Validate permissions
    if (!await this.canSendToChannel(channel)) {
      this.sendError('Permission denied');
      return;
    }

    // Broadcast message
    const messageData = {
      type: 'channel_message',
      data: {
        channel,
        message,
        sender: {
          id: this.connection.userId,
          connectionId: this.connectionId
        },
        timestamp: new Date().toISOString()
      }
    };

    this.fastify.connectionManager.broadcastToChannel(
      channel, 
      messageData, 
      this.connectionId
    );

    // Store message if needed
    await this.storeMessage(channel, message);
  }

  private async handleSubscribeNotifications(data: any): Promise<void> {
    const { types } = data;
    
    // Subscribe to user's notification channels
    for (const notificationType of types) {
      const channel = `notifications:${this.connection.tenantId}:${this.connection.userId}:${notificationType}`;
      this.fastify.connectionManager.joinChannel(this.connectionId, channel);
    }

    this.send({
      type: 'notifications_subscribed',
      data: { types }
    });
  }

  private async canAccessChannel(channel: string): Promise<boolean> {
    // Implement channel access control logic
    // Check user permissions, tenant isolation, etc.
    
    if (channel.startsWith(`tenant:${this.connection.tenantId}`)) {
      return true;
    }

    if (channel.startsWith('public:')) {
      return true;
    }

    // Check user-specific permissions
    return false;
  }

  private async canSendToChannel(channel: string): Promise<boolean> {
    // Similar to canAccessChannel but for sending messages
    return this.canAccessChannel(channel);
  }

  private async storeMessage(channel: string, message: any): Promise<void> {
    // Store message in database if needed for chat history
    // Implementation depends on your requirements
  }

  private send(message: any): void {
    this.fastify.connectionManager.sendToConnection(this.connectionId, message);
  }

  private sendError(error: string): void {
    this.send({
      type: 'error',
      data: { error }
    });
  }

  private handleClose(): void {
    this.fastify.connectionManager.removeConnection(this.connectionId);
    console.log(`WebSocket connection closed: ${this.connectionId}`);
  }
}
```

### Event Bus for Cross-Service Communication

```typescript
// libs/core/websocket/event-bus.ts
import Redis from 'ioredis';

export interface WSEvent {
  type: string;
  tenantId: string;
  userId?: string;
  channel?: string;
  data: any;
  timestamp: Date;
}

export class WebSocketEventBus {
  constructor(private redis: Redis) {}

  // Send notification to specific user
  async notifyUser(tenantId: string, userId: string, notification: any): Promise<void> {
    const event: WSEvent = {
      type: 'user_notification',
      tenantId,
      userId,
      data: notification,
      timestamp: new Date()
    };

    await this.redis.publish('ws:user', JSON.stringify({
      userId,
      tenantId,
      message: {
        type: 'notification',
        data: notification
      }
    }));
  }

  // Broadcast to entire tenant
  async broadcastToTenant(tenantId: string, message: any): Promise<void> {
    await this.redis.publish('ws:tenant', JSON.stringify({
      tenantId,
      message
    }));
  }

  // Send to specific channel
  async sendToChannel(channel: string, message: any): Promise<void> {
    await this.redis.publish('ws:channel', JSON.stringify({
      channel,
      message
    }));
  }

  // Global broadcast (admin only)
  async globalBroadcast(message: any): Promise<void> {
    await this.redis.publish('ws:broadcast', JSON.stringify({
      message
    }));
  }
}
```

### Integration with Business Logic

```typescript
// Example: User service integration
export class UserService {
  constructor(
    private eventBus: WebSocketEventBus
  ) {}

  async createUser(tenantId: string, userData: any): Promise<User> {
    const user = await this.userRepository.create(userData);

    // Notify all admin users in the tenant
    await this.eventBus.sendToChannel(
      `tenant:${tenantId}:admin`,
      {
        type: 'user_created',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        }
      }
    );

    return user;
  }

  async updateUserStatus(tenantId: string, userId: string, status: string): Promise<void> {
    await this.userRepository.updateStatus(userId, status);

    // Notify the user about status change
    await this.eventBus.notifyUser(tenantId, userId, {
      type: 'status_updated',
      data: { status }
    });
  }
}
```

## Usage Examples

### Frontend Integration

```javascript
// Frontend WebSocket client
class WebSocketClient {
  constructor(token, tenantId) {
    this.token = token;
    this.tenantId = tenantId;
    this.callbacks = new Map();
  }

  connect() {
    const wsUrl = `ws://localhost:3000/ws?token=${this.token}`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('Connected to WebSocket');
      this.joinChannel(`tenant:${this.tenantId}:general`);
    };

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.socket.onclose = () => {
      console.log('WebSocket connection closed');
      // Implement reconnection logic
    };
  }

  joinChannel(channel) {
    this.send({
      type: 'join_channel',
      data: { channel }
    });
  }

  subscribeToNotifications(types = ['all']) {
    this.send({
      type: 'subscribe_notifications',
      data: { types }
    });
  }

  sendMessage(channel, message) {
    this.send({
      type: 'send_message',
      data: { channel, message }
    });
  }

  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  send(message) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  handleMessage(message) {
    const { type, data } = message;
    const callbacks = this.callbacks.get(type) || [];
    callbacks.forEach(callback => callback(data));
  }
}

// Usage
const wsClient = new WebSocketClient(authToken, tenantId);

wsClient.on('notification', (data) => {
  showNotification(data);
});

wsClient.on('channel_message', (data) => {
  displayMessage(data.channel, data.message);
});

wsClient.connect();
```

## Security Considerations

1. **Authentication**: Always authenticate WebSocket connections
2. **Channel Access Control**: Implement proper authorization for channels
3. **Rate Limiting**: Prevent message spam and DoS attacks
4. **Data Validation**: Validate all incoming messages
5. **Tenant Isolation**: Ensure messages don't leak between tenants
6. **Connection Limits**: Implement per-user/tenant connection limits

## Performance Optimization

1. **Connection Pooling**: Manage connection lifecycle efficiently
2. **Message Batching**: Batch multiple small messages
3. **Compression**: Use WebSocket compression for large messages
4. **Horizontal Scaling**: Use Redis pub/sub for multi-instance deployments
5. **Memory Management**: Clean up inactive connections and data
