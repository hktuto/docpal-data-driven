import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, SessionContext } from '../auth/auth_middleware';
import { requireCompany } from '../company/company_middleware';
import { 
  generateImportId, 
  storeImportFile, 
  getImportAnalysis,
  deleteImport,
  validateImportId
} from './import_service';
import { ImportAnalysisResult } from './types';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' }
  },
  required: ['error']
} as const;

// Response schemas
const ImportAnalysisResponse = {
  type: 'object',
  properties: {
    importId: { type: 'string' },
    status: { type: 'string', enum: ['analyzing', 'completed', 'error'] },
    fileName: { type: 'string' },
    totalRows: { type: 'number' },
    columns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          originalName: { type: 'string' },
          suggestedName: { type: 'string' },
          suggestedType: { type: 'string' },
          confidence: { type: 'number' },
          sampleValues: { type: 'array', items: { type: 'string' } },
          issues: { type: 'array', items: { type: 'string' } },
          nullable: { type: 'boolean' }
        }
      }
    },
    sampleData: { type: 'array' },
    warnings: { type: 'array', items: { type: 'string' } },
    errors: { type: 'array', items: { type: 'string' } },
    createdAt: { type: 'string' },
    expiresAt: { type: 'string' }
  }
} as const;

/**
 * Import Routes - File upload and analysis for schema creation
 * All routes require authentication and company context
 */
