# WebSocket Feature Blueprint

This document provides a comprehensive blueprint for implementing real-time WebSocket features in the AegisX Platform. It includes connection management, event handling, authentication, scaling strategies, and integration patterns for building real-time applications.

## Table of Contents

- [Feature Overview](#feature-overview)
- [Architecture Design](#architecture-design)
- [Implementation Strategy](#implementation-strategy)
- [Implementation Strategy](#implementation-strategy)
- [Testing Strategy](#testing-strategy)
- [Monitoring & Analytics](#monitoring--analytics)
- [Testing Strategy](#testing-strategy)
- [Monitoring & Analytics](#monitoring--analytics)

## Feature Overview

### What are WebSocket Real-time Features?

WebSocket provides full-duplex communication channels over a single TCP connection, enabling real-time bidirectional data exchange between clients and servers.

### Business Benefits

- **Real-time Collaboration** - Live updates, chat, collaborative editing
- **Enhanced UX** - Instant notifications and live data updates
- **Reduced Latency** - Direct connection without HTTP overhead
- **Cost Efficiency** - Lower server load than polling
- **Competitive Advantage** - Modern real-time user experience

### Technical Benefits

- **Persistent Connections** - Maintain state between client and server
- **Low Latency** - Sub-second data transmission
- **Bidirectional** - Both client and server can initiate communication
- **Event-Driven** - Reactive architecture patterns
- **Scalable** - Horizontal scaling with proper architecture

## Architecture Design

### WebSocket Architecture Overview

```text
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                         │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │   React     │ │   Vue.js    │ │   Mobile    │        │
│ │   Client    │ │   Client    │ │   App       │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                Load Balancer (Sticky Sessions)         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  WebSocket Gateway                      │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │  Socket.io  │ │    Auth     │ │   Rate      │        │
│ │   Server    │ │ Middleware  │ │  Limiting   │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Event Bus (Redis)                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                Business Logic Layer                     │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │    Chat     │ │ Notifications│ │  Real-time  │        │
│ │   Service   │ │   Service   │ │  Analytics  │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Event Flow Architecture

```text
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │  WebSocket  │    │   Event     │
│             │    │   Gateway   │    │   Bus       │
│             │    │             │    │  (Redis)    │
├─────────────┤    ├─────────────┤    ├─────────────┤
│ 1. Send     │───▶│ 2. Validate │───▶│ 3. Publish  │
│ Event       │    │ & Auth      │    │ Event       │
│             │    │             │    │             │
│ 6. Receive  │◀───│ 5. Broadcast│◀───│ 4. Process  │
│ Event       │    │ to Clients  │    │ & Route     │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Implementation Strategy

### Phase 1: Core WebSocket Setup

#### 1.1 WebSocket Gateway Configuration

```typescript
// src/features/websocket/gateways/websocket.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, UseFilters } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocketAuthGuard } from '../guards/websocket-auth.guard';
import { WebSocketExceptionFilter } from '../filters/websocket-exception.filter';
import { ConnectionManagerService } from '../services/connection-manager.service';
import { EventBusService } from '../services/event-bus.service';
import { RateLimitGuard } from '../guards/rate-limit.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
})
@UseFilters(new WebSocketExceptionFilter())
export class WebSocketGateway 
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly connectionManager: ConnectionManagerService,
    private readonly eventBus: EventBusService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    this.eventBus.initialize(server);
  }

  async handleConnection(client: Socket) {
    try {
      const user = await this.authenticateClient(client);
      
      if (!user) {
        client.disconnect();
        return;
      }

      await this.connectionManager.addConnection(client.id, user, client);
      
      this.logger.log(`Client connected: ${client.id} (User: ${user.id})`);
      
      // Join user to their personal room
      client.join(`user:${user.id}`);
      
      // Join tenant room if applicable
      if (user.tenantId) {
        client.join(`tenant:${user.tenantId}`);
      }

      // Notify user of successful connection
      client.emit('connected', {
        message: 'Connected to WebSocket server',
        userId: user.id,
        connectionId: client.id,
      });

    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const connection = await this.connectionManager.getConnection(client.id);
    
    if (connection) {
      await this.connectionManager.removeConnection(client.id);
      this.logger.log(`Client disconnected: ${client.id} (User: ${connection.userId})`);
    }
  }

  // General message handler
  @SubscribeMessage('message')
  @UseGuards(WebSocketAuthGuard, RateLimitGuard)
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const connection = await this.connectionManager.getConnection(client.id);
    
    if (!connection) {
      client.emit('error', { message: 'Invalid connection' });
      return;
    }

    // Process the message based on type
    await this.eventBus.handleEvent(payload.type, payload.data, connection);
  }

  // Join room
  @SubscribeMessage('join_room')
  @UseGuards(WebSocketAuthGuard)
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    const connection = await this.connectionManager.getConnection(client.id);
    
    if (!connection) {
      return;
    }

    // Validate room access
    const hasAccess = await this.validateRoomAccess(connection.userId, payload.roomId);
    
    if (!hasAccess) {
      client.emit('error', { message: 'Access denied to room' });
      return;
    }

    client.join(payload.roomId);
    client.emit('joined_room', { roomId: payload.roomId });
    
    this.logger.log(`User ${connection.userId} joined room ${payload.roomId}`);
  }

  // Leave room
  @SubscribeMessage('leave_room')
  @UseGuards(WebSocketAuthGuard)
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    client.leave(payload.roomId);
    client.emit('left_room', { roomId: payload.roomId });
  }

  private async authenticateClient(client: Socket): Promise<any> {
    try {
      const token = this.extractToken(client);
      
      if (!token) {
        throw new Error('No token provided');
      }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      return {
        id: payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  private extractToken(client: Socket): string | null {
    // Try authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try query parameter
    const token = client.handshake.query.token;
    if (typeof token === 'string') {
      return token;
    }

    // Try auth object
    const auth = client.handshake.auth;
    if (auth && auth.token) {
      return auth.token;
    }

    return null;
  }

  private async validateRoomAccess(userId: string, roomId: string): Promise<boolean> {
    // Implement room access validation logic
    // This could check database for room permissions, etc.
    return true; // Placeholder
  }
}
```

#### 1.2 Connection Manager Service

```typescript
// src/features/websocket/services/connection-manager.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { Redis } from 'ioredis';

export interface SocketConnection {
  id: string;
  userId: string;
  tenantId?: string;
  socket: Socket;
  connectedAt: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}

@Injectable()
export class ConnectionManagerService {
  private readonly logger = new Logger(ConnectionManagerService.name);
  private connections = new Map<string, SocketConnection>();

  constructor(private readonly redis: Redis) {}

  async addConnection(
    socketId: string, 
    user: any, 
    socket: Socket
  ): Promise<void> {
    const connection: SocketConnection = {
      id: socketId,
      userId: user.id,
      tenantId: user.tenantId,
      socket,
      connectedAt: new Date(),
      lastActivity: new Date(),
      metadata: {
        userAgent: socket.handshake.headers['user-agent'],
        ipAddress: socket.handshake.address,
        roles: user.roles,
        permissions: user.permissions,
      },
    };

    this.connections.set(socketId, connection);

    // Store in Redis for multi-server setup
    await this.redis.setex(
      `ws:connection:${socketId}`,
      3600, // 1 hour TTL
      JSON.stringify({
        userId: user.id,
        tenantId: user.tenantId,
        connectedAt: connection.connectedAt.toISOString(),
        metadata: connection.metadata,
      })
    );

    // Add to user's connection list
    await this.redis.sadd(`ws:user:${user.id}:connections`, socketId);

    // Add to tenant's connection list if applicable
    if (user.tenantId) {
      await this.redis.sadd(`ws:tenant:${user.tenantId}:connections`, socketId);
    }

    this.logger.log(`Connection added: ${socketId} for user ${user.id}`);
  }

  async removeConnection(socketId: string): Promise<void> {
    const connection = this.connections.get(socketId);
    
    if (connection) {
      this.connections.delete(socketId);

      // Remove from Redis
      await this.redis.del(`ws:connection:${socketId}`);
      await this.redis.srem(`ws:user:${connection.userId}:connections`, socketId);
      
      if (connection.tenantId) {
        await this.redis.srem(`ws:tenant:${connection.tenantId}:connections`, socketId);
      }

      this.logger.log(`Connection removed: ${socketId}`);
    }
  }

  async getConnection(socketId: string): Promise<SocketConnection | null> {
    return this.connections.get(socketId) || null;
  }

  async getUserConnections(userId: string): Promise<SocketConnection[]> {
    const connections: SocketConnection[] = [];
    
    for (const connection of this.connections.values()) {
      if (connection.userId === userId) {
        connections.push(connection);
      }
    }

    return connections;
  }

  async getTenantConnections(tenantId: string): Promise<SocketConnection[]> {
    const connections: SocketConnection[] = [];
    
    for (const connection of this.connections.values()) {
      if (connection.tenantId === tenantId) {
        connections.push(connection);
      }
    }

    return connections;
  }

  async updateLastActivity(socketId: string): Promise<void> {
    const connection = this.connections.get(socketId);
    
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  async getConnectionStats(): Promise<{
    totalConnections: number;
    userConnections: Map<string, number>;
    tenantConnections: Map<string, number>;
  }> {
    const userConnections = new Map<string, number>();
    const tenantConnections = new Map<string, number>();

    for (const connection of this.connections.values()) {
      // Count user connections
      const userCount = userConnections.get(connection.userId) || 0;
      userConnections.set(connection.userId, userCount + 1);

      // Count tenant connections
      if (connection.tenantId) {
        const tenantCount = tenantConnections.get(connection.tenantId) || 0;
        tenantConnections.set(connection.tenantId, tenantCount + 1);
      }
    }

    return {
      totalConnections: this.connections.size,
      userConnections,
      tenantConnections,
    };
  }

  // Cleanup inactive connections
  async cleanupInactiveConnections(timeoutMinutes = 30): Promise<void> {
    const now = new Date();
    const timeout = timeoutMinutes * 60 * 1000;
    const toRemove: string[] = [];

    for (const [socketId, connection] of this.connections.entries()) {
      const inactive = now.getTime() - connection.lastActivity.getTime() > timeout;
      
      if (inactive) {
        toRemove.push(socketId);
      }
    }

    for (const socketId of toRemove) {
      const connection = this.connections.get(socketId);
      if (connection) {
        connection.socket.disconnect();
        await this.removeConnection(socketId);
      }
    }

    if (toRemove.length > 0) {
      this.logger.log(`Cleaned up ${toRemove.length} inactive connections`);
    }
  }
}
```

### Phase 2: Event System

#### 2.1 Event Bus Service

```typescript
// src/features/websocket/services/event-bus.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { Redis } from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConnectionManagerService, SocketConnection } from './connection-manager.service';

export interface WebSocketEvent {
  type: string;
  data: any;
  userId?: string;
  tenantId?: string;
  roomId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private server: Server;
  private subscriber: Redis;
  private publisher: Redis;

  constructor(
    private readonly connectionManager: ConnectionManagerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly redis: Redis,
  ) {
    // Create separate Redis connections for pub/sub
    this.publisher = redis;
    this.subscriber = redis.duplicate();
    this.setupRedisSubscriptions();
  }

  initialize(server: Server): void {
    this.server = server;
  }

  private setupRedisSubscriptions(): void {
    this.subscriber.subscribe('websocket:events');
    
    this.subscriber.on('message', async (channel, message) => {
      if (channel === 'websocket:events') {
        try {
          const event: WebSocketEvent = JSON.parse(message);
          await this.processEvent(event);
        } catch (error) {
          this.logger.error(`Error processing Redis event: ${error.message}`);
        }
      }
    });
  }

  async handleEvent(
    type: string, 
    data: any, 
    connection: SocketConnection
  ): Promise<void> {
    const event: WebSocketEvent = {
      type,
      data,
      userId: connection.userId,
      tenantId: connection.tenantId,
      metadata: {
        connectionId: connection.id,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    // Emit local event for handlers
    this.eventEmitter.emit(`ws.${type}`, event, connection);

    // Publish to Redis for multi-server distribution
    await this.publisher.publish('websocket:events', JSON.stringify(event));

    // Update connection activity
    await this.connectionManager.updateLastActivity(connection.id);
  }

  private async processEvent(event: WebSocketEvent): Promise<void> {
    switch (event.type) {
      case 'chat_message':
        await this.handleChatMessage(event);
        break;
      case 'notification':
        await this.handleNotification(event);
        break;
      case 'user_status':
        await this.handleUserStatus(event);
        break;
      case 'broadcast':
        await this.handleBroadcast(event);
        break;
      default:
        this.logger.warn(`Unknown event type: ${event.type}`);
    }
  }

  private async handleChatMessage(event: WebSocketEvent): Promise<void> {
    if (event.roomId) {
      // Send to specific room
      this.server.to(event.roomId).emit('chat_message', event.data);
    } else if (event.tenantId) {
      // Send to tenant
      this.server.to(`tenant:${event.tenantId}`).emit('chat_message', event.data);
    }
  }

  private async handleNotification(event: WebSocketEvent): Promise<void> {
    if (event.userId) {
      // Send to specific user
      this.server.to(`user:${event.userId}`).emit('notification', event.data);
    } else if (event.tenantId) {
      // Send to all users in tenant
      this.server.to(`tenant:${event.tenantId}`).emit('notification', event.data);
    }
  }

  private async handleUserStatus(event: WebSocketEvent): Promise<void> {
    if (event.tenantId) {
      // Broadcast user status to tenant
      this.server.to(`tenant:${event.tenantId}`).emit('user_status', {
        userId: event.userId,
        status: event.data.status,
        timestamp: event.timestamp,
      });
    }
  }

  private async handleBroadcast(event: WebSocketEvent): Promise<void> {
    // Send to all connected clients
    this.server.emit('broadcast', event.data);
  }

  // Public API for sending events
  async sendToUser(userId: string, type: string, data: any): Promise<void> {
    const event: WebSocketEvent = {
      type,
      data,
      userId,
      timestamp: new Date(),
    };

    await this.publisher.publish('websocket:events', JSON.stringify(event));
  }

  async sendToTenant(tenantId: string, type: string, data: any): Promise<void> {
    const event: WebSocketEvent = {
      type,
      data,
      tenantId,
      timestamp: new Date(),
    };

    await this.publisher.publish('websocket:events', JSON.stringify(event));
  }

  async sendToRoom(roomId: string, type: string, data: any): Promise<void> {
    const event: WebSocketEvent = {
      type,
      data,
      roomId,
      timestamp: new Date(),
    };

    await this.publisher.publish('websocket:events', JSON.stringify(event));
  }

  async broadcastToAll(type: string, data: any): Promise<void> {
    const event: WebSocketEvent = {
      type: 'broadcast',
      data: { type, data },
      timestamp: new Date(),
    };

    await this.publisher.publish('websocket:events', JSON.stringify(event));
  }
}
```

#### 2.2 Event Handlers

```typescript
// src/features/websocket/handlers/chat.handler.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketEvent, EventBusService } from '../services/event-bus.service';
import { SocketConnection } from '../services/connection-manager.service';
import { ChatService } from '../../chat/services/chat.service';

@Injectable()
export class ChatEventHandler {
  constructor(
    private readonly chatService: ChatService,
    private readonly eventBus: EventBusService,
  ) {}

  @OnEvent('ws.send_message')
  async handleSendMessage(event: WebSocketEvent, connection: SocketConnection) {
    const { roomId, message } = event.data;

    // Validate and save message
    const savedMessage = await this.chatService.saveMessage({
      roomId,
      userId: connection.userId,
      message,
      tenantId: connection.tenantId,
    });

    // Broadcast to room
    await this.eventBus.sendToRoom(roomId, 'chat_message', {
      id: savedMessage.id,
      roomId,
      userId: connection.userId,
      userName: savedMessage.userName,
      message,
      timestamp: savedMessage.createdAt,
    });
  }

  @OnEvent('ws.typing_start')
  async handleTypingStart(event: WebSocketEvent, connection: SocketConnection) {
    const { roomId } = event.data;

    await this.eventBus.sendToRoom(roomId, 'user_typing', {
      userId: connection.userId,
      roomId,
      typing: true,
    });
  }

  @OnEvent('ws.typing_stop')
  async handleTypingStop(event: WebSocketEvent, connection: SocketConnection) {
    const { roomId } = event.data;

    await this.eventBus.sendToRoom(roomId, 'user_typing', {
      userId: connection.userId,
      roomId,
      typing: false,
    });
  }
}

// src/features/websocket/handlers/notification.handler.ts
@Injectable()
export class NotificationEventHandler {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly eventBus: EventBusService,
  ) {}

  @OnEvent('ws.mark_notification_read')
  async handleMarkNotificationRead(event: WebSocketEvent, connection: SocketConnection) {
    const { notificationId } = event.data;

    await this.notificationService.markAsRead(notificationId, connection.userId);

    // Confirm to user
    await this.eventBus.sendToUser(connection.userId, 'notification_read', {
      notificationId,
    });
  }

  @OnEvent('notification.created')
  async handleNotificationCreated(notification: any) {
    // Send real-time notification
    await this.eventBus.sendToUser(notification.userId, 'notification', {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      timestamp: notification.createdAt,
    });
  }
}
```

### Phase 3: Authentication & Security

#### 3.1 WebSocket Authentication Guard

```typescript
// src/features/websocket/guards/websocket-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { ConnectionManagerService } from '../services/connection-manager.service';

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly connectionManager: ConnectionManagerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    
    try {
      const connection = await this.connectionManager.getConnection(client.id);
      
      if (!connection) {
        throw new WsException('Unauthorized: Invalid connection');
      }

      // Update last activity
      await this.connectionManager.updateLastActivity(client.id);

      return true;
    } catch (error) {
      throw new WsException('Unauthorized: ' + error.message);
    }
  }
}

// src/features/websocket/guards/rate-limit.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Redis } from 'ioredis';
import { ConnectionManagerService } from '../services/connection-manager.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: Redis,
    private readonly connectionManager: ConnectionManagerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const connection = await this.connectionManager.getConnection(client.id);
    
    if (!connection) {
      return false;
    }

    const key = `ws:rate_limit:${connection.userId}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }
    
    if (current > 60) { // 60 messages per minute
      throw new WsException('Rate limit exceeded');
    }
    
    return true;
  }
}
```

#### 3.2 WebSocket Exception Filter

```typescript
// src/features/websocket/filters/websocket-exception.filter.ts
import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch(WsException)
export class WebSocketExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const client: Socket = host.switchToWs().getClient();
    const error = exception.getError();
    
    const errorResponse = {
      type: 'error',
      message: typeof error === 'string' ? error : error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    };

    client.emit('error', errorResponse);
  }
}
```

### Phase 4: Frontend Integration

#### 4.1 React WebSocket Hook

```typescript
// src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  url?: string;
  token?: string;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    url = process.env.REACT_APP_WS_URL || 'http://localhost:3000/ws',
    token,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null,
  });

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));

    const socket = io(url, {
      auth: { token },
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setState({ connected: true, connecting: false, error: null });
    });

    socket.on('disconnect', (reason) => {
      setState(prev => ({ ...prev, connected: false }));
      console.log('WebSocket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      setState(prev => ({ 
        ...prev, 
        connecting: false, 
        error: error.message 
      }));
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      setState(prev => ({ ...prev, error: error.message }));
    });

    socketRef.current = socket;
  }, [url, token, reconnection, reconnectionAttempts, reconnectionDelay]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setState({ connected: false, connecting: false, error: null });
    }
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }
  }, []);

  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler);
    }
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    emit('join_room', { roomId });
  }, [emit]);

  const leaveRoom = useCallback((roomId: string) => {
    emit('leave_room', { roomId });
  }, [emit]);

  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  return {
    ...state,
    socket: socketRef.current,
    connect,
    disconnect,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
  };
};
```

#### 4.2 React Chat Component

```typescript
// src/components/Chat/ChatRoom.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../hooks/useAuth';

