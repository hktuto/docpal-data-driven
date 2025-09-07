import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, SessionContext } from '../auth/auth_middleware';
import { requireCompany } from '../company/company_middleware';
import {
  getSchemas,
  getSchemaBySlug,
  createSchema,
  updateSchema,
  deleteSchema,
  CreateSchemaRequest,
  UpdateSchemaRequest
} from './schema_service';
import {
  getTableEvents,
  updateTableEvents,
  removeTableEvents,
  getTablesWithEvents
} from './schema-events-service';

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' }
  },
  required: ['error']
} as const;

// Schema definitions for request validation
const createSchemaSchema = {
  body: {
    type: 'object',
    properties: {
      slug: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' },
      label: { type: 'string', minLength: 1 },
      description: { type: 'string', minLength: 1 },
      is_system: { type: 'boolean' },
      is_relation: { type: 'boolean' },
      columns: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' },
            data_type: { type: 'string' },
            data_type_options: {
              type: 'object',
              properties: {
                length: { type: 'number' },
                precision: { type: 'number' },
                scale: { type: 'number' }
              }
            },
            nullable: { type: 'boolean' },
            default: {},
            view_type: { 
              type: 'string',
              enum: ['text', 'number', 'boolean', 'datetime', 'file', 'relation', 'json', 'select']
            },
            view_validation: { type: 'object' },
            view_editor: { type: 'string' },
            view_editor_options: { type: 'object' },
            is_relation: { type: 'boolean' },
            relation_setting: { type: 'object' }
          },
          required: ['name', 'data_type', 'nullable', 'view_type', 'view_editor']
        }
      }
    },
    required: ['slug', 'label', 'description', 'columns']
  }
} as const;

const updateSchemaSchema = {
  tags: ['Schema'],
  summary: 'Update a schema',
  description: 'Update an existing custom data model and modify the database table structure',
  body: {
    type: 'object',
    properties: {
      label: { type: 'string', minLength: 1 },
      description: { type: 'string', minLength: 1 },
      columns: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' },
            data_type: { type: 'string' },
            data_type_options: {
              type: 'object',
              properties: {
                length: { type: 'number' },
                precision: { type: 'number' },
                scale: { type: 'number' }
              }
            },
            nullable: { type: 'boolean' },
            default: {},
            view_type: { 
              type: 'string',
              enum: ['text', 'number', 'boolean', 'datetime', 'file', 'relation', 'json']
            },
            view_validation: { type: 'object' },
            view_editor: { type: 'string' },
            view_editor_options: { type: 'object' },
            is_relation: { type: 'boolean' },
            relation_setting: { type: 'object' }
          },
          required: ['name', 'data_type', 'nullable', 'view_type', 'view_editor']
        }
      }
    }
  }
} as const;

const schemaParamsSchema = {
  params: {
    type: 'object',
    properties: {
      table_slug: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' }
    },
    required: ['table_slug']
  }
} as const;

const SchemaResponseItem = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    label: { type: 'string' },
    is_system: { type: 'boolean' },
    is_relation: { type: 'boolean' },
    description: { type: 'string' },
    columns: { type: 'array' },
    company_id: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' }
  }
}

const SchemaListResponse = {
  type: 'array',
  items: SchemaResponseItem
} as const;

/**
 * Schema Routes - Dynamic data model management
 * All routes require authentication and company context
 */
