import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../../database/utils/database';
import { requireAuth, SessionRequest } from '../auth/auth_middleware';
import {
  createCompany,
  createCompanyWithAdmin,
  getCompanyById,
  getCompanyBySlug,
  getUserCompanies,
  checkUserCompanyAccess,
  addUserToCompany,
  updateUserRole,
  removeUserFromCompany,
  seedCompanyDefaults,
  type CompanyRegistrationData,
  type EnhancedCompanyRegistrationData,
} from './company_service.js';

/**
 * Fastify JSON Schemas with const assertions for automatic type inference
 */

// Company response schema
const companySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string', nullable: true },
    settings: { type: 'object' },
    status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
    created_by: { type: 'string' },
    openfga_store_id: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  }
} as const;

// Company with role schema
const companyWithRoleSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string', nullable: true },
    settings: { type: 'object' },
    status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
    created_by: { type: 'string' },
    openfga_store_id: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    role: { type: 'string' },
    joined_at: { type: 'string', format: 'date-time' }
  }
} as const;

// Error response schema
const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' }
  },
  required: ['error']
} as const;

// Get companies schema
const getCompaniesSchema = {
  tags: ['company'],
  description: 'Get companies schema',
  response: {
    200: {
      type: 'array',
      items: companyWithRoleSchema
    },
    401: errorSchema,
    500: errorSchema
  }
} as const;

// Create company schema (enhanced with admin user)
const createCompanySchema = {
  tags: ['company'],
  description: 'Create company with admin user schema',
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      slug: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-z0-9-]+$' },
      description: { type: 'string', maxLength: 1000 },
      settings: { type: 'object' },
      admin: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email', maxLength: 128 },
          password: { type: 'string', minLength: 8, maxLength: 128 },
          profile: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 128 },
              email: { type: 'string', format: 'email', maxLength: 128 },
              phone: { type: 'string', maxLength: 128 },
              address: { type: 'string', maxLength: 256 },
              city: { type: 'string', maxLength: 128 },
              preferences: { type: 'object' }
            },
            required: ['name', 'email', 'phone'],
            additionalProperties: false
          }
        },
        required: ['email', 'password', 'profile'],
        additionalProperties: false
      }
    },
    required: ['name', 'slug', 'admin'],
    additionalProperties: false
  },
  response: {
    201: {
      type: 'object',
      properties: {
        company: companySchema,
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            isNewUser: { type: 'boolean' }
          }
        },
        sessionToken: { type: 'string' },
        message: { type: 'string' }
      }
    },
    400: errorSchema,
    409: errorSchema,
    500: errorSchema
  }
} as const;

// Get company by ID schema
const getCompanySchema = {
  tags: ['company'],
  description: 'Get company by ID schema',
  params: {
    type: 'object',
    properties: {
      companyId: { type: 'string', format: 'uuid' }
    },
    required: ['companyId']
  },
  response: {
    200: companySchema,
    401: errorSchema,
    403: errorSchema,
    404: errorSchema,
    500: errorSchema
  }
} as const;


// Add user to company schema
const addUserSchema = {
  tags: ['company'],
  description: 'Add user to company schema',
  params: {
    type: 'object',
    properties: {
      companyId: { type: 'string', format: 'uuid' }
    },
    required: ['companyId']
  },
  body: {
    type: 'object',
    properties: {
      userId: { type: 'string', format: 'uuid' },
      role: { type: 'string', enum: ['owner', 'admin', 'member'], default: 'member' }
    },
    required: ['userId'],
    additionalProperties: false
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    },
    401: errorSchema,
    403: errorSchema,
    409: errorSchema,
    500: errorSchema
  }
} as const;


// Remove user schema
const removeUserSchema = {
  tags: ['company'],
  description: 'Remove user from company schema',
  params: {
    type: 'object',
    properties: {
      companyId: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' }
    },
    required: ['companyId', 'userId']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    },
    401: errorSchema,
    403: errorSchema,
    500: errorSchema
  }
} as const;

/**
 * Register company routes
 */
