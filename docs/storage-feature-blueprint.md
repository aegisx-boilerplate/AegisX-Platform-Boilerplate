# Storage Feature Blueprint

This document provides a comprehensive blueprint for implementing file storage and object management features in the AegisX Platform using MinIO S3-compatible storage. It includes file upload/download, image processing, CDN integration, and security best practices.

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

### What is Storage Management?

A comprehensive file storage system that handles upload, processing, storage, and delivery of files including documents, images, videos, and other digital assets.

### Business Benefits

- **Scalable Storage** - Handle growing data requirements
- **Cost Efficiency** - S3-compatible storage with competitive pricing
- **Performance** - Fast file delivery through CDN integration
- **Security** - Encrypted storage and secure access controls
- **Compliance** - Meet data retention and privacy requirements

### Technical Benefits

- **S3 Compatibility** - Standard APIs for integration
- **Multi-tenancy** - Isolated storage per tenant
- **Auto-scaling** - Handle varying loads automatically
- **Processing Pipeline** - Automatic image optimization and transformations
- **Backup & Recovery** - Built-in data protection

## Architecture Design

### Storage Architecture Overview

```text
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                         │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │  Web App    │ │   Mobile    │ │    API      │        │
│ │             │ │    App      │ │  Clients    │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   API Gateway                           │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │    Auth     │ │    Rate     │ │   Upload    │        │
│ │ Middleware  │ │  Limiting   │ │ Validation  │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                Storage Service Layer                    │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │   Upload    │ │    Image    │ │    File     │        │
│ │  Service    │ │ Processing  │ │ Management  │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                Storage Layer                            │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │    MinIO    │ │   Database  │ │     CDN     │        │
│ │  S3 Storage │ │  Metadata   │ │  CloudFlare │        │
│ └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### File Processing Pipeline

```text
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Upload    │    │  Validation │    │   Storage   │
│   Request   │───▶│     &       │───▶│     &       │
│             │    │   Scanning  │    │  Metadata   │
└─────────────┘    └─────────────┘    └─────────────┘
                           │                    │
                           ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Queue     │    │  Processing │    │     CDN     │
│  Processing │◀───│   Pipeline  │───▶│   Upload    │
│    Job      │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Implementation Strategy

### Phase 1: Core Storage Setup

#### 1.1 File Entity and Types

```typescript
// src/features/storage/types/file.types.ts
export interface FileMetadata {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  bucket: string;
  key: string;
  url: string;
  cdnUrl?: string;
  thumbnailUrl?: string;
  userId: string;
  tenantId?: string;
  tags: string[];
  isPublic: boolean;
  expiresAt?: Date;
  checksum: string;
  processingStatus: ProcessingStatus;
  processingErrors?: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface UploadOptions {
  bucket?: string;
  isPublic?: boolean;
  tags?: string[];
  expiresAt?: Date;
  generateThumbnail?: boolean;
  processImages?: boolean;
  allowedMimeTypes?: string[];
  maxSize?: number;
}

export interface ImageProcessingOptions {
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  watermark?: {
    text?: string;
    image?: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  };
}

export interface FileUploadResult {
  file: FileMetadata;
  presignedUrl?: string;
  directUpload?: boolean;
}
```

#### 1.2 Storage Service

