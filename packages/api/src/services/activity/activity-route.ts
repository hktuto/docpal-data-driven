// DocPal History API Routes
// RESTful endpoints for history and audit functionality

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/auth_middleware';
import { requireCompany } from '../company/company_middleware';
import {
  getRecordHistory,
  getTableHistory,
  getAuditLogs,
  getUserActivity,
  HistoryQueryOptions,
  AuditQueryOptions
} from './activity-service';

// Schema definitions for validation
const historyQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    offset: { type: 'integer', minimum: 0, default: 0 },
    action: { type: 'string' },
    user_id: { type: 'string', format: 'uuid' },
    start_date: { type: 'string', format: 'date-time' },
    end_date: { type: 'string', format: 'date-time' }
  }
} as const;

const auditQuerySchema = {
  type: 'object',
  properties: {
    ...historyQuerySchema.properties,
    entity_type: { type: 'string' }
  }
} as const;

const recordHistoryParamsSchema = {
  type: 'object',
  properties: {
    table_slug: { type: 'string' },
    record_id: { type: 'string', format: 'uuid' }
  },
  required: ['table_slug', 'record_id']
} as const;

const tableHistoryParamsSchema = {
  type: 'object',
  properties: {
    table_slug: { type: 'string' }
  },
  required: ['table_slug']
} as const;

const userActivityParamsSchema = {
  type: 'object',
  properties: {
    user_id: { type: 'string', format: 'uuid' }
  },
  required: ['user_id']
} as const;

/**
 * Register history and audit routes
 */
export const registerHistoryRoutes = async (fastify: FastifyInstance) => {
  
  /**
   * GET /api/records/:table_slug/:record_id/history
   * Get history for a specific record
   */
  fastify.get('/records/:table_slug/:record_id/history', {
    schema: {
      params: recordHistoryParamsSchema,
      querystring: historyQuerySchema,
      tags: ['History'],
      summary: 'Get record history',
      description: 'Retrieve the complete change history for a specific record'
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug, record_id } = request.params as { table_slug: string; record_id: string };
      const query = request.query as HistoryQueryOptions;
      const user = (request as any).user;
      
      const history = await getRecordHistory(
        user.companyId,
        table_slug,
        record_id,
        query
      );
      
      return reply.status(200).send(history);
    } catch (error) {
      console.error('Error getting record history:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/records/:table_slug/history
   * Get history for all records in a table
   */
  fastify.get('/records/:table_slug/history', {
    schema: {
      params: tableHistoryParamsSchema,
      querystring: historyQuerySchema,
      tags: ['History'],
      summary: 'Get table history',
      description: 'Retrieve the change history for all records in a table'
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const query = request.query as HistoryQueryOptions;
      const user = (request as any).user;
      
      const history = await getTableHistory(
        user.companyId,
        table_slug,
        query
      );
      
      return reply.status(200).send(history);
    } catch (error) {
      console.error('Error getting table history:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/audit
   * Get comprehensive audit logs
   */
  fastify.get('/audit', {
    schema: {
      querystring: auditQuerySchema,
      tags: ['Audit'],
      summary: 'Get audit logs',
      description: 'Retrieve comprehensive audit logs for all system activities'
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as AuditQueryOptions;
      const user = (request as any).user;
      
      const auditLogs = await getAuditLogs(user.companyId, query);
      
      return reply.status(200).send(auditLogs);
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/audit/:table_slug
   * Get audit logs for a specific table
   */
  fastify.get('/audit/:table_slug', {
    schema: {
      params: tableHistoryParamsSchema,
      querystring: historyQuerySchema,
      tags: ['Audit'],
      summary: 'Get table audit logs',
      description: 'Retrieve audit logs for activities on a specific table'
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const query = request.query as AuditQueryOptions;
      const user = (request as any).user;
      
        // Get audit logs filtered by table
        const auditLogs = await getAuditLogs(user.companyId, {
          ...query,
          entity_type: 'record'
        });
      
      // Filter by table_name in the data
      const tableAuditLogs = auditLogs.filter((log: any) => 
        log.table_name === table_slug
      );
      
      return reply.status(200).send(tableAuditLogs);
    } catch (error) {
      console.error('Error getting table audit logs:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/audit/users/:user_id
   * Get activity logs for a specific user
   */
  fastify.get('/audit/users/:user_id', {
    schema: {
      params: userActivityParamsSchema,
      querystring: historyQuerySchema,
      tags: ['Audit'],
      summary: 'Get user activity',
      description: 'Retrieve all activities performed by a specific user'
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { user_id } = request.params as { user_id: string };
      const query = request.query as HistoryQueryOptions;
      const user = (request as any).user;
      
      const userActivity = await getUserActivity(
        user.companyId,
        user_id,
        query
      );
      
      return reply.status(200).send(userActivity);
    } catch (error) {
      console.error('Error getting user activity:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/audit/reports
   * Generate audit reports (future enhancement)
   */
  fastify.post('/audit/reports', {
    schema: {
      body: {
        type: 'object',
        properties: {
          report_type: { type: 'string', enum: ['compliance', 'user_activity', 'data_changes'] },
          filters: auditQuerySchema,
          format: { type: 'string', enum: ['json', 'csv'], default: 'json' }
        },
        required: ['report_type']
      },
      tags: ['Audit'],
      summary: 'Generate audit report',
      description: 'Generate comprehensive audit reports for compliance and analysis'
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { report_type, filters, format } = request.body as {
        report_type: string;
        filters?: AuditQueryOptions;
        format?: string;
      };
      const user = (request as any).user;
      
      // For now, return the same data as audit logs
      // Future: implement specific report generation logic
      const auditLogs = await getAuditLogs(user.companyId, filters);
      
      const report = {
        report_type,
        generated_at: new Date().toISOString(),
        generated_by: user.email,
        total_records: auditLogs.length,
        filters: filters || {},
        data: auditLogs
      };
      
      if (format === 'csv') {
        // Future: implement CSV export
        return reply.status(501).send({ error: 'CSV export not yet implemented' });
      }
      
      return reply.status(200).send(report);
    } catch (error) {
      console.error('Error generating audit report:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
};
