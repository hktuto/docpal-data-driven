// Authentication middleware for DocPal API

import { FastifyRequest, FastifyReply } from 'fastify';
import { SessionData, validateSession } from './auth_service';

// Extend FastifyRequest to include user data
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      companyId?: string;
      storeId?: string;
    };
  }
}


export interface SessionRequest extends FastifyRequest {
  user?:SessionContext
}
export interface SessionContext  {
  id: string;
  email: string;
  companyId?: string;
}
/**
 * Authentication middleware - requires valid session
 */
export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const sessionToken = request.cookies.sessionToken;
    
    if (!sessionToken) {
      return reply.status(401).send({
        error: 'Authentication required',
      });
    }
    
    // Validate session
    const session = await validateSession(sessionToken);
    if (!session) {
      return reply.status(401).send({
        error: 'Invalid or expired session',
      });
    }
    // Add user data to request
    request.user = {
      id: session.userId,
      email: session.email,
      companyId: session.companyId,
      storeId: session.storeId
    };
    
    // Note: Audit context setup removed for simplicity
    // Audit triggers will capture operations with operation_source: 'system'
    // User attribution can be added later when needed
    
  } catch (error: any) {
    request.log.error('Auth middleware error: ' + (error.message || String(error)));
    return reply.status(500).send({
      error: 'Internal server error',
    });
  }
};

/**
 * Company context middleware - requires user to have selected a company
 */
export const requireCompany = async (request: FastifyRequest, reply: FastifyReply) => {
  // First ensure user is authenticated
  await requireAuth(request, reply);
  
  // Check if user has selected a company
  if (!request.user?.companyId) {
    return reply.status(403).send({
      error: 'Company selection required',
    });
  }
};

/**
 * Optional authentication middleware - adds user data if session exists
 */
export const optionalAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const sessionToken = request.cookies.sessionToken;
    
    if (sessionToken) {
      const session = await validateSession(sessionToken);
      if (session) {
        request.user = {
          id: session.userId,
          email: session.email,
          companyId: session.companyId,
        };
        
        // Note: Audit context setup removed for simplicity
        // Audit triggers will capture operations with operation_source: 'system'
      }
    }
    
    // Note: All operations will be audited as 'system' for now
    // This provides complete operation tracking without user attribution complexity
    
  } catch (error: any) {
    // Log error but don't fail the request for optional auth
    request.log.warn('Optional auth middleware error: ' + (error.message || String(error)));
  }
};