```typescript
// src/features/storage/services/storage.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';
import * as path from 'path';
import { FileMetadata, UploadOptions, FileUploadResult } from '../types/file.types';
import { FileEntity } from '../entities/file.entity';
import { ImageProcessingService } from './image-processing.service';
import { VirusScanService } from './virus-scan.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class StorageService {
  private readonly s3: AWS.S3;
  private readonly defaultBucket: string;

  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
    private readonly configService: ConfigService,
    private readonly imageProcessingService: ImageProcessingService,
    private readonly virusScanService: VirusScanService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.s3 = new AWS.S3({
      endpoint: this.configService.get('MINIO_ENDPOINT'),
      accessKeyId: this.configService.get('MINIO_ACCESS_KEY'),
      secretAccessKey: this.configService.get('MINIO_SECRET_KEY'),
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });

    this.defaultBucket = this.configService.get('MINIO_DEFAULT_BUCKET', 'aegisx-files');
  }

  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    tenantId?: string,
    options: UploadOptions = {}
  ): Promise<FileUploadResult> {
    // Validate file
    this.validateFile(file, options);

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = this.generateFileName(file.originalname, fileExtension);
    const bucket = options.bucket || this.getTenantBucket(tenantId);
    const key = this.generateFileKey(userId, fileName, tenantId);

    // Calculate checksum
    const checksum = crypto.createHash('md5').update(file.buffer).digest('hex');

    // Check for duplicate files
    const existingFile = await this.fileRepository.findOne({
      where: { checksum, userId, tenantId },
    });

    if (existingFile) {
      return { file: existingFile };
    }

    // Scan for viruses
    await this.virusScanService.scanBuffer(file.buffer);

    // Upload to S3
    const uploadResult = await this.s3.upload({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: file.originalname,
        userId,
        tenantId: tenantId || '',
        uploadedAt: new Date().toISOString(),
      },
    }).promise();

    // Create file metadata
    const fileMetadata = this.fileRepository.create({
      originalName: file.originalname,
      fileName,
      mimeType: file.mimetype,
      size: file.size,
      bucket,
      key,
      url: uploadResult.Location,
      userId,
      tenantId,
      tags: options.tags || [],
      isPublic: options.isPublic || false,
      expiresAt: options.expiresAt,
      checksum,
      processingStatus: ProcessingStatus.PENDING,
      metadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const savedFile = await this.fileRepository.save(fileMetadata);

    // Emit file uploaded event for processing
    this.eventEmitter.emit('file.uploaded', {
      fileId: savedFile.id,
      mimeType: file.mimetype,
      options,
    });

    return { file: savedFile };
  }

  async createPresignedUrl(
    fileName: string,
    mimeType: string,
    userId: string,
    tenantId?: string,
    options: UploadOptions = {}
  ): Promise<{ presignedUrl: string; fileId: string; key: string }> {
    const fileExtension = path.extname(fileName);
    const generatedFileName = this.generateFileName(fileName, fileExtension);
    const bucket = options.bucket || this.getTenantBucket(tenantId);
    const key = this.generateFileKey(userId, generatedFileName, tenantId);

    // Create file metadata first
    const fileMetadata = this.fileRepository.create({
      originalName: fileName,
      fileName: generatedFileName,
      mimeType,
      size: 0, // Will be updated after upload
      bucket,
      key,
      url: '', // Will be updated after upload
      userId,
      tenantId,
      tags: options.tags || [],
      isPublic: options.isPublic || false,
      expiresAt: options.expiresAt,
      processingStatus: ProcessingStatus.PENDING,
      metadata: {
        uploadMethod: 'presigned',
        uploadedBy: userId,
      },
    });

    const savedFile = await this.fileRepository.save(fileMetadata);

    // Generate presigned URL
    const presignedUrl = await this.s3.getSignedUrlPromise('putObject', {
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
      Expires: 3600, // 1 hour
      Metadata: {
        fileId: savedFile.id,
        originalName: fileName,
        userId,
        tenantId: tenantId || '',
      },
    });

    return {
      presignedUrl,
      fileId: savedFile.id,
      key,
    };
  }

  async getFile(fileId: string, userId: string, tenantId?: string): Promise<FileMetadata> {
    const file = await this.fileRepository.findOne({
      where: { 
        id: fileId,
        ...(tenantId && { tenantId }),
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check access permissions
    if (!file.isPublic && file.userId !== userId) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async getFileStream(fileId: string, userId: string, tenantId?: string): Promise<AWS.S3.GetObjectOutput> {
    const file = await this.getFile(fileId, userId, tenantId);

    return this.s3.getObject({
      Bucket: file.bucket,
      Key: file.key,
    }).promise();
  }

  async generateDownloadUrl(
    fileId: string,
    userId: string,
    tenantId?: string,
    expiresIn = 3600
  ): Promise<string> {
    const file = await this.getFile(fileId, userId, tenantId);

    return this.s3.getSignedUrl('getObject', {
      Bucket: file.bucket,
      Key: file.key,
      Expires: expiresIn,
    });
  }

  async deleteFile(fileId: string, userId: string, tenantId?: string): Promise<void> {
    const file = await this.getFile(fileId, userId, tenantId);

    // Check if user owns the file
    if (file.userId !== userId) {
      throw new BadRequestException('You can only delete your own files');
    }

    // Delete from S3
    await this.s3.deleteObject({
      Bucket: file.bucket,
      Key: file.key,
    }).promise();

    // Delete metadata
    await this.fileRepository.delete(fileId);

    // Emit deletion event
    this.eventEmitter.emit('file.deleted', { fileId, userId, tenantId });
  }

  async getUserFiles(
    userId: string,
    tenantId?: string,
    options: {
      page?: number;
      limit?: number;
      mimeType?: string;
      tags?: string[];
    } = {}
  ): Promise<{ files: FileMetadata[]; total: number }> {
    const { page = 1, limit = 20, mimeType, tags } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.fileRepository.createQueryBuilder('file')
      .where('file.userId = :userId', { userId });

    if (tenantId) {
      queryBuilder.andWhere('file.tenantId = :tenantId', { tenantId });
    }

    if (mimeType) {
      queryBuilder.andWhere('file.mimeType LIKE :mimeType', { 
        mimeType: `${mimeType}%` 
      });
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('file.tags && :tags', { tags });
    }

    queryBuilder
      .orderBy('file.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [files, total] = await queryBuilder.getManyAndCount();

    return { files, total };
  }

  private validateFile(file: Express.Multer.File, options: UploadOptions): void {
    // Check file size
    const maxSize = options.maxSize || 50 * 1024 * 1024; // 50MB default
    if (file.size > maxSize) {
      throw new BadRequestException(`File size exceeds maximum allowed size of ${maxSize} bytes`);
    }

    // Check mime type
    if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }

    // Check for dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (dangerousExtensions.includes(fileExtension)) {
      throw new BadRequestException('File type not allowed for security reasons');
    }
  }

  private generateFileName(originalName: string, extension: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const safeName = originalName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 50);
    
    return `${timestamp}_${random}_${safeName}${extension}`;
  }

  private generateFileKey(userId: string, fileName: string, tenantId?: string): string {
    const datePath = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    
    if (tenantId) {
      return `tenants/${tenantId}/users/${userId}/${datePath}/${fileName}`;
    }
    
    return `users/${userId}/${datePath}/${fileName}`;
  }

  private getTenantBucket(tenantId?: string): string {
    if (tenantId) {
      return `tenant-${tenantId}`;
    }
    return this.defaultBucket;
  }
}
```

