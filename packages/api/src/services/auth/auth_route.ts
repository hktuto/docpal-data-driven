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
} from './auth_service';

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
      password: { type: 'string', minLength: 1 }
    },
    required: ['email', 'password'],
    additionalProperties: false
  },
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        user: userSchema,
        companies: {
          type: 'array',
          items: companySchema
        }
      }
    },
    400: errorSchema,
    401: errorSchema,
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
        user: userSchema,
        company: { ...companySchema, nullable: true }
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
      const { email, password } = request.body as { email: string; password: string };
      
      // Validate input
      if (!email || !password) {
        return reply.status(400).send({
          error: 'Email and password are required',
        });
      }
      
      // Authenticate user
      const user = await authenticateUser({ email, password });
      if (!user) {
        return reply.status(401).send({
          error: 'Invalid email or password',
        });
      }
      
      // Get user's companies
      const companies = await getUserCompanies(user.id);
      
      // Generate session token
      const sessionToken = uuidv4();
      
      if (companies.length === 0) {
        // User has no companies - they need to create or join one
        await createSession(sessionToken, user);
        
        // Set session cookie
        reply.setCookie('sessionToken', sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 3600, // 1 hour
        });
        
        return reply.status(200).send({
          user: {
            id: user.id,
            email: user.email,
          },
          companies: [],
          requiresCompanySelection: true,
        });
      }
      
      if (companies.length === 1) {
        // User has only one company - auto-select it
        const company = companies[0];
        await createSession(sessionToken, user, company.id);
        
        // Set session cookie
        reply.setCookie('sessionToken', sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 3600, // 1 hour
        });
        
        return reply.status(200).send({
          user: {
            id: user.id,
            email: user.email,
          },
          company: {
            id: company.id,
            name: company.name,
          },
          companies,
          requiresCompanySelection: false,
        });
      }
      
      // User has multiple companies - they need to select one
      await createSession(sessionToken, user);
      
      // Set session cookie
      reply.setCookie('sessionToken', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3600, // 1 hour
      });
      
      return reply.status(200).send({
        user: {
          id: user.id,
          email: user.email,
        },
        companies,
        requiresCompanySelection: true,
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
      const sessionToken = request.cookies.sessionToken;
      if (sessionToken) {
        const session = await validateSession(sessionToken);
        await destroySession(sessionToken, session?.userId);
      }
      
      // Clear session cookie
      reply.clearCookie('sessionToken');
      
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
      const sessionToken = request.cookies.sessionToken;
      if (!sessionToken) {
        return reply.status(401).send({
          error: 'No session found',
        });
      }
      
      // Validate session
      const session = await validateSession(sessionToken);
      if (!session) {
        return reply.status(401).send({
          error: 'Invalid or expired session',
        });
      }
      
      // Get user's companies
      const companies = await getUserCompanies(session.userId);
      
      return reply.status(200).send({
        user: {
          id: session.userId,
          email: session.email,
        },
        companyId: session.companyId,
        companies,
        loginTime: session.loginTime,
      });
      
    } catch (error: any) {
      request.log.error('Session info error: ' + (error.message || String(error)));
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });
};
