// Data View Routes for DocPal API
// Handles data view management endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, requireCompany } from '../auth/auth_middleware';
import {
  getDataViews,
  getDataViewById,
  createDataView,
  updateDataView,
  deleteDataView,
  setDefaultDataView,
  searchDataViews,
  CreateDataViewData,
  UpdateDataViewData
} from './dataview_service';
import {
  renderDataView,
  renderViewWidget,
  RenderViewRequest,
  RenderWidgetRequest
} from './dataview_render_service';

// Schemas
const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' }
  },
  required: ['error']
} as const;

const viewWidgetSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    label: { type: 'string' },
    column: { type: 'integer', minimum: 1, maximum: 24 },
    row: { type: 'integer', minimum: 1 },
    width: { type: 'integer', minimum: 1, maximum: 24 },
    height: { type: 'integer', minimum: 1 },
    component: { type: 'string' },
    config: { type: 'object' }
  },
  required: ['id', 'label', 'column', 'row', 'width', 'height', 'component', 'config']
} as const;

const dataViewSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    table_slug: { type: 'string' },
    is_default: { type: 'boolean' },
    layout: {
      type: 'array',
      items: viewWidgetSchema
    },
    created_by: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'name', 'table_slug', 'is_default', 'layout', 'created_by', 'created_at', 'updated_at']
} as const;

const createDataViewSchema = {
  tags: ['data-views'],
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 128 },
      description: { type: 'string', maxLength: 512 },
      is_default: { type: 'boolean' },
      layout: {
        type: 'array',
        minItems: 1,
        items: viewWidgetSchema
      }
    },
    required: ['name', 'layout'],
    additionalProperties: false
  },
  response: {
    201: dataViewSchema,
    400: errorSchema,
    404: errorSchema
  }
} as const;

const updateDataViewSchema = {
  tags: ['data-views'],
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 128 },
      description: { type: 'string', maxLength: 512 },
      is_default: { type: 'boolean' },
      layout: {
        type: 'array',
        minItems: 1,
        items: viewWidgetSchema
      }
    },
    additionalProperties: false
  },
  response: {
    200: dataViewSchema,
    400: errorSchema,
    404: errorSchema
  }
} as const;

const getDataViewSchema = {
  tags: ['data-views'],
  response: {
    200: dataViewSchema,
    404: errorSchema
  }
} as const;

const getDataViewsSchema = {
  tags: ['data-views'],
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
    }
  },
  response: {
    200: {
      type: 'array',
      items: dataViewSchema
    }
  }
} as const;

const setDefaultViewSchema = {
  tags: ['data-views'],
  response: {
    200: dataViewSchema,
    404: errorSchema
  }
} as const;

const renderViewSchema = {
  tags: ['data-views'],
  body: {
    type: 'object',
    properties: {
      filters: { type: 'array' },
      globalFilters: { type: 'array' }
    },
    additionalProperties: false
  },
  response: {
    200: {
      type: 'object',
      properties: {
        view_id: { type: 'string' },
        view_name: { type: 'string' },
        table_slug: { type: 'string' },
        widgets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              widget_id: { type: 'string' },
              widget_label: { type: 'string' },
              component: { type: 'string' },
              data: {},
              error: { type: 'string', nullable: true }
            }
          }
        }
      }
    },
    404: errorSchema
  }
} as const;

const renderWidgetSchema = {
  tags: ['data-views'],
  body: {
    type: 'object',
    properties: {
      filters: { type: 'array' },
      globalFilters: { type: 'array' },
      widgetOverrides: { type: 'object' }
    },
    additionalProperties: false
  },
  response: {
    200: {
      type: 'object',
      properties: {
        widget_id: { type: 'string' },
        widget_label: { type: 'string' },
        component: { type: 'string' },
        data: {},
        error: { type: 'string', nullable: true }
      }
    },
    404: errorSchema
  }
} as const;

/**
 * Register data view routes
 */
export const registerDataViewRoutes = async (fastify: FastifyInstance) => {
  // GET /api/views/:table_slug - List all data views for a table
  fastify.get('/views/:table_slug', {
    schema: getDataViewsSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { table_slug } = request.params as { table_slug: string };
      const { search, limit } = request.query as { search?: string; limit?: number };
      
      let views;
      if (search) {
        views = await searchDataViews(companyId, table_slug, search, limit || 50);
      } else {
        views = await getDataViews(companyId, table_slug);
      }
      
      return reply.status(200).send(views);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/views/:table_slug - Create new data view
  fastify.post('/views/:table_slug', {
    schema: createDataViewSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, userId } = request as any;
      const { table_slug } = request.params as { table_slug: string };
      const viewData = request.body as CreateDataViewData;
      
      // Add table_slug to the view data
      const completeViewData = {
        ...viewData,
        table_slug
      };
      
      const view = await createDataView(companyId, completeViewData, userId);
      
      return reply.status(201).send(view);
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        if (error.message.includes('validation') || 
            error.message.includes('must') ||
            error.message.includes('required') ||
            error.message.includes('invalid')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/views/:table_slug/:view_id - Get data view by ID
  fastify.get('/views/:table_slug/:view_id', {
    schema: getDataViewSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { view_id } = request.params as { view_id: string };
      
      const view = await getDataViewById(companyId, view_id);
      
      if (!view) {
        return reply.status(404).send({ error: 'Data view not found' });
      }
      
      return reply.status(200).send(view);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/views/:table_slug/:view_id - Update data view
  fastify.put('/views/:table_slug/:view_id', {
    schema: updateDataViewSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { view_id } = request.params as { view_id: string };
      const updateData = request.body as UpdateDataViewData;
      
      const view = await updateDataView(companyId, view_id, updateData);
      
      return reply.status(200).send(view);
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        if (error.message.includes('validation') || 
            error.message.includes('must') ||
            error.message.includes('required') ||
            error.message.includes('invalid')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/views/:table_slug/:view_id - Delete data view
  fastify.delete('/views/:table_slug/:view_id', {
    schema: {
      tags: ['data-views'],
      response: {
        204: { type: 'null' },
        404: errorSchema
      }
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { view_id } = request.params as { view_id: string };
      
      await deleteDataView(companyId, view_id);
      
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/views/:table_slug/:view_id/default - Set view as default
  fastify.put('/views/:table_slug/:view_id/default', {
    schema: setDefaultViewSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { view_id } = request.params as { view_id: string };
      
      const view = await setDefaultDataView(companyId, view_id);
      
      return reply.status(200).send(view);
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/views/:table_slug/:view_id/render - Render complete view data
  fastify.post('/views/:table_slug/:view_id/render', {
    schema: renderViewSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { view_id } = request.params as { view_id: string };
      const renderRequest = request.body as RenderViewRequest;
      
      const renderedView = await renderDataView(companyId, view_id, renderRequest);
      
      return reply.status(200).send(renderedView);
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/views/:table_slug/:view_id/widgets/:widget_id/data - Render individual widget data
  fastify.post('/views/:table_slug/:view_id/widgets/:widget_id/data', {
    schema: renderWidgetSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { view_id, widget_id } = request.params as { view_id: string; widget_id: string };
      const renderRequest = request.body as RenderWidgetRequest;
      
      const renderedWidget = await renderViewWidget(companyId, view_id, widget_id, renderRequest);
      
      return reply.status(200).send(renderedWidget);
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
};