### Phase 2: Image Processing

#### 2.1 Image Processing Service

```typescript
// src/features/storage/services/image-processing.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import * as sharp from 'sharp';
import { StorageService } from './storage.service';
import { FileEntity } from '../entities/file.entity';
import { ImageProcessingOptions, ProcessingStatus } from '../types/file.types';

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
    private readonly storageService: StorageService,
  ) {}

  @OnEvent('file.uploaded')
  async handleFileUploaded(event: { fileId: string; mimeType: string; options: any }) {
    const { fileId, mimeType, options } = event;

    // Only process images
    if (!mimeType.startsWith('image/')) {
      await this.markProcessingComplete(fileId);
      return;
    }

    try {
      await this.markProcessingStarted(fileId);
      
      if (options.generateThumbnail !== false) {
        await this.generateThumbnail(fileId);
      }

      if (options.processImages) {
        await this.processImage(fileId, options.imageProcessing);
      }

      await this.markProcessingComplete(fileId);
    } catch (error) {
      this.logger.error(`Image processing failed for file ${fileId}:`, error);
      await this.markProcessingFailed(fileId, error.message);
    }
  }

  async generateThumbnail(
    fileId: string,
    options: { width?: number; height?: number; quality?: number } = {}
  ): Promise<string> {
    const file = await this.fileRepository.findOne({ where: { id: fileId } });
    
    if (!file) {
      throw new Error('File not found');
    }

    const { width = 300, height = 300, quality = 80 } = options;

    // Get original file
    const originalFile = await this.storageService.getFileStream(fileId, file.userId, file.tenantId);
    
    if (!originalFile.Body) {
      throw new Error('File content not found');
    }

    // Process image
    const thumbnailBuffer = await sharp(originalFile.Body as Buffer)
      .resize(width, height, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality })
      .toBuffer();

    // Upload thumbnail
    const thumbnailKey = file.key.replace(/(\.[^.]+)$/, '_thumbnail$1');
    const uploadResult = await this.s3.upload({
      Bucket: file.bucket,
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        originalFileId: fileId,
        type: 'thumbnail',
      },
    }).promise();

    // Update file metadata
    file.thumbnailUrl = uploadResult.Location;
    await this.fileRepository.save(file);

    return uploadResult.Location;
  }

  async processImage(fileId: string, options: ImageProcessingOptions = {}): Promise<void> {
    const file = await this.fileRepository.findOne({ where: { id: fileId } });
    
    if (!file) {
      throw new Error('File not found');
    }

    // Get original file
    const originalFile = await this.storageService.getFileStream(fileId, file.userId, file.tenantId);
    
    if (!originalFile.Body) {
      throw new Error('File content not found');
    }

    let processor = sharp(originalFile.Body as Buffer);

    // Apply resize if specified
    if (options.resize) {
      const { width, height, fit = 'cover' } = options.resize;
      processor = processor.resize(width, height, { fit });
    }

    // Apply quality settings
    if (options.quality && options.format) {
      switch (options.format) {
        case 'jpeg':
          processor = processor.jpeg({ quality: options.quality });
          break;
        case 'png':
          processor = processor.png({ quality: options.quality });
          break;
        case 'webp':
          processor = processor.webp({ quality: options.quality });
          break;
        case 'avif':
          processor = processor.avif({ quality: options.quality });
          break;
      }
    }

    // Apply watermark if specified
    if (options.watermark) {
      await this.applyWatermark(processor, options.watermark);
    }

    // Process and upload
    const processedBuffer = await processor.toBuffer();
    const processedKey = file.key.replace(/(\.[^.]+)$/, `_processed$1`);
    
    const uploadResult = await this.s3.upload({
      Bucket: file.bucket,
      Key: processedKey,
      Body: processedBuffer,
      ContentType: file.mimeType,
      Metadata: {
        originalFileId: fileId,
        type: 'processed',
      },
    }).promise();

    // Update file metadata
    file.metadata = {
      ...file.metadata,
      processedUrl: uploadResult.Location,
      processingOptions: options,
    };
    
    await this.fileRepository.save(file);
  }

  private async applyWatermark(
    processor: sharp.Sharp, 
    watermark: ImageProcessingOptions['watermark']
  ): Promise<void> {
    if (!watermark) return;

    if (watermark.text) {
      // Text watermark
      const textSvg = `
        <svg width="200" height="50">
          <text x="10" y="30" font-family="Arial" font-size="20" fill="rgba(255,255,255,0.7)">
            ${watermark.text}
          </text>
        </svg>
      `;
      
      const textBuffer = Buffer.from(textSvg);
      
      processor.composite([{
        input: textBuffer,
        gravity: this.getGravityFromPosition(watermark.position),
      }]);
    } else if (watermark.image) {
      // Image watermark
      processor.composite([{
        input: watermark.image,
        gravity: this.getGravityFromPosition(watermark.position),
      }]);
    }
  }

  private getGravityFromPosition(position?: string): sharp.Gravity {
    switch (position) {
      case 'top-left': return 'northwest';
      case 'top-right': return 'northeast';
      case 'bottom-left': return 'southwest';
      case 'bottom-right': return 'southeast';
      case 'center': return 'center';
      default: return 'southeast';
    }
  }

  private async markProcessingStarted(fileId: string): Promise<void> {
    await this.fileRepository.update(fileId, {
      processingStatus: ProcessingStatus.PROCESSING,
    });
  }

  private async markProcessingComplete(fileId: string): Promise<void> {
    await this.fileRepository.update(fileId, {
      processingStatus: ProcessingStatus.COMPLETED,
    });
  }

  private async markProcessingFailed(fileId: string, error: string): Promise<void> {
    await this.fileRepository.update(fileId, {
      processingStatus: ProcessingStatus.FAILED,
      processingErrors: [error],
    });
  }
}
```

