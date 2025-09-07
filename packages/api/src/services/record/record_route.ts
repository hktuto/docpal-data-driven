import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/auth_middleware';
import { requireCompany } from '../company/company_middleware';
import {
  createRecord,
  createRecordsBatch,
  getRecords,
  getRecordById,
  updateRecord,
  deleteRecord,
  getBreadcrumb,
  CreateRecordRequest,
  UpdateRecordRequest,
  BatchInsertRequest,
  RecordQueryOptions
} from './record_service';
import {
  executeTableQuery,
  executeKanbanQuery,
  executeTreeQuery,
  executeAggregationQuery,
  executeChartDataQuery,
  executeGanttQuery,
  executeDropdownQuery,
  TableQueryRequest,
  KanbanQueryRequest,
  TreeQueryRequest,
  AggregationRequest,
  ChartDataRequest,
  GanttQueryRequest,
  DropdownQueryRequest
} from './query_service';
// Enhanced query functionality is now integrated into existing query endpoints

/**
 * Record Routes - RESTful API endpoints for dynamic record operations
 * All routes require authentication and company context
 */

// Schema definitions for request validation
const createRecordSchema = {
  params: {
    type: 'object',
    properties: {
      table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' }
    },
    required: ['table_slug']
  },
  body: {
    type: 'object',
    additionalProperties: true // Allow dynamic fields based on schema
  }
} as const;

const batchInsertSchema = {
  params: {
    type: 'object',
    properties: {
      table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' }
    },
    required: ['table_slug']
  },
  body: {
    type: 'object',
    properties: {
      records: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true // Allow dynamic fields based on schema
        },
        minItems: 1,
        maxItems: 1000
      }
    },
    required: ['records']
  }
} as const;

const getRecordsSchema = {
  params: {
    type: 'object',
    properties: {
      table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' }
    },
    required: ['table_slug']
  },
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 1000, default: 50 },
      offset: { type: 'integer', minimum: 0, default: 0 },
      orderBy: { type: 'string' },
      orderDirection: { type: 'string', enum: ['ASC', 'DESC'], default: 'DESC' },
      search: { type: 'string' },
      // Dynamic filter parameters will be handled in the route handler
    },
    additionalProperties: true
  }
} as const;

const getRecordByIdSchema = {
  params: {
    type: 'object',
    properties: {
      table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' },
      record_id: { type: 'string', format: 'uuid' }
    },
    required: ['table_slug', 'record_id']
  }
} as const;

const updateRecordSchema = {
  params: {
    type: 'object',
    properties: {
      table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' },
      record_id: { type: 'string', format: 'uuid' }
    },
    required: ['table_slug', 'record_id']
  },
  body: {
    type: 'object',
    additionalProperties: true // Allow dynamic fields based on schema
  }
} as const;

const deleteRecordSchema = {
  params: {
    type: 'object',
    properties: {
      table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' },
      record_id: { type: 'string', format: 'uuid' }
    },
    required: ['table_slug', 'record_id']
  }
} as const;

/**
 * Register record routes with Fastify
 */