export const registerCompanyRoutes = async (fastify: FastifyInstance) => {
  const pool = getPool();

  // Get user's companies
  fastify.get('/companies', {
    schema: getCompaniesSchema,
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'User not found in session' });
      }

      const companies = await getUserCompanies(pool, userId);
      return reply.status(200).send(companies);
    } catch (error: any) {
      request.log.error('Error fetching user companies: ' + (error.message || String(error)));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create new company with admin user
  fastify.post('/companies', {
    schema: createCompanySchema,
  }, async (request, reply) => {
    try {
      const registrationData = request.body as EnhancedCompanyRegistrationData;

      // Validate required fields
      if (!registrationData.name || !registrationData.slug || !registrationData.admin) {
        return reply.status(400).send({ error: 'Name, slug, and admin user data are required' });
      }

      // Check if slug is already taken
      const existingCompany = await getCompanyBySlug(pool, registrationData.slug);
      if (existingCompany) {
        return reply.status(409).send({ error: 'Company slug already exists' });
      }

      // Create company with admin user
      const result = await createCompanyWithAdmin(pool, registrationData);

      // Seed default data
      await seedCompanyDefaults(pool, result.company.id, result.user.id);
      reply.setCookie('sessionToken', result.sessionToken)
      return reply.status(201).send({
        ...result,
        message: 'Company and admin user created successfully',
      });
    } catch (error: any) {
      request.log.error('Error creating company with admin: ' + (error.message || String(error)));
      
      if (error.message.includes('already exists')) {
        return reply.status(409).send({ error: error.message });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get company by ID
  fastify.get('/companies/:companyId', {
    schema: getCompanySchema,
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const { companyId } = request.params as { companyId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'User not found in session' });
      }

      // Check if user has access to this company
      const access = await checkUserCompanyAccess(pool, userId, companyId);
      if (!access.hasAccess) {
        return reply.status(403).send({ error: 'Access denied to this company' });
      }

      const company = await getCompanyById(pool, companyId);
      if (!company) {
        return reply.status(404).send({ error: 'Company not found' });
      }

      return reply.status(200).send(company);
    } catch (error: any) {
      request.log.error('Error fetching company: ' + (error.message || String(error)));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });


  // Add user to company
  fastify.post('/companies/:companyId/users', {
    schema: addUserSchema,
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const { companyId } = request.params as { companyId: string };
      const { userId: targetUserId, role = 'member' } = request.body as { userId: string; role?: string };
      const currentUserId = request.user?.id;

      if (!currentUserId) {
        return reply.status(401).send({ error: 'User not found in session' });
      }

      // Check if current user has admin access to this company
      const access = await checkUserCompanyAccess(pool, currentUserId, companyId);
      if (!access.hasAccess || !['owner', 'admin'].includes(access.role!)) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      await addUserToCompany(pool, companyId, targetUserId, role, currentUserId);

      return reply.status(201).send({ message: 'User added to company successfully' });
    } catch (error: any) {
      request.log.error('Error adding user to company: ' + (error.message || String(error)));
      
      if (error.message.includes('already a member')) {
        return reply.status(409).send({ error: error.message });
      }
      
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });


  // Remove user from company
  fastify.delete('/companies/:companyId/users/:userId', {
    schema: removeUserSchema,
    preHandler: [requireAuth],
  }, async (request, reply) => {
    try {
      const { companyId, userId: targetUserId } = request.params as { companyId: string; userId: string };
      const currentUserId = request.user?.id;

      if (!currentUserId) {
        return reply.status(401).send({ error: 'User not found in session' });
      }

      // Check if current user has admin access to this company
      const access = await checkUserCompanyAccess(pool, currentUserId, companyId);
      if (!access.hasAccess || !['owner', 'admin'].includes(access.role!)) {
        return reply.status(403).send({ error: 'Insufficient permissions' });
      }

      await removeUserFromCompany(pool, companyId, targetUserId);

      return reply.status(200).send({ message: 'User removed from company successfully' });
    } catch (error: any) {
      request.log.error('Error removing user from company: ' + (error.message || String(error)));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
};