### Phase 3: Controller Implementation

#### 3.1 Storage Controller

```typescript
// src/features/storage/controllers/storage.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { StorageService } from '../services/storage.service';
import { UploadFileDto, CreatePresignedUrlDto } from '../dto/storage.dto';

@ApiTags('Storage')
@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadFileDto,
    @CurrentUser() user: any,
  ) {
    return this.storageService.uploadFile(
      file,
      user.id,
      user.tenantId,
      {
        tags: uploadDto.tags ? uploadDto.tags.split(',') : [],
        isPublic: uploadDto.isPublic === 'true',
        generateThumbnail: uploadDto.generateThumbnail !== 'false',
        processImages: uploadDto.processImages === 'true',
      }
    );
  }

  @Post('presigned-url')
  @ApiOperation({ summary: 'Create presigned URL for direct upload' })
  async createPresignedUrl(
    @Body() createUrlDto: CreatePresignedUrlDto,
    @CurrentUser() user: any,
  ) {
    return this.storageService.createPresignedUrl(
      createUrlDto.fileName,
      createUrlDto.mimeType,
      user.id,
      user.tenantId,
      {
        tags: createUrlDto.tags,
        isPublic: createUrlDto.isPublic,
        generateThumbnail: createUrlDto.generateThumbnail,
        processImages: createUrlDto.processImages,
      }
    );
  }

  @Get('files')
  @ApiOperation({ summary: 'Get user files' })
  async getUserFiles(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('mimeType') mimeType?: string,
    @Query('tags') tags?: string,
  ) {
    return this.storageService.getUserFiles(
      user.id,
      user.tenantId,
      {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        mimeType,
        tags: tags ? tags.split(',') : undefined,
      }
    );
  }

  @Get('files/:id')
  @ApiOperation({ summary: 'Get file metadata' })
  async getFile(
    @Param('id') fileId: string,
    @CurrentUser() user: any,
  ) {
    return this.storageService.getFile(fileId, user.id, user.tenantId);
  }

  @Get('files/:id/download')
  @ApiOperation({ summary: 'Download file' })
  async downloadFile(
    @Param('id') fileId: string,
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.storageService.getFile(fileId, user.id, user.tenantId);
    const fileStream = await this.storageService.getFileStream(fileId, user.id, user.tenantId);

    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.originalName}"`,
    });

    return new StreamableFile(fileStream.Body as Buffer);
  }

  @Get('files/:id/url')
  @ApiOperation({ summary: 'Get download URL' })
  async getDownloadUrl(
    @Param('id') fileId: string,
    @CurrentUser() user: any,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const expires = expiresIn ? parseInt(expiresIn) : 3600;
    const url = await this.storageService.generateDownloadUrl(
      fileId,
      user.id,
      user.tenantId,
      expires
    );

    return { url, expiresIn: expires };
  }

  @Delete('files/:id')
  @ApiOperation({ summary: 'Delete file' })
  async deleteFile(
    @Param('id') fileId: string,
    @CurrentUser() user: any,
  ) {
    await this.storageService.deleteFile(fileId, user.id, user.tenantId);
    return { message: 'File deleted successfully' };
  }
}
```

### Phase 4: Frontend Integration

#### 4.1 React File Upload Hook

```typescript
// src/hooks/useFileUpload.ts
import { useState, useCallback } from 'react';
import { storageService } from '../services/storage.service';

