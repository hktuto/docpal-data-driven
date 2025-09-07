// MinIO utility functions for DocPal API

import * as Minio from 'minio';
import { Readable } from 'stream';

// MinIO configuration interface
interface MinIOConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
}

// Global MinIO client
let minioClient: Minio.Client | null = null;

/**
 * Initialize MinIO client
 */
export const initializeMinIO = (config: MinIOConfig): Minio.Client => {
  minioClient = new Minio.Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });

  return minioClient;
};

/**
 * Get MinIO client instance
 */
export const getMinIOClient = (): Minio.Client => {
  if (!minioClient) {
    throw new Error('MinIO client not initialized. Call initializeMinIO first.');
  }
  return minioClient;
};

/**
 * Create bucket for a company if it doesn't exist
 */
export const ensureCompanyBucket = async (companyId: string): Promise<void> => {
  const client = getMinIOClient();
  const bucketName = `company-${companyId}`;

  const exists = await client.bucketExists(bucketName);
  if (!exists) {
    await client.makeBucket(bucketName, 'us-east-1');
    
    // Set bucket policy for private access
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
          Condition: {
            StringEquals: {
              's3:ExistingObjectTag/company': companyId,
            },
          },
        },
      ],
    };
    
    await client.setBucketPolicy(bucketName, JSON.stringify(policy));
  }
};

/**
 * Upload file to company bucket
 */
export const uploadFile = async (
  companyId: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> => {
  const client = getMinIOClient();
  const bucketName = `company-${companyId}`;
  
  // Ensure bucket exists
  await ensureCompanyBucket(companyId);
  
  // Generate unique file path
  const timestamp = Date.now();
  const filePath = `${timestamp}-${fileName}`;
  
  // Prepare metadata
  const fileMetadata = {
    'Content-Type': contentType,
    'company-id': companyId,
    'upload-timestamp': timestamp.toString(),
    ...metadata,
  };
  
  // Upload file
  await client.putObject(
    bucketName,
    filePath,
    fileBuffer,
    fileBuffer.length,
    fileMetadata
  );
  
  return filePath;
};

/**
 * Get file from company bucket
 */
export const getFile = async (
  companyId: string,
  filePath: string
): Promise<Readable> => {
  const client = getMinIOClient();
  const bucketName = `company-${companyId}`;
  
  // Ensure bucket exists
  await ensureCompanyBucket(companyId);
  
  return await client.getObject(bucketName, filePath);
};

/**
 * Get file metadata
 */
export const getFileMetadata = async (
  companyId: string,
  filePath: string
): Promise<Minio.BucketItemStat> => {
  const client = getMinIOClient();
  const bucketName = `company-${companyId}`;
  
  // Ensure bucket exists
  await ensureCompanyBucket(companyId);
  
  return await client.statObject(bucketName, filePath);
};

/**
 * Delete file from company bucket
 */
export const deleteFile = async (
  companyId: string,
  filePath: string
): Promise<void> => {
  const client = getMinIOClient();
  const bucketName = `company-${companyId}`;
  
  // Ensure bucket exists
  await ensureCompanyBucket(companyId);
  
  await client.removeObject(bucketName, filePath);
};

/**
 * Generate presigned URL for file access
 */
export const getPresignedUrl = async (
  companyId: string,
  filePath: string,
  expiry: number = 3600 // 1 hour default
): Promise<string> => {
  const client = getMinIOClient();
  const bucketName = `company-${companyId}`;
  
  return await client.presignedGetObject(bucketName, filePath, expiry);
};

/**
 * Generate presigned URL for file upload
 */
export const getPresignedUploadUrl = async (
  companyId: string,
  fileName: string,
  expiry: number = 3600 // 1 hour default
): Promise<string> => {
  const client = getMinIOClient();
  const bucketName = `company-${companyId}`;
  
  // Ensure bucket exists
  await ensureCompanyBucket(companyId);
  
  const timestamp = Date.now();
  const filePath = `${timestamp}-${fileName}`;
  
  return await client.presignedPutObject(bucketName, filePath, expiry);
};

/**
 * List files in company bucket
 */
export const listFiles = async (
  companyId: string,
  prefix?: string
): Promise<Minio.BucketItem[]> => {
  const client = getMinIOClient();
  const bucketName = `company-${companyId}`;
  
  const files: Minio.BucketItem[] = [];
  const stream = client.listObjects(bucketName, prefix, true);
  
  return new Promise((resolve, reject) => {
    stream.on('data', (obj:any) => files.push(obj));
    stream.on('end', () => resolve(files));
    stream.on('error', reject);
  });
};

/**
 * Test MinIO connection
 */
export const testMinIOConnection = async (): Promise<boolean> => {
  try {
    const client = getMinIOClient();
    const buckets = await client.listBuckets();
    console.log(`   Found ${buckets.length} buckets`);
    return true;
  } catch (error) {
    console.error('MinIO connection test failed:', error);
    return false;
  }
};