export const registerRecordRoutes = async (fastify: FastifyInstance) => {
  // Create a new record
  fastify.post('/records/:table_slug', {
    schema: createRecordSchema,
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const { id: userId, companyId, storeId } = (request as any).user;
      const recordData = request.body as CreateRecordRequest;
      const newRecord = await createRecord(storeId, companyId, table_slug, userId, recordData);
      
      return reply.status(201).send(newRecord);
    } catch (error: any) {
      request.log.error('Error creating record:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Table not found' });
      }
      
      if (error.message.includes('permissions')) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }
      
      if (error.message.includes('required') || error.message.includes('Invalid')) {
        return reply.status(400).send({ error: error.message });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Batch insert records
  fastify.post('/records/:table_slug/batch', {
    schema: batchInsertSchema,
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const { id: userId, companyId, storeId } = (request as any).user;
      const batchData = request.body as BatchInsertRequest;
      
      const result = await createRecordsBatch(storeId, companyId, table_slug, userId, batchData);
      
      // Return 201 if all records were created successfully, 207 if there were partial errors
      const statusCode = result.errors.length === 0 ? 201 : 207;
      
      return reply.status(statusCode).send({
        records: result.records,
        total: result.total,
        errors: result.errors,
        success: result.errors.length === 0
      });
    } catch (error: any) {
      request.log.error('Error in batch insert:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Table not found' });
      }
      
      if (error.message.includes('permissions')) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }
      
      if (error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('limited')) {
        return reply.status(400).send({ error: error.message });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get records with filtering and pagination
  fastify.get('/records/:table_slug', {
    schema: getRecordsSchema,
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const queryParams = request.query as any;
      const { id: userId, companyId, storeId } = (request as any).user;

      // Extract standard query options
      const {
        limit,
        offset,
        orderBy,
        orderDirection,
        search,
        ...filters
      } = queryParams;

      const options: RecordQueryOptions = {
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
        orderBy: orderBy || 'created_at',
        orderDirection: orderDirection || 'DESC',
        search,
        filters
      };
      console.log('--------------- get Records options', options);
      const result = await getRecords(companyId, table_slug, userId, options);
      
      return reply.status(200).send({
        records: result.records,
        total: result.total,
        limit: options.limit,
        offset: options.offset
      });
    } catch (error: any) {
      request.log.error('Error fetching records:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Table not found' });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get a specific record by ID
  fastify.get('/records/:table_slug/:record_id', {
    schema: getRecordByIdSchema,
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug, record_id } = request.params as { table_slug: string; record_id: string };
      const { id: userId, companyId, storeId } = (request as any).user;
      const record = await getRecordById(storeId, companyId, table_slug, record_id, userId);

      
      if (!record) {
        return reply.status(404).send({ error: 'Record not found' });
      }
      
      return reply.status(200).send(record);
    } catch (error: any) {
      request.log.error('Error fetching record:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Table not found' });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update a record
  fastify.put('/records/:table_slug/:record_id', {
    schema: updateRecordSchema,
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug, record_id } = request.params as { table_slug: string; record_id: string };
      const updateData = request.body as UpdateRecordRequest;
      const { id: userId, companyId, storeId } = (request as any).user;

      const updatedRecord = await updateRecord(storeId, companyId, table_slug, record_id, userId, updateData);
      
      return reply.status(200).send(updatedRecord);
    } catch (error: any) {
      request.log.error('Error updating record:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Record not found' });
      }
      
      if (error.message.includes('permissions')) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }
      
      if (error.message.includes('required') || error.message.includes('Invalid')) {
        return reply.status(400).send({ error: error.message });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete a record
  fastify.delete('/records/:table_slug/:record_id', {
    schema: deleteRecordSchema,
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug, record_id } = request.params as { table_slug: string; record_id: string };
      const { id: userId, companyId, storeId } = (request as any).user;

      await deleteRecord(storeId, companyId, table_slug, record_id, userId);
      
      return reply.status(204).send();
    } catch (error: any) {
      request.log.error('Error deleting record:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Record not found' });
      }
      
      if (error.message.includes('permissions')) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Advanced Query Endpoints

  // Table view query
  fastify.post('/records/:table_slug/query/table', {
    schema: {
      params: {
        type: 'object',
        properties: {
          table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' }
        },
        required: ['table_slug']
      },
      body: {
        type: 'object',
        properties: {
          columns: { type: 'array', items: { type: 'string' } },
          filters: { type: 'object' },
          search: { type: 'string' },
          orderBy: { type: 'string' },
          orderDirection: { type: 'string', enum: ['ASC', 'DESC'] },
          limit: { type: 'integer', minimum: 1, maximum: 1000 },
          offset: { type: 'integer', minimum: 0 },
          relationColumns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                local_key: { type: 'string' },
                foreign_table: { type: 'string' },
                foreign_key: { type: 'string' },
                display_columns: { type: 'array', items: { type: 'string' } },
                filters: { type: 'object' }
              },
              required: ['label', 'local_key', 'foreign_table', 'foreign_key', 'display_columns']
            }
          },
          aggColumns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                local_key: { type: 'string' },
                foreign_table: { type: 'string' },
                foreign_key: { type: 'string' },
                function: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max', 'array_agg', 'string_agg'] },
                function_field: { type: 'string' },
                filters: { type: 'object' },
                group_by: { type: 'array', items: { type: 'string' } }
              },
              required: ['label', 'local_key', 'foreign_table', 'foreign_key', 'function']
            }
          },
          aggregation_filter: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const queryRequest = request.body as TableQueryRequest;
      const { id: userId, companyId, storeId } = (request as any).user;

      const result = await executeTableQuery(companyId, table_slug, userId, queryRequest);
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error('Error executing table query:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Table not found' });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Kanban view query
  fastify.post('/records/:table_slug/query/kanban', {
    schema: {
      params: {
        type: 'object',
        properties: {
          table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' }
        },
        required: ['table_slug']
      },
      body: {
        type: 'object',
        properties: {
          statusColumn: { type: 'string' },
          groupByColumn: { type: 'string' },
          columns: { type: 'array', items: { type: 'string' } },
          filters: { type: 'object' },
          search: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 10000 },
          relationColumns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                local_key: { type: 'string' },
                foreign_table: { type: 'string' },
                foreign_key: { type: 'string' },
                display_columns: { type: 'array', items: { type: 'string' } },
                filters: { type: 'object' }
              },
              required: ['label', 'local_key', 'foreign_table', 'foreign_key', 'display_columns']
            }
          },
          aggColumns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                local_key: { type: 'string' },
                foreign_table: { type: 'string' },
                foreign_key: { type: 'string' },
                function: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max', 'array_agg', 'string_agg'] },
                function_field: { type: 'string' },
                filters: { type: 'object' },
                group_by: { type: 'array', items: { type: 'string' } }
              },
              required: ['label', 'local_key', 'foreign_table', 'foreign_key', 'function']
            }
          },
          aggregation_filter: { type: 'array', items: { type: 'string' } }
        },
        required: ['statusColumn']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            boards: { type: 'array', additionalProperties: true },
            aggregation: { type: 'object', additionalProperties: true }
          }
        }
      }
    },
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const queryRequest = request.body as KanbanQueryRequest;
      const { id: userId, companyId, storeId } = (request as any).user;

      
      const result = await executeKanbanQuery(companyId, table_slug, userId, queryRequest);

      
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error('Error executing kanban query:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Table not found' });
      }
      
      if (error.message.includes('column') && error.message.includes('not found')) {
        return reply.status(400).send({ error: error.message });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Tree view query
  fastify.post('/records/:table_slug/query/tree', {
    schema: {
      params: {
        type: 'object',
        properties: {
          table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' }
        },
        required: ['table_slug']
      },
      body: {
        type: 'object',
        properties: {
          parentColumn: { type: 'string' },
          labelColumn: { type: 'string' },
          columns: { type: 'array', items: { type: 'string' } },
          rootValue: {},
          maxDepth: { type: 'integer', minimum: 1, maximum: 20 },
          filters: { type: 'object' },
          relationColumns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                local_key: { type: 'string' },
                foreign_table: { type: 'string' },
                foreign_key: { type: 'string' },
                display_columns: { type: 'array', items: { type: 'string' } },
                filters: { type: 'object' }
              },
              required: ['label', 'local_key', 'foreign_table', 'foreign_key', 'display_columns']
            }
          },
          aggColumns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                local_key: { type: 'string' },
                foreign_table: { type: 'string' },
                foreign_key: { type: 'string' },
                function: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max', 'array_agg', 'string_agg'] },
                function_field: { type: 'string' },
                filters: { type: 'object' },
                group_by: { type: 'array', items: { type: 'string' } }
              },
              required: ['label', 'local_key', 'foreign_table', 'foreign_key', 'function']
            }
          },
          aggregation_filter: { type: 'array', items: { type: 'string' } }
        },
        required: ['parentColumn', 'labelColumn']
      }
    },
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const queryRequest = request.body as TreeQueryRequest;
      const userId = (request as any).user.id;
      const companyId = (request as any).company.id;

      const result = await executeTreeQuery(companyId, table_slug, userId, queryRequest);
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error('Error executing tree query:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Table not found' });
      }
      
      if (error.message.includes('column') && error.message.includes('not found')) {
        return reply.status(400).send({ error: error.message });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Aggregation statistics
  fastify.post('/records/:table_slug/stats/agg', {
    schema: {
      params: {
        type: 'object',
        properties: {
          table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' }
        },
        required: ['table_slug']
      },
      body: {
        type: 'object',
        properties: {
          groupBy: { type: 'array', items: { type: 'string' } },
          aggregations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                column: { type: 'string' },
                function: { type: 'string', enum: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] },
                alias: { type: 'string' }
              },
              required: ['column', 'function']
            }
          },
          filters: { type: 'object' },
          having: { type: 'object' }
        },
        required: ['aggregations']
      }
    },
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const queryRequest = request.body as AggregationRequest;
      const { id: userId, companyId, storeId } = (request as any).user;
      console.log('--------------- executeAggregationQuery queryRequest', queryRequest);
      const result = await executeAggregationQuery(companyId, table_slug, userId, queryRequest);
      console.log('--------------- executeAggregationQuery result', result);
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error('Error executing aggregation query:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Table not found' });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Chart data
  fastify.post('/records/:table_slug/stats/chart', {
    schema: {
      params: {
        type: 'object',
        properties: {
          table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' }
        },
        required: ['table_slug']
      },
      body: {
        type: 'object',
        properties: {
          chartType: { type: 'string', enum: ['bar', 'line', 'pie', 'scatter'] },
          xAxis: { type: 'string' },
          yAxis: { type: 'string' },
          aggregation: { type: 'string', enum: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] },
          groupBy: { type: 'string' },
          filters: { type: 'object' },
          limit: { type: 'integer', minimum: 1, maximum: 1000 }
        },
        required: ['chartType', 'xAxis', 'yAxis']
      }
    },
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const queryRequest = request.body as ChartDataRequest;
      const userId = (request as any).user.id;
      const companyId = (request as any).company.id;

      const result = await executeChartDataQuery(companyId, table_slug, userId, queryRequest);
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error('Error executing chart data query:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Table not found' });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Gantt chart query
  fastify.post('/records/:table_slug/query/gantt', {
    schema: {
      params: {
        type: 'object',
        properties: {
          table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' }
        },
        required: ['table_slug']
      },
      body: {
        type: 'object',
        properties: {
          taskNameColumn: { type: 'string' },
          startDateColumn: { type: 'string' },
          endDateColumn: { type: 'string' },
          progressColumn: { type: 'string' },
          dependencyColumn: { type: 'string' },
          categoryColumn: { type: 'string' },
          assigneeColumn: { type: 'string' },
          columns: { type: 'array', items: { type: 'string' } },
          filters: { type: 'object' },
          search: { type: 'string' },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string', format: 'date' },
              end: { type: 'string', format: 'date' }
            }
          },
          relationColumns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                local_key: { type: 'string' },
                foreign_table: { type: 'string' },
                foreign_key: { type: 'string' },
                display_columns: { type: 'array', items: { type: 'string' } },
                filters: { type: 'object' }
              },
              required: ['label', 'local_key', 'foreign_table', 'foreign_key', 'display_columns']
            }
          },
          aggColumns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                local_key: { type: 'string' },
                foreign_table: { type: 'string' },
                foreign_key: { type: 'string' },
                function: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max', 'array_agg', 'string_agg'] },
                function_field: { type: 'string' },
                filters: { type: 'object' },
                group_by: { type: 'array', items: { type: 'string' } }
              },
              required: ['label', 'local_key', 'foreign_table', 'foreign_key', 'function']
            }
          },
          aggregation_filter: { type: 'array', items: { type: 'string' } }
        },
        required: ['taskNameColumn', 'startDateColumn', 'endDateColumn']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            tasks: { type: 'array', additionalProperties: true },
            timeline: { type: 'object', additionalProperties: true },
            aggregation: { type: 'object', additionalProperties: true },
            total: { type: 'number' }
          }
        }
      }
    },
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const queryRequest = request.body as GanttQueryRequest;
      const { id: userId, companyId, storeId } = (request as any).user;

      const result = await executeGanttQuery(companyId, table_slug, userId, queryRequest);
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error('Error executing Gantt query:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Table not found' });
      }
      
      if (error.message.includes('column') && error.message.includes('not found')) {
        return reply.status(400).send({ error: error.message });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Breadcrumb endpoint for hierarchical data
  fastify.post('/records/:table_slug/breadcrumb', {
    schema: {
      params: {
        type: 'object',
        properties: {
          table_slug: { type: 'string' }
        },
        required: ['table_slug']
      },
      body: {
        type: 'object',
        properties: {
          record_id: { type: 'string' },
          label_column: { type: 'string' },
          value_column: { type: 'string' },
          parent_column: { type: 'string' },
          direction: { 
            type: 'string', 
            enum: ['root_to_current', 'current_to_root'],
            default: 'root_to_current'
          },
          max_depth: { 
            type: 'number', 
            minimum: 1, 
            maximum: 100,
            default: 50
          }
        },
        required: ['record_id', 'label_column', 'value_column', 'parent_column']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            breadcrumb: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  value: { type: 'string' }
                }
              }
            },
            depth: { type: 'number' }
          }
        }
      }
    },
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const { 
        record_id, 
        label_column, 
        value_column, 
        parent_column, 
        direction = 'root_to_current',
        max_depth = 50
      } = request.body as {
        record_id: string;
        label_column: string;
        value_column: string;
        parent_column: string;
        direction?: 'root_to_current' | 'current_to_root';
        max_depth?: number;
      };
      const { id: userId, companyId, storeId } = (request as any).user;

      const result = await getBreadcrumb(
        companyId, 
        table_slug, 
        record_id, 
        label_column, 
        value_column, 
        parent_column, 
        direction, 
        max_depth, 
        userId
      );
      
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error('Error getting breadcrumb:', error);
      
      if (error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      
      if (error.message.includes('column') && error.message.includes('not found')) {
        return reply.status(400).send({ error: error.message });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Dropdown query endpoint
  fastify.post('/records/:table_slug/query/dropdown', {
    schema: {
      params: {
        type: 'object',
        properties: {
          table_slug: { type: 'string', pattern: '^[a-z0-9_]+$' }
        },
        required: ['table_slug']
      },
      body: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
          search: { type: 'string' },
          filters: { type: 'object' },
          sort: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                direction: { type: 'string', enum: ['ASC', 'DESC'] }
              },
              required: ['field', 'direction']
            }
          },
          limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
          distinct: { type: 'boolean', default: true },
          includeEmpty: { type: 'boolean', default: false },
          groupBy: { type: 'string' }
        },
        required: ['label', 'value']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            options: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true
              }
            },
            total: { type: 'number' },
            hasMore: { type: 'boolean' }
          }
        }
      }
    },
    preHandler: [requireAuth, requireCompany],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { table_slug } = request.params as { table_slug: string };
      const queryRequest = request.body as DropdownQueryRequest;
      const { id: userId, companyId, storeId } = (request as any).user;

      const result = await executeDropdownQuery(companyId, table_slug, userId, queryRequest);
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error('Error executing dropdown query:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: 'Table not found' });
      }
      
      if (error.message.includes('column') && error.message.includes('not found')) {
        return reply.status(400).send({ error: error.message });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

};