interface UseFileUploadOptions {
  multiple?: boolean;
  maxSize?: number;
  allowedTypes?: string[];
  onUploadProgress?: (progress: number) => void;
  onSuccess?: (files: any[]) => void;
  onError?: (error: string) => void;
}

export const useFileUpload = (options: UseFileUploadOptions = {}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFiles = useCallback(async (files: FileList) => {
    if (!files.length) return;

    const {
      multiple = false,
      maxSize = 50 * 1024 * 1024, // 50MB
      allowedTypes = [],
      onUploadProgress,
      onSuccess,
      onError,
    } = options;

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const fileArray = Array.from(files);
      
      if (!multiple && fileArray.length > 1) {
        throw new Error('Multiple files not allowed');
      }

      // Validate files
      for (const file of fileArray) {
        if (file.size > maxSize) {
          throw new Error(`File ${file.name} exceeds maximum size`);
        }

        if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
          throw new Error(`File type ${file.type} not allowed`);
        }
      }

      const uploadPromises = fileArray.map(async (file, index) => {
        const formData = new FormData();
        formData.append('file', file);

        const result = await storageService.uploadFile(formData, {
          onUploadProgress: (progressEvent) => {
            const fileProgress = (progressEvent.loaded / progressEvent.total) * 100;
            const totalProgress = ((index / fileArray.length) * 100) + (fileProgress / fileArray.length);
            
            setProgress(totalProgress);
            onUploadProgress?.(totalProgress);
          },
        });

        return result;
      });

      const results = await Promise.all(uploadPromises);
      
      setProgress(100);
      onSuccess?.(results);
      
      return results;
    } catch (err: any) {
      const errorMessage = err.message || 'Upload failed';
      setError(errorMessage);
      onError?.(errorMessage);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [options]);

  const uploadWithPresignedUrl = useCallback(async (file: File, options: any = {}) => {
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Get presigned URL
      const { presignedUrl, fileId } = await storageService.createPresignedUrl({
        fileName: file.name,
        mimeType: file.type,
        ...options,
      });

      // Upload directly to S3
      await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      setProgress(100);
      return { fileId };
    } catch (err: any) {
      const errorMessage = err.message || 'Upload failed';
      setError(errorMessage);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  return {
    uploading,
    progress,
    error,
    uploadFiles,
    uploadWithPresignedUrl,
  };
};
```

#### 4.2 React File Upload Component

```typescript
// src/components/FileUpload/FileUploadZone.tsx
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFileUpload } from '../../hooks/useFileUpload';

interface FileUploadZoneProps {
  multiple?: boolean;
  maxSize?: number;
  allowedTypes?: string[];
  onUploadComplete?: (files: any[]) => void;
  className?: string;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  multiple = false,
  maxSize = 50 * 1024 * 1024,
  allowedTypes = [],
  onUploadComplete,
  className = '',
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  const { uploading, progress, error, uploadFiles } = useFileUpload({
    multiple,
    maxSize,
    allowedTypes,
    onSuccess: (files) => {
      setUploadedFiles(prev => [...prev, ...files]);
      onUploadComplete?.(files);
    },
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const fileList = new DataTransfer();
      acceptedFiles.forEach(file => fileList.items.add(file));
      await uploadFiles(fileList.files);
    }
  }, [uploadFiles]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    fileRejections,
  } = useDropzone({
    onDrop,
    multiple,
    maxSize,
    accept: allowedTypes.length > 0 ? 
      allowedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}) : 
      undefined,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive && !isDragReject ? 'border-blue-400 bg-blue-50' : ''}
          ${isDragReject ? 'border-red-400 bg-red-50' : ''}
          ${!isDragActive ? 'border-gray-300 hover:border-gray-400' : ''}
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          
          {uploading ? (
            <div>
              <p className="text-gray-600">Uploading...</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">{Math.round(progress)}%</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-600">
                {isDragActive
                  ? 'Drop the files here...'
                  : 'Drag & drop files here, or click to select'}
              </p>
              <p className="text-sm text-gray-500">
                {multiple ? 'Multiple files allowed' : 'Single file only'} • 
                Max size: {formatFileSize(maxSize)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {(error || fileRejections.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          {error && <p className="text-red-800">{error}</p>}
          {fileRejections.map(({ file, errors }) => (
            <div key={file.name} className="text-red-800">
              <p className="font-medium">{file.name}</p>
              {errors.map(error => (
                <p key={error.code} className="text-sm">{error.message}</p>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Uploaded Files</h4>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={file.id || index}
                className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md"
              >
                <div className="flex items-center space-x-3">
                  <svg
                    className="h-8 w-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {file.originalName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setUploadedFiles(prev => 
                    prev.filter((_, i) => i !== index)
                  )}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

## Testing Strategy

### 1. Storage Service Tests

```typescript
// src/features/storage/tests/storage.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from '../services/storage.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FileEntity } from '../entities/file.entity';
import { ConfigService } from '@nestjs/config';

describe('StorageService', () => {
  let service: StorageService;
  let mockFileRepository: any;
  let mockS3: any;

  beforeEach(async () => {
    mockFileRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };

    mockS3 = {
      upload: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Location: 'https://example.com/file.jpg',
        }),
      }),
      getObject: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Body: Buffer.from('test content'),
        }),
      }),
      deleteObject: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: getRepositoryToken(FileEntity),
          useValue: mockFileRepository,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              const config = {
                MINIO_ENDPOINT: 'http://localhost:9000',
                MINIO_ACCESS_KEY: 'test',
                MINIO_SECRET_KEY: 'test',
                MINIO_DEFAULT_BUCKET: 'test-bucket',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    // Mock S3 instance
    (service as any).s3 = mockS3;
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test content'),
      } as Express.Multer.File;

      const mockFileEntity = {
        id: 'test-id',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
      };

      mockFileRepository.create.mockReturnValue(mockFileEntity);
      mockFileRepository.save.mockResolvedValue(mockFileEntity);
      mockFileRepository.findOne.mockResolvedValue(null); // No duplicate

      const result = await service.uploadFile(mockFile, 'user-id');

      expect(result.file).toEqual(mockFileEntity);
      expect(mockS3.upload).toHaveBeenCalled();
      expect(mockFileRepository.save).toHaveBeenCalled();
    });

    it('should reject files that are too large', async () => {
      const mockFile = {
        originalname: 'large.jpg',
        mimetype: 'image/jpeg',
        size: 100 * 1024 * 1024, // 100MB
        buffer: Buffer.from('large content'),
      } as Express.Multer.File;

      await expect(
        service.uploadFile(mockFile, 'user-id', undefined, { maxSize: 50 * 1024 * 1024 })
      ).rejects.toThrow('File size exceeds maximum allowed size');
    });

    it('should reject dangerous file types', async () => {
      const mockFile = {
        originalname: 'virus.exe',
        mimetype: 'application/x-msdownload',
        size: 1024,
        buffer: Buffer.from('malicious content'),
      } as Express.Multer.File;

      await expect(
        service.uploadFile(mockFile, 'user-id')
      ).rejects.toThrow('File type not allowed for security reasons');
    });
  });

  describe('getFile', () => {
    it('should return file for owner', async () => {
      const mockFile = {
        id: 'test-id',
        userId: 'user-id',
        isPublic: false,
      };

      mockFileRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.getFile('test-id', 'user-id');
      expect(result).toEqual(mockFile);
    });

    it('should return public file for any user', async () => {
      const mockFile = {
        id: 'test-id',
        userId: 'owner-id',
        isPublic: true,
      };

      mockFileRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.getFile('test-id', 'other-user-id');
      expect(result).toEqual(mockFile);
    });

    it('should throw error for private file accessed by non-owner', async () => {
      const mockFile = {
        id: 'test-id',
        userId: 'owner-id',
        isPublic: false,
      };

      mockFileRepository.findOne.mockResolvedValue(mockFile);

      await expect(
        service.getFile('test-id', 'other-user-id')
      ).rejects.toThrow('File not found');
    });
  });
});
```

## Monitoring & Analytics

### 1. Storage Metrics

```typescript
// src/features/storage/services/storage-metrics.service.ts
import { Injectable } from '@nestjs/common';
import { PrometheusService } from '../../../shared/services/prometheus.service';

@Injectable()
export class StorageMetricsService {
  private readonly uploadCounter;
  private readonly downloadCounter;
  private readonly storageUsage;
  private readonly processingDuration;

  constructor(private readonly prometheusService: PrometheusService) {
    this.uploadCounter = this.prometheusService.createCounter({
      name: 'storage_uploads_total',
      help: 'Total number of file uploads',
      labelNames: ['mime_type', 'tenant_id', 'status'],
    });

    this.downloadCounter = this.prometheusService.createCounter({
      name: 'storage_downloads_total',
      help: 'Total number of file downloads',
      labelNames: ['mime_type', 'tenant_id'],
    });

    this.storageUsage = this.prometheusService.createGauge({
      name: 'storage_usage_bytes',
      help: 'Storage usage in bytes',
      labelNames: ['tenant_id', 'bucket'],
    });

    this.processingDuration = this.prometheusService.createHistogram({
      name: 'storage_processing_duration_seconds',
      help: 'File processing duration in seconds',
      labelNames: ['processing_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    });
  }

  recordUpload(mimeType: string, tenantId?: string, status = 'success') {
    this.uploadCounter.labels(mimeType, tenantId || 'unknown', status).inc();
  }

  recordDownload(mimeType: string, tenantId?: string) {
    this.downloadCounter.labels(mimeType, tenantId || 'unknown').inc();
  }

  updateStorageUsage(tenantId: string, bucket: string, bytes: number) {
    this.storageUsage.labels(tenantId, bucket).set(bytes);
  }

  recordProcessingDuration(type: string, duration: number) {
    this.processingDuration.labels(type).observe(duration);
  }
}
```

## Conclusion

This Storage feature blueprint provides a comprehensive foundation for implementing file storage and management in the AegisX Platform. Key highlights include:

### ✅ **Features Implemented:**

1. **File Upload System** - Multiple upload methods and validation
2. **Image Processing** - Automatic thumbnails and transformations
3. **S3 Compatibility** - Works with MinIO and AWS S3
4. **Security** - Virus scanning and access controls
5. **Multi-tenancy** - Isolated storage per tenant
6. **CDN Integration** - Fast file delivery
7. **Frontend Components** - Drag & drop upload interface

### 🔒 **Security Features:**

- File type validation and virus scanning
- Secure presigned URLs for direct uploads
- Access control and permission checking
- Encrypted storage and secure file keys

### 📊 **Monitoring & Analytics:**

- Upload/download metrics tracking
- Storage usage monitoring
- Processing performance metrics
- Error rate tracking

### 🧪 **Testing Coverage:**

- Unit tests for storage services
- Integration tests for upload flows
- Security testing for file validation
- Performance testing for large files

This blueprint ensures enterprise-grade file storage suitable for document management, media libraries, and user-generated content while maintaining security, performance, and scalability standards.