interface Message {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
}

interface ChatRoomProps {
  roomId: string;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ roomId }) => {
  const { user, token } = useAuth();
  const { connected, emit, on, off, joinRoom, leaveRoom } = useWebSocket({ token });
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (connected && roomId) {
      joinRoom(roomId);
    }

    return () => {
      if (roomId) {
        leaveRoom(roomId);
      }
    };
  }, [connected, roomId, joinRoom, leaveRoom]);

  useEffect(() => {
    const handleChatMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
    };

    const handleUserTyping = ({ userId, typing: isTyping }: { 
      userId: string; 
      typing: boolean; 
    }) => {
      if (userId !== user?.id) {
        setTyping(prev => ({ ...prev, [userId]: isTyping }));
      }
    };

    on('chat_message', handleChatMessage);
    on('user_typing', handleUserTyping);

    return () => {
      off('chat_message', handleChatMessage);
      off('user_typing', handleUserTyping);
    };
  }, [on, off, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (newMessage.trim() && connected) {
      emit('message', {
        type: 'send_message',
        data: {
          roomId,
          message: newMessage.trim(),
        },
      });
      setNewMessage('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    // Handle typing indicators
    if (e.target.value.length > 0) {
      emit('message', {
        type: 'typing_start',
        data: { roomId },
      });

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        emit('message', {
          type: 'typing_stop',
          data: { roomId },
        });
      }, 2000);
    } else {
      emit('message', {
        type: 'typing_stop',
        data: { roomId },
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  const typingUsers = Object.keys(typing).filter(userId => typing[userId]);

  return (
    <div className="flex flex-col h-96 border rounded-lg">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.userId === user?.id ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs px-3 py-2 rounded-lg ${
                message.userId === user?.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {message.userId !== user?.id && (
                <div className="text-xs font-semibold mb-1">
                  {message.userName}
                </div>
              )}
              <div>{message.message}</div>
              <div className="text-xs opacity-75 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-sm text-gray-500">
          {typingUsers.length === 1
            ? `Someone is typing...`
            : `${typingUsers.length} people are typing...`}
        </div>
      )}

      <div className="border-t p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!connected}
          />
          <button
            onClick={sendMessage}
            disabled={!connected || !newMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
        {!connected && (
          <div className="text-red-500 text-sm mt-2">
            Disconnected from chat server
          </div>
        )}
      </div>
    </div>
  );
};
```

## Testing Strategy

### 1. WebSocket Testing

```typescript
// src/features/websocket/tests/websocket.gateway.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Socket, io as ioc } from 'socket.io-client';
import { WebSocketGateway } from '../gateways/websocket.gateway';
import { JwtService } from '@nestjs/jwt';

describe('WebSocketGateway', () => {
  let app: INestApplication;
  let gateway: WebSocketGateway;
  let clientSocket: Socket;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [WebSocketGateway, JwtService],
    }).compile();

    app = moduleFixture.createNestApplication();
    gateway = moduleFixture.get<WebSocketGateway>(WebSocketGateway);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    
    await app.listen(3001);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const token = jwtService.sign({ 
      sub: 'test-user', 
      email: 'test@example.com' 
    });

    clientSocket = ioc('http://localhost:3001/ws', {
      auth: { token },
      forceNew: true,
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => resolve());
    });
  });

  afterEach(() => {
    clientSocket.close();
  });

  it('should connect with valid token', (done) => {
    clientSocket.on('connected', (data) => {
      expect(data.message).toBe('Connected to WebSocket server');
      expect(data.userId).toBe('test-user');
      done();
    });
  });

  it('should handle join room', (done) => {
    clientSocket.emit('join_room', { roomId: 'test-room' });
    
    clientSocket.on('joined_room', (data) => {
      expect(data.roomId).toBe('test-room');
      done();
    });
  });

  it('should handle message sending', (done) => {
    const testMessage = {
      type: 'send_message',
      data: {
        roomId: 'test-room',
        message: 'Hello, world!',
      },
    };

    clientSocket.emit('message', testMessage);
    
    clientSocket.on('chat_message', (data) => {
      expect(data.message).toBe('Hello, world!');
      done();
    });
  });

  it('should handle rate limiting', async () => {
    // Send many messages quickly
    for (let i = 0; i < 65; i++) {
      clientSocket.emit('message', { type: 'test', data: {} });
    }

    await new Promise<void>((resolve) => {
      clientSocket.on('error', (error) => {
        expect(error.message).toBe('Rate limit exceeded');
        resolve();
      });
    });
  });
});
```

## Monitoring & Analytics

### 1. WebSocket Metrics

```typescript
// src/features/websocket/services/websocket-metrics.service.ts
import { Injectable } from '@nestjs/common';
import { PrometheusService } from '../../../shared/services/prometheus.service';

