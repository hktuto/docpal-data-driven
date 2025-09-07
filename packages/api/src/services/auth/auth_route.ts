// Authentication routes for DocPal API

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import {
  authenticateUser,
  createUser,
  createSession,
  destroySession,
  getUserCompanies,
  validateSession,
  validateUserCompanyRelationship,
} from './auth_service';
import { query, queryInTenantSchema } from '../../database/utils/database';

/**
 * Fastify JSON Schemas with const assertions for automatic type inference
 */

// User response schema
const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    first_name: { type: 'string', nullable: true },
    last_name: { type: 'string', nullable: true },
    is_active: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  }
} as const;

// Company response schema
const companySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    role: { type: 'string' }
  }
} as const;

// Company with role schema (for user's companies list)
const companyWithRoleSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string', nullable: true },
    role: { type: 'string' },
    joined_at: { type: 'string', format: 'date-time' }
  }
} as const;

// Error response schema
const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' }
  },
  required: ['error']
} as const;

// Login schema
const loginSchema = {
  tags: ['auth'],
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 1 },
      companyId: { type: 'string', format: 'uuid' }
    },
    required: ['email', 'password', 'companyId'],
    additionalProperties: false
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        user: userSchema,
        company: companySchema
      }
    },
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    404: errorSchema,
    500: errorSchema
  }
} as const;

// Register schema
const registerSchema = {
  tags: ['auth'],
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 }
    },
    required: ['email', 'password'],
    additionalProperties: false
  },
  response: {
    201: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        user: userSchema
      }
    },
    400: errorSchema,
    409: errorSchema,
    500: errorSchema
  }
} as const;

// Logout schema
const logoutSchema = {
  tags: ['auth'],
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    },
    500: errorSchema
  }
} as const;

// Get companies schema
const getCompaniesSchema = {
  tags: ['auth'],
  description: 'Get available companies for user by email/password',
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 1 }
    },
    required: ['email', 'password'],
    additionalProperties: false
  },
  response: {
    200: {
      type: 'array',
      items: companyWithRoleSchema
    },
    400: errorSchema,
    401: errorSchema,
    500: errorSchema
  }
} as const;

// Session schema
const sessionSchema = {
  tags: ['auth'],
  response: {
    200: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            userProfile: { 
              type: 'object',
              
              additionalProperties: true
             },
          },
          additionalProperties: true
        },
        company:{
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          additionalProperties: true
        }
      }
    },
    401: errorSchema,
    500: errorSchema
  }
} as const;

/**
 * Register authentication routes
 */
export const registerAuthRoutes = async (fastify: FastifyInstance) => {
  // Login endpoint
  fastify.post('/login', {
    schema: loginSchema,
  }, async (request, reply) => {
    try {
      const { email, password, companyId } = request.body as { email: string; password: string; companyId: string };
      
      // Validate input
      if (!email || !password || !companyId) {
        return reply.status(400).send({
          error: 'Email, password, and companyId are required',
        });
      }
      
      // Authenticate user
      const user = await authenticateUser({ email, password });
      if (!user) {
        return reply.status(401).send({
          error: 'Invalid email or password',
        });
      }
      
      // Validate user-company relationship
      const isValidRelationship = await validateUserCompanyRelationship(user.id, companyId);
      if (!isValidRelationship) {
        return reply.status(403).send({
          error: 'User does not belong to the specified company',
        });
      }
      
      // Get company information

      const companyResult = await query(
        'SELECT id, name FROM company WHERE id = $1 AND status = $2',
        [companyId, 'active']
      );
      
      if (companyResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'Company not found',
        });
      }
      
      const company = companyResult.rows[0];
      
      // Generate session token
      const sessionId = uuidv4();
      
      // Create session with company
      await createSession(sessionId, user, companyId);

      // Set session cookie
      reply.setCookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600 * 7, // 7 hour
        path: '/',
      });
      
      return reply.status(200).send({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
        },
        company: {
          id: company.id,
          name: company.name,
        },
      });
      
    } catch (error: any) {
      request.log.error('Login error:', error.message || String(error));
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });
  
  // Register endpoint
  fastify.post('/register', {
    schema: registerSchema,
  }, async (request, reply) => {
    try {
      const { email, password } = request.body as { email: string; password: string };
      
      // Validate input
      if (!email || !password) {
        return reply.status(400).send({
          error: 'Email and password are required',
        });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return reply.status(400).send({
          error: 'Invalid email format',
        });
      }
      
      // Validate password strength
      if (password.length < 8) {
        return reply.status(400).send({
          error: 'Password must be at least 8 characters long',
        });
      }
      
      // Create user
      const user = await createUser({ email, password });
      
      return reply.status(201).send({
        user: {
          id: user.id,
          email: user.email,
        },
        message: 'User created successfully. Please login.',
      });
      
    } catch (error: any) {
      if (error instanceof Error && error.message === 'User already exists with this email') {
        return reply.status(409).send({
          error: 'User already exists with this email',
        });
      }
      
      request.log.error('Registration error: ' + (error.message || String(error)));
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });
  
  // Get available companies for user (by email/password)
  fastify.post('/companies', {
    schema: getCompaniesSchema,
  }, async (request, reply) => {
    try {
      const { email, password } = request.body as { email: string; password: string };
      
      // Authenticate user
      const user = await authenticateUser({ email, password });
      if (!user) {
        return reply.status(401).send({
          error: 'Invalid email or password',
        });
      }
      
      // Get user's companies
      const companies = await getUserCompanies(user.id);
      
      return reply.status(200).send(companies);
    } catch (error: any) {
      request.log.error('Get companies error: ' + (error.message || String(error)));
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });
  
  // Logout endpoint
  fastify.post('/logout', {
    schema: logoutSchema,
  }, async (request, reply) => {
    try {
      const sessionId = request.cookies.sessionId;
      if (sessionId) {
        const session = await validateSession(sessionId);
        await destroySession(sessionId, session?.userId);
      }
      
      // Clear session cookie
      reply.clearCookie('sessionId');
      
      return reply.status(200).send({
        message: 'Logged out successfully',
      });
      
    } catch (error: any) {
      request.log.error('Logout error: ' + (error.message || String(error)));
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });
  
  // Session info endpoint
  fastify.get('/session', {
    schema: sessionSchema,
  }, async (request, reply) => {
    try {
      const sessionId = request.cookies.sessionId;
      console.log('-----------sessionId in get session', sessionId);
      if (!sessionId) {
        return reply.status(401).send({
          error: 'No session found',
        });
      }
      
      // Validate session
      const session = await validateSession(sessionId);
      if (!session) {
        return reply.status(401).send({
          error: 'Invalid or expired session',
        });
      }
      if (!session.companyId) {
        return reply.status(401).send({
          error: 'No company found',
        });
      }
      
      // Get user's companies
      const company = await query('SELECT * FROM company WHERE id = $1 ', [session.companyId]);
      const userProfile = await queryInTenantSchema(session.companyId, 'SELECT * FROM user_profile WHERE id = $1', [session.userId]);
      
      const result = {
        user: {
          id: session.userId,
          email: session.email,
          userProfile: userProfile.rows[0],
        },
        company: company.rows[0],
        loginTime: session.loginTime,
      }
      return reply.status(200).send(result);
      
    } catch (error: any) {
      request.log.error('Session info error: ' + (error.message || String(error)));
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });
};
