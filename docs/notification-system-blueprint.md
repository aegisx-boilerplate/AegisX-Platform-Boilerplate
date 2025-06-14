# Notification System Feature Blueprint

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Email Service](#email-service)
- [SMS Service](#sms-service)
- [Push Notifications](#push-notifications)
- [In-App Notifications](#in-app-notifications)
- [Template Management](#template-management)
- [Delivery Tracking](#delivery-tracking)
- [Testing Strategy](#testing-strategy)
- [Monitoring & Analytics](#monitoring--analytics)
- [Troubleshooting](#troubleshooting)

## Overview

### Purpose

Comprehensive notification system สำหรับ AegisX Platform ที่รองรับการส่งข้อความผ่านหลายช่องทาง (email, SMS, push notifications, in-app) พร้อมด้วย template management และ delivery tracking

### Key Features

- **Multi-channel Delivery** - Email, SMS, Push, In-app notifications
- **Template Management** - Dynamic templates with variables
- **Delivery Tracking** - Real-time delivery status และ analytics
- **Queue Management** - Reliable delivery with retry mechanisms
- **Tenant Isolation** - Per-tenant notification settings
- **Preference Management** - User notification preferences
- **Rate Limiting** - Prevent spam และ abuse

### Business Value

- เพิ่ม user engagement ด้วย timely notifications
- ลดการพลาดข้อมูลสำคัญ (security alerts, billing)
- ปรับปรุง user experience ด้วย real-time updates
- รองรับ compliance requirements (audit trails)

## Architecture

### System Overview

```text
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Trigger   │───▶│ Notification    │───▶│   Delivery      │
│   Events    │    │    Engine       │    │   Channels      │
└─────────────┘    └─────────────────┘    └─────────────────┘
                           │                        │
                           ▼                        ▼
                   ┌─────────────────┐    ┌─────────────────┐
                   │   Template      │    │   Tracking &    │
                   │   Manager       │    │   Analytics     │
                   └─────────────────┘    └─────────────────┘
```

### Core Components

- **Notification Engine** - Central orchestration
- **Channel Providers** - Email/SMS/Push/In-app handlers
- **Template Manager** - Dynamic template rendering
- **Queue Manager** - Reliable delivery with retries
- **Preference Manager** - User notification settings
- **Analytics Engine** - Delivery tracking และ metrics

### Database Schema

```typescript
// Notification Templates
interface NotificationTemplate {
  id: string;
  tenantId: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'in_app';
  subject?: string; // For email
  htmlContent?: string; // For email
  textContent: string;
  variables: string[]; // Available template variables
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Notification Queue
interface NotificationJob {
  id: string;
  tenantId: string;
  templateId: string;
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: 'email' | 'sms' | 'push' | 'in_app';
  variables: Record<string, any>;
  priority: number;
  scheduledAt?: Date;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  sentAt?: Date;
  createdAt: Date;
}

// User Preferences
interface NotificationPreference {
  id: string;
  userId: string;
  tenantId: string;
  notificationType: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
  };
  updatedAt: Date;
}
```

## Email Service

### SMTP Configuration

```typescript
// src/features/notifications/services/email.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { TemplateService } from './template.service';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private templateService: TemplateService,
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const config = this.configService.get('email');
    
    this.transporter = nodemailer.createTransporter({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.username,
        pass: config.smtp.password,
      },
      pool: true,
      maxConnections: 10,
      maxMessages: 100,
    });
  }

  async sendEmail(params: {
    tenantId: string;
    templateId: string;
    to: string;
    variables: Record<string, any>;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType?: string;
    }>;
  }): Promise<{ messageId: string; status: 'sent' | 'failed'; error?: string }> {
    try {
      const template = await this.templateService.getTemplate(
        params.tenantId,
        params.templateId
      );

      if (!template || template.type !== 'email') {
        throw new Error('Email template not found');
      }

      const renderedTemplate = await this.templateService.renderTemplate(
        template,
        params.variables
      );

      const mailOptions = {
        from: this.getFromAddress(params.tenantId),
        to: params.to,
        subject: renderedTemplate.subject,
        html: renderedTemplate.htmlContent,
        text: renderedTemplate.textContent,
        attachments: params.attachments,
        headers: {
          'X-Tenant-ID': params.tenantId,
          'X-Template-ID': params.templateId,
        },
      };

      const result = await this.transporter.sendMail(mailOptions);

      return {
        messageId: result.messageId,
        status: 'sent',
      };
    } catch (error) {
      return {
        messageId: '',
        status: 'failed',
        error: error.message,
      };
    }
  }

  private getFromAddress(tenantId: string): string {
    // Get tenant-specific from address or use default
    const tenantConfig = this.configService.get(`tenants.${tenantId}.email`);
    return tenantConfig?.fromAddress || this.configService.get('email.defaultFrom');
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}
```

### Email Templates

```typescript
// src/features/notifications/templates/email/welcome.template.ts
export const welcomeEmailTemplate = {
  name: 'welcome_email',
  type: 'email' as const,
  subject: 'Welcome to {{platformName}}, {{firstName}}!',
  htmlContent: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome</title>
      <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .button { background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to {{platformName}}</h1>
        </div>
        <div class="content">
          <p>Hello {{firstName}},</p>
          <p>Welcome to {{platformName}}! We're excited to have you on board.</p>
          <p>To get started, please verify your email address:</p>
          <p style="text-align: center;">
            <a href="{{verificationUrl}}" class="button">Verify Email</a>
          </p>
          <p>If you have any questions, feel free to contact our support team.</p>
          <p>Best regards,<br>The {{platformName}} Team</p>
        </div>
      </div>
    </body>
    </html>
  `,
  textContent: `
    Welcome to {{platformName}}, {{firstName}}!
    
    We're excited to have you on board.
    
    To get started, please verify your email address by visiting:
    {{verificationUrl}}
    
    If you have any questions, feel free to contact our support team.
    
    Best regards,
    The {{platformName}} Team
  `,
  variables: ['platformName', 'firstName', 'verificationUrl'],
};
```

## SMS Service

### SMS Provider Integration

```typescript
// src/features/notifications/services/sms.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  private twilioClient: Twilio;

  constructor(private configService: ConfigService) {
    const config = this.configService.get('sms.twilio');
    this.twilioClient = new Twilio(config.accountSid, config.authToken);
  }

  async sendSms(params: {
    tenantId: string;
    templateId: string;
    to: string;
    variables: Record<string, any>;
  }): Promise<{ messageId: string; status: 'sent' | 'failed'; error?: string }> {
    try {
      const template = await this.templateService.getTemplate(
        params.tenantId,
        params.templateId
      );

      if (!template || template.type !== 'sms') {
        throw new Error('SMS template not found');
      }

      const renderedContent = await this.templateService.renderTemplate(
        template,
        params.variables
      );

      const message = await this.twilioClient.messages.create({
        body: renderedContent.textContent,
        from: this.getFromNumber(params.tenantId),
        to: params.to,
      });

      return {
        messageId: message.sid,
        status: 'sent',
      };
    } catch (error) {
      return {
        messageId: '',
        status: 'failed',
        error: error.message,
      };
    }
  }

  private getFromNumber(tenantId: string): string {
    const tenantConfig = this.configService.get(`tenants.${tenantId}.sms`);
    return tenantConfig?.fromNumber || this.configService.get('sms.defaultFrom');
  }
}
```

## Push Notifications

### Firebase Cloud Messaging (FCM)

```typescript
// src/features/notifications/services/push.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class PushService {
  constructor(private configService: ConfigService) {
    const serviceAccount = this.configService.get('push.firebase.serviceAccount');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  async sendPushNotification(params: {
    tenantId: string;
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    imageUrl?: string;
  }): Promise<{ messageId: string; status: 'sent' | 'failed'; error?: string }> {
    try {
      // Get user's device tokens
      const deviceTokens = await this.getUserDeviceTokens(params.userId);

      if (deviceTokens.length === 0) {
        return {
          messageId: '',
          status: 'failed',
          error: 'No device tokens found for user',
        };
      }

      const message = {
        notification: {
          title: params.title,
          body: params.body,
          imageUrl: params.imageUrl,
        },
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          ...params.data,
        },
        tokens: deviceTokens,
        android: {
          notification: {
            channelId: 'default',
            priority: 'high' as const,
          },
        },
        apns: {
          payload: {
            aps: {
              badge: await this.getUserUnreadCount(params.userId),
            },
          },
        },
      };

      const response = await admin.messaging().sendMulticast(message);

      return {
        messageId: `batch_${Date.now()}`,
        status: response.failureCount === 0 ? 'sent' : 'failed',
        error: response.failureCount > 0 ? `${response.failureCount} failures` : undefined,
      };
    } catch (error) {
      return {
        messageId: '',
        status: 'failed',
        error: error.message,
      };
    }
  }

  private async getUserDeviceTokens(userId: string): Promise<string[]> {
    // Implement database query to get user's device tokens
    // Return array of FCM tokens
    return [];
  }

  private async getUserUnreadCount(userId: string): Promise<number> {
    // Implement database query to get user's unread notification count
    return 0;
  }
}
```

## In-App Notifications

### WebSocket Integration

```typescript
// src/features/notifications/services/in-app.service.ts
import { Injectable } from '@nestjs/common';
import { WebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class InAppNotificationService {
  constructor(private websocketGateway: WebSocketGateway) {}

  async sendInAppNotification(params: {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    actionUrl?: string;
  }): Promise<{ messageId: string; status: 'sent' | 'failed'; error?: string }> {
    try {
      const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data,
        actionUrl: params.actionUrl,
        timestamp: new Date().toISOString(),
        read: false,
      };

      // Store in database for persistence
      await this.storeNotification(params.tenantId, params.userId, notification);

      // Send via WebSocket if user is online
      await this.websocketGateway.sendToUser(params.userId, 'notification', notification);

      return {
        messageId: notification.id,
        status: 'sent',
      };
    } catch (error) {
      return {
        messageId: '',
        status: 'failed',
        error: error.message,
      };
    }
  }

  private async storeNotification(
    tenantId: string,
    userId: string,
    notification: any
  ): Promise<void> {
    // Implement database storage
    // Store notification for later retrieval
  }
}
```

## Template Management

### Dynamic Template Engine

```typescript
// src/features/notifications/services/template.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplate } from '../entities/notification-template.entity';
import * as Handlebars from 'handlebars';

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private templateRepository: Repository<NotificationTemplate>,
  ) {
    this.registerHelpers();
  }

  async getTemplate(tenantId: string, templateId: string): Promise<NotificationTemplate | null> {
    return this.templateRepository.findOne({
      where: { id: templateId, tenantId, isActive: true },
    });
  }

  async renderTemplate(
    template: NotificationTemplate,
    variables: Record<string, any>
  ): Promise<{
    subject?: string;
    htmlContent?: string;
    textContent: string;
  }> {
    const context = {
      ...variables,
      timestamp: new Date().toISOString(),
      year: new Date().getFullYear(),
    };

    const result: any = {
      textContent: this.compileTemplate(template.textContent, context),
    };

    if (template.subject) {
      result.subject = this.compileTemplate(template.subject, context);
    }

    if (template.htmlContent) {
      result.htmlContent = this.compileTemplate(template.htmlContent, context);
    }

    return result;
  }

  private compileTemplate(templateString: string, context: Record<string, any>): string {
    const template = Handlebars.compile(templateString);
    return template(context);
  }

  private registerHelpers(): void {
    Handlebars.registerHelper('formatDate', (date, format) => {
      // Implement date formatting
      return new Date(date).toLocaleDateString();
    });

    Handlebars.registerHelper('formatCurrency', (amount, currency) => {
      // Implement currency formatting
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(amount);
    });

    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });
  }
}
```

## Delivery Tracking

### Notification Analytics

```typescript
// src/features/notifications/services/analytics.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationJob } from '../entities/notification-job.entity';

@Injectable()
export class NotificationAnalyticsService {
  constructor(
    @InjectRepository(NotificationJob)
    private jobRepository: Repository<NotificationJob>,
  ) {}

  async getDeliveryStats(tenantId: string, period: 'day' | 'week' | 'month') {
    const startDate = this.getStartDate(period);

    const stats = await this.jobRepository
      .createQueryBuilder('job')
      .select([
        'job.channel',
        'job.status',
        'COUNT(*) as count',
        'AVG(CASE WHEN job.sentAt IS NOT NULL THEN EXTRACT(epoch FROM (job.sentAt - job.createdAt)) END) as avgDeliveryTime',
      ])
      .where('job.tenantId = :tenantId', { tenantId })
      .andWhere('job.createdAt >= :startDate', { startDate })
      .groupBy('job.channel, job.status')
      .getRawMany();

    return this.formatStats(stats);
  }

  async getFailureAnalysis(tenantId: string, period: 'day' | 'week' | 'month') {
    const startDate = this.getStartDate(period);

    return this.jobRepository
      .createQueryBuilder('job')
      .select([
        'job.lastError',
        'COUNT(*) as count',
        'job.channel',
      ])
      .where('job.tenantId = :tenantId', { tenantId })
      .andWhere('job.status = :status', { status: 'failed' })
      .andWhere('job.createdAt >= :startDate', { startDate })
      .groupBy('job.lastError, job.channel')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();
  }

  private getStartDate(period: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private formatStats(rawStats: any[]): any {
    const formatted = {
      byChannel: {},
      byStatus: {},
      overall: {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
        avgDeliveryTime: 0,
      },
    };

    for (const stat of rawStats) {
      const channel = stat.job_channel;
      const status = stat.job_status;
      const count = parseInt(stat.count);

      if (!formatted.byChannel[channel]) {
        formatted.byChannel[channel] = { total: 0, sent: 0, failed: 0, pending: 0 };
      }

      formatted.byChannel[channel][status] = count;
      formatted.byChannel[channel].total += count;
      formatted.overall[status] += count;
      formatted.overall.total += count;

      if (stat.avgdeliverytime && status === 'sent') {
        formatted.overall.avgDeliveryTime = parseFloat(stat.avgdeliverytime);
      }
    }

    return formatted;
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// src/features/notifications/services/email.service.spec.ts
describe('EmailService', () => {
  let service: EmailService;
  let templateService: jest.Mocked<TemplateService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: TemplateService,
          useValue: {
            getTemplate: jest.fn(),
            renderTemplate: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              smtp: {
                host: 'smtp.test.com',
                port: 587,
                secure: false,
                username: 'test',
                password: 'test',
              },
              defaultFrom: 'test@example.com',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    templateService = module.get(TemplateService);
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      templateService.getTemplate.mockResolvedValue({
        id: 'test-template',
        type: 'email',
        subject: 'Test Subject',
        htmlContent: '<h1>Test</h1>',
        textContent: 'Test',
      } as any);

      templateService.renderTemplate.mockResolvedValue({
        subject: 'Test Subject',
        htmlContent: '<h1>Test</h1>',
        textContent: 'Test',
      });

      const result = await service.sendEmail({
        tenantId: 'tenant-1',
        templateId: 'test-template',
        to: 'test@example.com',
        variables: { name: 'Test User' },
      });

      expect(result.status).toBe('sent');
      expect(result.messageId).toBeDefined();
    });
  });
});
```

## Monitoring & Analytics

### Health Checks

```typescript
// src/features/notifications/health/notification.health.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { EmailService } from '../services/email.service';

@Injectable()
export class NotificationHealthIndicator extends HealthIndicator {
  constructor(private emailService: EmailService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const isHealthy = await this.emailService.verifyConnection();

    const result = this.getStatus(key, isHealthy);

    if (isHealthy) {
      return result;
    }

    throw new HealthCheckError('Notification service failed', result);
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Email Delivery Failures

```bash
# Check SMTP connection
curl -v telnet://smtp.gmail.com:587

# Verify DNS settings
nslookup smtp.gmail.com

# Check authentication
echo -n 'username' | base64
echo -n 'password' | base64
```

#### 2. SMS Delivery Issues

```typescript
// Debug SMS service
const smsDebug = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN ? '***' : 'missing',
  fromNumber: process.env.TWILIO_FROM_NUMBER,
};

console.log('SMS Configuration:', smsDebug);
```

#### 3. Push Notification Problems

```typescript
// Verify FCM setup
const fcmDebug = {
  serviceAccountExists: !!process.env.FIREBASE_SERVICE_ACCOUNT,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

console.log('FCM Configuration:', fcmDebug);
```

### Error Handling

```typescript
// Centralized error handling
export class NotificationErrorHandler {
  static handleEmailError(error: any): string {
    if (error.code === 'EAUTH') {
      return 'SMTP authentication failed';
    } else if (error.code === 'ECONNECTION') {
      return 'SMTP connection failed';
    } else if (error.responseCode === 550) {
      return 'Recipient email address rejected';
    }
    return 'Unknown email error';
  }

  static handleSmsError(error: any): string {
    if (error.code === 21211) {
      return 'Invalid phone number';
    } else if (error.code === 21614) {
      return 'Invalid sender number';
    }
    return 'Unknown SMS error';
  }
}
```
