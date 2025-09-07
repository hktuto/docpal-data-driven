// Role Routes for DocPal API
// Handles role management endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  getRoles, 
  getRoleById, 
  createRole, 
  updateRole, 
  deleteRole,
  getRoleHierarchy,
  getRoleDescendants,
  searchRoles,
  CreateRoleData,
  UpdateRoleData
} from './role_service';
import { requireAuth, requireCompany } from '../auth/auth_middleware';

// Schemas
const roleSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    parent_role_id: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'name', 'slug', 'description', 'created_at', 'updated_at']
} as const;

const roleWithHierarchySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    parent_role_id: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    children: {
      type: 'array',
      items: roleSchema
    },
    parent: roleSchema
  },
  required: ['id', 'name', 'slug', 'description', 'created_at', 'updated_at']
} as const;

const createRoleSchema = {
  tags: ['roles'],
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 128 },
      slug: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-z0-9-_]+$' },
      description: { type: 'string', minLength: 1, maxLength: 256 },
      parent_role_id: { type: 'string', format: 'uuid' }
    },
    required: ['name', 'slug', 'description'],
    additionalProperties: false
  },
  response: {
    201: roleSchema,
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
} as const;

const updateRoleSchema = {
  tags: ['roles'],
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 128 },
      slug: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-z0-9-_]+$' },
      description: { type: 'string', minLength: 1, maxLength: 256 },
      parent_role_id: { type: 'string', format: 'uuid' }
    },
    additionalProperties: false
  },
  response: {
    200: roleSchema,
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
} as const;

const getRoleSchema = {
  tags: ['roles'],
  response: {
    200: roleSchema,
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
} as const;

const getRolesSchema = {
  tags: ['roles'],
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      hierarchy: { type: 'boolean', default: false }
    }
  },
  response: {
    200: {
      oneOf: [
        {
          type: 'array',
          items: roleSchema
        },
        {
          type: 'array',
          items: roleWithHierarchySchema
        }
      ]
    }
  }
} as const;

const getRoleDescendantsSchema = {
  tags: ['roles'],
  response: {
    200: {
      type: 'array',
      items: roleSchema
    },
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
} as const;

/**
 * Register role routes
 */
export const registerRoleRoutes = async (fastify: FastifyInstance) => {
  // GET /api/roles - List all roles
  fastify.get('/roles', {
    schema: getRolesSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { search, limit, hierarchy } = request.query as { 
        search?: string; 
        limit?: number; 
        hierarchy?: boolean 
      };
      
      let roles;
      if (search) {
        roles = await searchRoles(companyId, search, limit || 50);
      } else if (hierarchy) {
        roles = await getRoleHierarchy(companyId);
      } else {
        roles = await getRoles(companyId);
      }
      
      return reply.status(200).send(roles);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/roles - Create new role
  fastify.post('/roles', {
    schema: createRoleSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const roleData = request.body as CreateRoleData;
      
      const role = await createRole(companyId, roleData);
      
      return reply.status(201).send(role);
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error) {
        if (error.message.includes('already exists') || 
            error.message.includes('not found') ||
            error.message.includes('circular reference')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/roles/:roleId - Get role by ID
  fastify.get('/roles/:roleId', {
    schema: getRoleSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { roleId } = request.params as { roleId: string };
      
      const role = await getRoleById(companyId, roleId);
      
      if (!role) {
        return reply.status(404).send({ error: 'Role not found' });
      }
      
      return reply.status(200).send(role);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/roles/:roleId - Update role
  fastify.put('/roles/:roleId', {
    schema: updateRoleSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { roleId } = request.params as { roleId: string };
      const updateData = request.body as UpdateRoleData;
      
      const role = await updateRole(companyId, roleId, updateData);
      
      return reply.status(200).send(role);
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error) {
        if (error.message.includes('already exists') || 
            error.message.includes('not found') ||
            error.message.includes('circular reference') ||
            error.message.includes('cannot be its own parent')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/roles/:roleId - Delete role
  fastify.delete('/roles/:roleId', {
    schema: {
      tags: ['roles'],
      response: {
        204: { type: 'null' },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      },
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { roleId } = request.params as { roleId: string };
      
      await deleteRole(companyId, roleId);
      
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        if (error.message.includes('child roles') || 
            error.message.includes('assigned to users')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/roles/:roleId/descendants - Get role descendants
  fastify.get('/roles/:roleId/descendants', {
    schema: getRoleDescendantsSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { roleId } = request.params as { roleId: string };
      
      // First check if role exists
      const role = await getRoleById(companyId, roleId);
      if (!role) {
        return reply.status(404).send({ error: 'Role not found' });
      }
      
      const descendants = await getRoleDescendants(companyId, roleId);
      
      return reply.status(200).send(descendants);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
};