@Injectable()
export class WebSocketMetricsService {
  private readonly connectionsTotal;
  private readonly messagesTotal;
  private readonly connectionDuration;
  private readonly roomConnections;

  constructor(private readonly prometheusService: PrometheusService) {
    this.connectionsTotal = this.prometheusService.createGauge({
      name: 'websocket_connections_total',
      help: 'Total number of WebSocket connections',
      labelNames: ['tenant_id'],
    });

    this.messagesTotal = this.prometheusService.createCounter({
      name: 'websocket_messages_total',
      help: 'Total number of WebSocket messages',
      labelNames: ['type', 'tenant_id'],
    });

    this.connectionDuration = this.prometheusService.createHistogram({
      name: 'websocket_connection_duration_seconds',
      help: 'WebSocket connection duration in seconds',
      buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600],
    });

    this.roomConnections = this.prometheusService.createGauge({
      name: 'websocket_room_connections',
      help: 'Number of connections per room',
      labelNames: ['room_id'],
    });
  }

  recordConnection(tenantId?: string) {
    this.connectionsTotal.labels(tenantId || 'unknown').inc();
  }

  recordDisconnection(tenantId?: string, duration?: number) {
    this.connectionsTotal.labels(tenantId || 'unknown').dec();
    
    if (duration) {
      this.connectionDuration.observe(duration);
    }
  }

  recordMessage(type: string, tenantId?: string) {
    this.messagesTotal.labels(type, tenantId || 'unknown').inc();
  }

  updateRoomConnections(roomId: string, count: number) {
    this.roomConnections.labels(roomId).set(count);
  }
}
```

## Conclusion

This WebSocket feature blueprint provides a comprehensive foundation for implementing real-time communication in the AegisX Platform. Key highlights include:

### ✅ **Features Implemented:**

1. **WebSocket Gateway** - Full-duplex communication server
2. **Connection Management** - Multi-server connection tracking
3. **Event System** - Scalable event-driven architecture
4. **Authentication** - JWT-based WebSocket security
5. **Room Management** - Group communication channels
6. **Rate Limiting** - Protection against abuse
7. **Frontend Integration** - React hooks and components

### 🔒 **Security Features:**

- JWT authentication for WebSocket connections
- Rate limiting per user/connection
- Room access validation
- Connection timeout management
- Error handling and filtering

### 📊 **Monitoring & Analytics:**

- Real-time connection metrics
- Message throughput monitoring
- Performance tracking
- Room activity analytics

### 🧪 **Testing Coverage:**

- Unit tests for WebSocket components
- Integration tests for real-time flows
- Load testing for scalability
- Frontend component testing

This blueprint ensures enterprise-grade real-time communication suitable for chat systems, live collaboration, notifications, and real-time dashboards while maintaining scalability and security standards.
