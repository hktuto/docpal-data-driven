// Simple file management routes for DocPal API
// 3 endpoints: upload, get, delete

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/auth_middleware';
import { requireCompany } from '../company/company_middleware';
import {
  uploadFileToTable,
  getFileByPath,
  deleteFileFromTable,
  findFileReferences,
  FileUploadData
} from './file_service';

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' }
  },
  required: ['error']
} as const;

// Schema definitions for validation
const fileUploadSchema = {
  tags: ['files'],
  description: 'Upload a file and associate it with a table record',
  consumes: ['multipart/form-data'],
  response:{
    201: {
      type: 'object',
      properties: {
        filePath: { type: 'string' },
        metadata: { type: 'object' },
        message: { type: 'string' }
      },
      additionalProperties: true,
    },
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    500: errorSchema
  }
  // body: {
  //   type: 'object',
  //   properties: {
  //     file: {
  //       type: 'object',
  //       properties: {
  //         filename: { type: 'string' },
  //         mimetype: { type: 'string' },
  //         data: { type: 'string', format: 'binary' }
  //       }
  //     },
  //     table: { type: 'string', minLength: 1, maxLength: 128 },
  //     column: { type: 'string', minLength: 1, maxLength: 128 },
  //     row: { type: 'string', format: 'uuid' },
  //     metadataField: { type: 'string', maxLength: 128 },
  //     additionalData: { type: 'object' }
  //   },
  //   required: ['file', 'table', 'column', 'row']
  // }
} as const;

const fileParamsSchema = {
  tags: ['files'],
  description: 'Get file by ID for download or display',
  params: {
    type: 'object',
    properties: {
      fileId: { type: 'string', minLength: 1 }
    },
    required: ['fileId']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        stream: { type: 'string', format: 'binary' },
        metadata: { type: 'object' }
      }
    },
    404: errorSchema,
    500: errorSchema
  }
} as const;

const fileDeleteSchema = {
  tags: ['files'],
  description: 'Delete a file and remove its reference from table records',
  params: {
    type: 'object',
    properties: {
      fileId: { type: 'string', minLength: 1 }
    },
    required: ['fileId']
  },
  body: {
    type: 'object',
    properties: {
      table: { type: 'string', maxLength: 128 },
      column: { 
        type: 'string', 
        maxLength: 128,
        description: 'Column name or nested JSONB path using dot notation (e.g., "file_path" or "metadata.files.primary")'
      },
      row: { type: 'string', format: 'uuid' },
      metadataField: { 
        type: 'string', 
        maxLength: 128,
        description: 'Optional metadata field name or nested JSONB path using dot notation'
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    },
    404: errorSchema,
    500: errorSchema
  }
} as const;

const fileReferencesSchema = {
  tags: ['files'],
  description: 'Find all references to a file across table records',
  params: {
    type: 'object',
    properties: {
      fileId: { type: 'string', minLength: 1 }
    },
    required: ['fileId']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        references: { type: 'array', items: { type: 'object' } }
      }
    },
    404: errorSchema,
    500: errorSchema
  }
} as const;

/**
 * Register file management routes
 */
export const registerFileRoutes = async (fastify: FastifyInstance) => {
  
  // Upload file and update table
  // Supports nested JSONB fields using dot notation (e.g., "metadata.files.primary")
  fastify.post('/files/upload', {
    schema: fileUploadSchema,
    preHandler: [requireAuth, requireCompany],
  }, async (request, reply) => {
    try {
      const { companyId, id:userId } = request.user as { companyId: string, id: string };
      
      // Handle multipart file upload with attachFieldsToBody: true
      const body = request.body as any;
      
      if (!body.file) {
        return reply.status(400).send({ error: 'No file provided' });
      }
      
      // With attachFieldsToBody: true, files are attached as objects with _buf property
      const fileField = body.file;
      const fileBuffer = await body.file.toBuffer();
      const mimeType = body.file.mimetype;
      const originalName = body.file.filename;
      const table = body.table.value;
      const column = body.column.value;
      const row = body.row.value;
      const metadataField = body.metadataField ? body.metadataField.value : null;
      const additionalData = body.additionalData ? body.additionalData.value : null;
      
      if (!fileBuffer) {
        return reply.status(400).send({ error: 'File buffer not found' });
      }
      
      const uploadData: FileUploadData = {
        file: fileBuffer,
        filename: originalName,
        mimetype: mimeType,
        table: table,
        column: column,
        row: row,
        metadataField: metadataField,
        additionalData: additionalData ? 
          (additionalData === 'string' ? JSON.parse(additionalData) : additionalData) : 
          {}
      };
      
      const result = await uploadFileToTable(companyId, userId, uploadData);
      console.log('-----------uploadFileToTable result', result);
      return reply.status(201).send({
        filePath: result.filePath,
        metadata: result.metadata,
        message: 'File uploaded successfully'
      });
    } catch (error) {
      console.error('---File upload error:---', error);
      return reply.status(500).send({ 
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get file by file ID (stream for download/display)
  fastify.get('/files/:fileId', {
    schema: fileParamsSchema,
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, id:userId } = request.user as { companyId: string, id: string };
      const { fileId } = request.params as { fileId: string };

      // The fileId is actually the file path in MinIO
      const fileData = await getFileByPath(companyId, fileId);
      
      if (!fileData) {
        return reply.status(404).send({ error: 'File not found' });
      }

      const { stream, metadata } = fileData;

      // Set appropriate headers for download
      reply.header('Content-Type', metadata.contentType);
      reply.header('Content-Length', metadata.size.toString());
      reply.header('Content-Disposition', `attachment; filename="${metadata.filename}"`);
      reply.header('Last-Modified', metadata.lastModified?.toUTCString() || new Date().toUTCString());

      return reply.send(stream);
    } catch (error) {
      console.error('File download error:', error);
      return reply.status(500).send({ error: 'Failed to download file' });
    }
  });

  // Delete file
  fastify.post('/files/:fileId/delete', {
    schema: fileDeleteSchema,
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, id: userId } = request.user as { companyId: string, id: string };
      const { fileId } = request.params as { fileId: string };
      const body = request.body as {
        table?: string;
        column?: string;
        row?: string;
        metadataField?: string;
      };

      // The fileId is actually the file path in MinIO
      const success = await deleteFileFromTable(
        companyId,
        userId,
        fileId,
        body.table,
        body.column,
        body.row,
        body.metadataField
      );
      
      if (!success) {
        return reply.status(404).send({ error: 'File not found or could not be deleted' });
      }

      return reply.status(200).send({ message: 'File deleted successfully' });
    } catch (error) {
      console.error('File delete error:', error);
      return reply.status(500).send({ error: 'Failed to delete file' });
    }
  });

  // Helper endpoint: Find where a file is referenced (useful for cleanup)
  fastify.get('/files/:fileId/references', {
    schema: fileReferencesSchema,
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request.user as { companyId: string };
      const { fileId } = request.params as { fileId: string };

      // The fileId is actually the file path in MinIO
      const references = await findFileReferences(companyId, fileId);
      
      return reply.status(200).send({ references });
    } catch (error) {
      console.error('Find file references error:', error);
      return reply.status(500).send({ error: 'Failed to find file references' });
    }
  });
};