export const registerImportRoutes = async (fastify: FastifyInstance) => {
  // Apply authentication and company middleware to all import routes
  await fastify.register(async function (fastify) {
    fastify.addHook('preHandler', requireAuth);
    fastify.addHook('preHandler', requireCompany);

    /**
     * POST /api/schemas/import/analyze
     * Upload and analyze CSV/Excel file for schema creation
     */
    fastify.post('/analyze', {
      schema: {
        tags: ['Schema Import'],
        summary: 'Upload and analyze file for import',
        description: 'Upload a CSV or Excel file and get column analysis for schema creation',
        consumes: ['multipart/form-data'],
        response: {
          200: ImportAnalysisResponse,
          400: errorSchema,
          401: errorSchema,
          413: errorSchema,
          500: errorSchema
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { companyId } = request.user as SessionContext;
        if (!companyId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        // Handle multipart file upload
        let data: any;
        
        // Try request.file() first (normal multipart handling)
        data = await request.file();
        
        if (!data) {
          // Try to get file from body if attachFieldsToBody is true
          const body = request.body as any;
          if (body && body.file) {
            // File is attached to body, convert it to the expected format
            const fileData = body.file;
            
            // Create a mock file object that matches the expected interface
            data = {
              fieldname: 'file',
              filename: fileData.filename || 'uploaded_file.csv',
              encoding: '7bit',
              mimetype: fileData.mimetype || 'text/csv',
              file: {
                bytesRead: fileData.data ? fileData.data.length : 0,
              },
              toBuffer: async () => Buffer.from(fileData.data || ''),
            };
          } else {
            return reply.status(400).send({ error: 'No file uploaded' });
          }
        }

        // Validate file type
        const allowedMimeTypes = [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (!allowedMimeTypes.includes(data.mimetype)) {
          return reply.status(400).send({ 
            error: 'Invalid file type. Only CSV and Excel files are supported' 
          });
        }

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (data.file.bytesRead > maxSize) {
          return reply.status(413).send({ 
            error: 'File too large. Maximum size is 10MB' 
          });
        }

        // Generate unique import ID
        const importId = generateImportId();
        
        // Create temp directory if it doesn't exist
        const tempDir = path.join(process.cwd(), 'temp', 'imports');
        await mkdir(tempDir, { recursive: true });
        
        // Save file to temp location
        const fileExtension = data.mimetype.includes('csv') ? '.csv' : '.xlsx';
        const fileName = `${importId}${fileExtension}`;
        const filePath = path.join(tempDir, fileName);
        
        // Read file buffer and save
        const buffer = await data.toBuffer();
        await writeFile(filePath, buffer);
        
        // Store file info
        storeImportFile(importId, filePath, data.filename, companyId);
        
        // Analyze the file
        const { analyzeFile } = await import('./import_service');
        const analysisResult = await analyzeFile(importId, filePath, data.filename, companyId);
        
        return reply.status(200).send(analysisResult);
        
      } catch (error) {
        request.log.error('Error analyzing file: ' + (error instanceof Error ? error.message : String(error)));
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    /**
     * GET /api/schemas/import/:importId
     * Get import analysis result
     */
    fastify.get('/:importId', {
      schema: {
        tags: ['Schema Import'],
        summary: 'Get import analysis result',
        description: 'Retrieve the analysis result for a specific import',
        params: {
          type: 'object',
          properties: {
            importId: { type: 'string' }
          },
          required: ['importId']
        },
        response: {
          200: ImportAnalysisResponse,
          404: errorSchema,
          401: errorSchema,
          500: errorSchema
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { companyId } = request.user as SessionContext;
        if (!companyId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { importId } = request.params as { importId: string };
        
        // Validate import ID
        if (!validateImportId(importId)) {
          return reply.status(404).send({ error: 'Import not found or expired' });
        }
        
        const analysis = getImportAnalysis(importId);
        if (!analysis) {
          return reply.status(404).send({ error: 'Import analysis not found' });
        }
        
        return reply.status(200).send(analysis);
        
      } catch (error) {
        request.log.error('Error getting import analysis: ' + (error instanceof Error ? error.message : String(error)));
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    /**
     * POST /api/schemas/import/confirm
     * Confirm column mappings and import data
     */
    fastify.post('/confirm', {
      schema: {
        tags: ['Schema Import'],
        summary: 'Confirm import and create schema',
        description: 'Confirm column mappings and import data to create or update a schema',
        body: {
          type: 'object',
          properties: {
            importId: { type: 'string' },
            columnMappings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  originalName: { type: 'string' },
                  targetName: { type: 'string' },
                  dataType: { type: 'string' },
                  nullable: { type: 'boolean' },
                  skip: { type: 'boolean' }
                },
                required: ['originalName', 'targetName', 'dataType', 'nullable', 'skip']
              }
            },
            schemaAction: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['create', 'update'] },
                slug: { type: 'string' },
                existingSlug: { type: 'string' },
                label: { type: 'string' },
                description: { type: 'string' }
              },
              required: ['type']
            }
          },
          required: ['importId', 'columnMappings', 'schemaAction']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              schemaSlug: { type: 'string' },
              importedRows: { type: 'number' },
              errors: { type: 'array', items: { type: 'string' } },
              warnings: { type: 'array', items: { type: 'string' } }
            }
          },
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          500: errorSchema
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { companyId, id: userId } = request.user as SessionContext;
        if (!companyId || !userId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const confirmationRequest = request.body as any;
        
        // Import the confirm function
        const { confirmImport } = await import('./import_service');
        const result = await confirmImport(companyId, userId, confirmationRequest);
        
        if (!result.success) {
          return reply.status(400).send({ 
            error: 'Import failed', 
            details: result.errors 
          });
        }
        
        return reply.status(200).send(result);
        
      } catch (error) {
        request.log.error('Error confirming import: ' + (error instanceof Error ? error.message : String(error)));
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    /**
     * POST /api/schemas/import/cleanup
     * Manually trigger cleanup of expired imports
     */
    fastify.post('/cleanup', {
      schema: {
        tags: ['Schema Import'],
        summary: 'Cleanup expired imports',
        description: 'Manually trigger cleanup of expired import sessions and files',
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              cleanedSessions: { type: 'number' },
              cleanedFiles: { type: 'number' }
            }
          },
          401: errorSchema,
          500: errorSchema
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { companyId } = request.user as SessionContext;
        if (!companyId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        // Import cleanup function
        const { cleanupExpiredImports } = await import('./import_service');
        
        // Count before cleanup (we'll need to expose these from the service)
        const sessionsBefore = 0; // TODO: Expose session count from service
        const filesBefore = 0; // TODO: Expose file count from service
        
        // Run cleanup
        cleanupExpiredImports();
        
        // Count after cleanup
        const sessionsAfter = 0; // TODO: Expose session count from service
        const filesAfter = 0; // TODO: Expose file count from service
        
        const cleanedSessions = sessionsBefore - sessionsAfter;
        const cleanedFiles = filesBefore - filesAfter;
        
        return reply.status(200).send({
          message: 'Cleanup completed',
          cleanedSessions,
          cleanedFiles
        });
        
      } catch (error) {
        request.log.error('Error during cleanup: ' + (error instanceof Error ? error.message : String(error)));
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    /**
     * DELETE /api/schemas/import/:importId
     * Cancel and cleanup import
     */
    fastify.delete('/:importId', {
      schema: {
        tags: ['Schema Import'],
        summary: 'Cancel import',
        description: 'Cancel and cleanup an import session',
        params: {
          type: 'object',
          properties: {
            importId: { type: 'string' }
          },
          required: ['importId']
        },
        response: {
          204: {
            type: 'null',
            description: 'Import cancelled successfully'
          },
          404: errorSchema,
          401: errorSchema,
          500: errorSchema
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { companyId } = request.user as SessionContext;
        if (!companyId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { importId } = request.params as { importId: string };
        
        const deleted = deleteImport(importId);
        if (!deleted) {
          return reply.status(404).send({ error: 'Import not found' });
        }
        
        return reply.status(204).send();
        
      } catch (error) {
        request.log.error('Error cancelling import: ' + (error instanceof Error ? error.message : String(error)));
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });
  });
};
