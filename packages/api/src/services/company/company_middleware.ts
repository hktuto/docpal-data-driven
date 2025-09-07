import { FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../../database/utils/database';
import { checkUserCompanyAccess } from './company_service';
import { SessionRequest } from '../auth/auth_middleware';

/**
 * Middleware to require company selection
 * Ensures user has selected a company and has access to it
 */
export const requireCompany = async (
  request,
  reply
) => {
  try {
    // Check if user is authenticated (should be handled by requireAuth middleware)
    if (!request.user?.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    // Check if company is selected in session
    if (!request.user.companyId) {
      return reply.status(400).send({ 
        error: 'Company selection required',
        code: 'COMPANY_NOT_SELECTED'
      });
    }

    const pool = getPool();
    const userId = request.user.id;
    const companyId = request.user.companyId;
    // Verify user still has access to the selected company
    const access = await checkUserCompanyAccess(pool, userId, companyId);
    if (!access.hasAccess) {
      // Clear invalid company from session
      delete request.user.companyId;
      
      return reply.status(403).send({ 
        error: 'Access denied to selected company',
        code: 'COMPANY_ACCESS_DENIED'
      });
    }

    // Update role in session if it has changed
    if (request.user.role !== access.role) {
      request.user.role = access.role!;
    }

  } catch (error: any) {
    request.log.error('------------- Error in requireCompany middleware: ' + (error.message || String(error)));
    return reply.status(500).send({ error: 'Internal server error' });
  }
};

/**
 * Middleware to require specific role in company
 */
export const requireRole = (allowedRoles: string[]) => {
  return async (request, reply) => {
    try {
      // First ensure company is selected
      await requireCompany(request, reply);
      
      // If requireCompany already sent a response, don't continue
      if (reply.sent) {
        return;
      }

      const userRole = request.user?.role;
      if (!userRole || !allowedRoles.includes(userRole)) {
        return reply.status(403).send({ 
          error: `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`,
          code: 'INSUFFICIENT_ROLE'
        });
      }

    } catch (error: any) {
      request.log.error('Error in requireRole middleware: ' + (error.message || String(error)));
      return reply.status(500).send({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to require admin role (owner or admin)
 */
export const requireAdmin = requireRole(['owner', 'admin']);

/**
 * Middleware to require owner role
 */
export const requireOwner = requireRole(['owner']);

/**
 * Optional company middleware - doesn't fail if no company selected
 * But validates access if company is selected
 */
export const optionalCompany = async (
  request,
  reply
) => {
  try {
    // Skip if no company selected
    if (!request.user.companyId) {
      return;
    }

    // If company is selected, validate access
    const pool = getPool();
    const userId = request.user?.id;
    const companyId = request.user.companyId;

    if (!userId) {
      return;
    }

    const access = await checkUserCompanyAccess(pool, userId, companyId);
    if (!access.hasAccess) {
      // Clear invalid company from session
      delete request.user.companyId;
      request.log.warn(`Cleared invalid company ${companyId} from session for user ${userId}`);
    } else if (request.user.role !== access.role) {
      // Update role if it has changed
      request.user.role = access.role!;
    }

  } catch (error: any) {
    request.log.error('Error in optionalCompany middleware: ' + (error.message || String(error)));
    // Don't fail the request for optional middleware
  }
};