export const registerSchemaRoutes = async (fastify: FastifyInstance) => {
  // Apply authentication and company middleware to all schema routes
  await fastify.register(async function (fastify) {
    fastify.addHook('preHandler', requireAuth);
    fastify.addHook('preHandler', requireCompany);

    /**
     * GET /api/schemas
     * List all schemas for the current company
     */
    fastify.get('/schemas', {
      schema: {
        tags: ['Schema'],
        summary: 'List all schemas',
        description: 'Get all custom data models for the current company',
        response: {
          200: SchemaListResponse,
          401: errorSchema,
          403: errorSchema,
          500: errorSchema
        }
      }
    }, async (request, reply) => {
      try {
        const { companyId,id:userId } = request.user as SessionContext;
        if(!companyId || !userId){
          return reply.status(401).send({ error: 'Unauthorized' });
        }
        
        const schemas = await getSchemas(companyId, userId);
        console.log('---------------schemas', schemas);
        return reply.status(200).send(schemas);
      } catch (error) {
        request.log.error('Error listing schemas: ' + (error instanceof Error ? error.message : String(error)));
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    /**
     * POST /api/schemas
     * Create a new schema
     */
    fastify.post('/schemas', {
      schema: {
        ...createSchemaSchema,
        tags: ['Schema'],
        summary: 'Create a new schema',
        description: 'Create a new custom data model and corresponding database table',
        response: {
          201: SchemaResponseItem,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          500: errorSchema
        }
      }
    }, async (request, reply) => {
      try {
        const { companyId,id:userId } = request.user as SessionContext;
        if(!companyId || !userId){
          console.log('---------------Unauthorized', companyId, userId);
          return reply.status(401).send({ error: 'Unauthorized' });
        }
        const schemaData = request.body as CreateSchemaRequest;
        
        const newSchema = await createSchema(companyId, userId, schemaData);
        return reply.status(201).send(newSchema);
      } catch (error) {
        request.log.error('Error creating schema: ' + (error instanceof Error ? error.message : String(error)));
        
        if (error instanceof Error) {
          if (error.message.includes('already exists')) {
            return reply.status(400).send({ error: error.message });
          }
          if (error.message.includes('required') || error.message.includes('Invalid')) {
            return reply.status(400).send({ error: error.message });
          }
        }
        
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    /**
     * GET /api/schemas/:table_slug
     * Get a specific schema by slug
     */
    fastify.get('/schemas/:table_slug', {
      schema: {
        ...schemaParamsSchema,
        tags: ['Schema'],
        summary: 'Get schema by slug',
        description: 'Get a specific custom data model by its slug',
        response: {
          200: SchemaResponseItem,
          401: errorSchema,
          404: errorSchema,
          403: errorSchema,
          500: errorSchema
        }
      }
    }, async (request, reply) => {
      try {
        const { companyId,id:userId } = request.user as SessionContext;
        if(!companyId || !userId){
          return reply.status(401).send({ error: 'Unauthorized' });
        }
        const { table_slug } = request.params as { table_slug: string };
        
        const schema = await getSchemaBySlug(companyId, table_slug, userId);
        
        if (!schema) {
          return reply.status(404).send({ error: 'Schema not found' });
        }
        
        return reply.status(200).send(schema);
      } catch (error) {
        request.log.error('Error fetching schema: ' + (error instanceof Error ? error.message : String(error)));
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    /**
     * PUT /api/schemas/:table_slug
     * Update an existing schema
     */
    fastify.put('/schemas/:table_slug', {
      schema: {
        ...updateSchemaSchema,
        ...schemaParamsSchema,
        tags: ['Schema'],
        summary: 'Update schema',
        description: 'Update an existing custom data model and modify the database table structure',
        response: {
          200: SchemaResponseItem,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          403: errorSchema,
          500: errorSchema
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { companyId,id:userId } = request.user as SessionContext;
        if(!companyId || !userId){
          return reply.status(401).send({ error: 'Unauthorized' });
        }
        const { table_slug } = request.params as { table_slug: string };
        const updateData = request.body as UpdateSchemaRequest;
        
        const updatedSchema = await updateSchema(companyId, table_slug, userId, updateData);
        
        return reply.status(200).send(updatedSchema);
      } catch (error) {
        request.log.error('Error updating schema: ' + (error instanceof Error ? error.message : String(error)));
        
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return reply.status(404).send({ error: error.message });
          }
          if (error.message.includes('required') || error.message.includes('Invalid')) {
            return reply.status(400).send({ error: error.message });
          }
        }
        
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    /**
     * DELETE /api/schemas/:table_slug
     * Delete a schema and its database table
     */
    fastify.delete('/schemas/:table_slug', {
      schema: {
        ...schemaParamsSchema,
        tags: ['Schema'],
        summary: 'Delete schema',
        description: 'Delete a custom data model and its corresponding database table',
        response: {
          204: {
            type: 'null',
            description: 'Schema deleted successfully'
          },
          401: errorSchema,
          404: errorSchema,
          403: errorSchema,
          500: errorSchema
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { companyId,id:userId } = request.user as SessionContext;
        if(!companyId || !userId){
          return reply.status(401).send({ error: 'Unauthorized' });
        }
        const { table_slug } = request.params as { table_slug: string };
        
        await deleteSchema(companyId, table_slug, userId);
        
        return reply.status(204).send();
      } catch (error) {
        request.log.error('Error deleting schema: ' + (error instanceof Error ? error.message : String(error)));
        
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return reply.status(404).send({ error: error.message });
          }
          if (error.message.includes('Cannot delete system schemas')) {
            return reply.status(403).send({ error: error.message });
          }
        }
        
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    /**
     * GET /api/schemas/:table_slug/events
     * Get event configuration for a table
     */
    fastify.get('/schemas/:table_slug/events', {
      schema: {
        ...schemaParamsSchema,
        tags: ['Schema Events'],
        summary: 'Get table event configuration',
        description: 'Get workflow event configuration for a custom data table',
        response: {
          200: {
            type: 'object',
            description: 'Event configuration'
          },
          401: errorSchema,
          404: errorSchema,
          500: errorSchema
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { companyId } = request.user as SessionContext;
        if (!companyId) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }
        const { table_slug } = request.params as { table_slug: string };
        
        const events = await getTableEvents(companyId, table_slug);
        
        return reply.status(200).send(events);
      } catch (error) {
        request.log.error('Error getting table events: ' + (error instanceof Error ? error.message : String(error)));
        
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    /**
     * PUT /api/schemas/:table_slug/events
     * Update event configuration for a table
     */
    fastify.put('/schemas/:table_slug/events', {
      schema: {
        ...schemaParamsSchema,
        body: {
          type: 'object',
          properties: {
            triggers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  workflow_slug: { type: 'string' },
                  event: { type: 'string', enum: ['insert', 'update', 'delete', 'any'] },
                  conditions: { type: 'object' }
                },
                required: ['workflow_slug', 'event']
              }
            }
          }
        },
        tags: ['Schema Events'],
        summary: 'Update table event configuration',
        description: 'Configure workflow triggers for a custom data table',
        response: {
          200: {
            type: 'object',
            description: 'Updated event configuration'
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
        const { table_slug } = request.params as { table_slug: string };
        const events = request.body as any;
        
        const updatedEvents = await updateTableEvents(companyId, table_slug, events, userId);
        
        return reply.status(200).send(updatedEvents);
      } catch (error) {
        request.log.error('Error updating table events: ' + (error instanceof Error ? error.message : String(error)));
        
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return reply.status(404).send({ error: error.message });
          }
          if (error.message.includes('must be') || error.message.includes('Event must')) {
            return reply.status(400).send({ error: error.message });
          }
        }
        
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    /**
     * DELETE /api/schemas/:table_slug/events
     * Remove event configuration for a table
     */
    fastify.delete('/schemas/:table_slug/events', {
      schema: {
        ...schemaParamsSchema,
        tags: ['Schema Events'],
        summary: 'Remove table event configuration',
        description: 'Remove all workflow event configuration for a custom data table',
        response: {
          204: {
            type: 'null',
            description: 'Event configuration removed successfully'
          },
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
        const { table_slug } = request.params as { table_slug: string };
        
        await removeTableEvents(companyId, table_slug, userId);
        
        return reply.status(204).send();
      } catch (error) {
        request.log.error('Error removing table events: ' + (error instanceof Error ? error.message : String(error)));
        
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    /**
     * GET /api/schemas/events
     * Get all tables with event configurations
     */
    fastify.get('/schemas/events', {
      schema: {
        tags: ['Schema Events'],
        summary: 'List tables with event configurations',
        description: 'Get all custom data tables that have workflow event configurations',
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                slug: { type: 'string' },
                label: { type: 'string' },
                events: { type: 'object' }
              }
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
        
        const tablesWithEvents = await getTablesWithEvents(companyId);
        
        return reply.status(200).send(tablesWithEvents);
      } catch (error) {
        request.log.error('Error getting tables with events: ' + (error instanceof Error ? error.message : String(error)));
        
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });
  });
};
