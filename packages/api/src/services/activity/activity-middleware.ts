// DocPal Activity Logging Middleware
// Fastify hooks for automatic activity logging

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  logActivity, 
  shouldLogRequest, 
  extractActivityFromRequest,
  ActivityEntry 
} from './activity-service';

/**
 * Register activity logging hooks with Fastify
 */
export const registerActivityLogging = (fastify: FastifyInstance) => {
  // Store request data for later use in onSend hook
  const requestStore = new Map<string, {
    startTime: number;
    method: string;
    url: string;
    userAgent?: string;
    ipAddress?: string;
    session?: any;
  }>();

  /**
   * onRequest Hook: Capture request metadata
   */
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id;
    
    // Skip if not a loggable request
    if (!shouldLogRequest(request.method, request.url)) {
      return;
    }
    
    // Store request metadata
    requestStore.set(requestId, {
      startTime: Date.now(),
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
      session: (request as any).session
    });
  });

  /**
   * onSend Hook: Log activity after successful response
   */
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    const requestId = request.id;
    const requestData = requestStore.get(requestId);
    
    // Clean up request store
    requestStore.delete(requestId);
    
    // Skip if no request data or not a loggable request
    if (!requestData || !shouldLogRequest(request.method, request.url)) {
      return payload;
    }
    
    // Skip if response indicates failure
    if (reply.statusCode >= 400) {
      return payload;
    }
    
    try {
      // Get user data from auth middleware
      const user = (request as any).user;
      if (!user?.id || !user?.companyId) {
        // Skip logging if no authenticated user
        return payload;
      }
      
      // Parse response body if it's JSON
      let responseBody;
      try {
        responseBody = typeof payload === 'string' ? JSON.parse(payload) : payload;
      } catch {
        responseBody = payload;
      }
      
      // Extract activity information from request/response
      const activityData = extractActivityFromRequest(request, reply, responseBody);
      
      if (activityData && activityData.action && activityData.entity_type) {
        // Create complete activity entry
        const activity: ActivityEntry = {
          action: activityData.action,
          entity_type: activityData.entity_type,
          entity_id: activityData.entity_id,
          table_name: activityData.table_name,
          data: activityData.data || {},
          user_id: user.id,
          user_email: user.email || 'unknown@example.com',
          metadata: {
            ip_address: requestData.ipAddress,
            user_agent: requestData.userAgent,
            request_id: requestId,
            response_time_ms: Date.now() - requestData.startTime,
            status_code: reply.statusCode
          }
        };
        
        // Log activity asynchronously (don't block response)
        setImmediate(() => {
          logActivity(user.companyId, activity).catch(error => {
            console.error('Failed to log activity:', error);
          });
        });
      }
    } catch (error) {
      // Log error but don't fail the response
      console.error('Error in activity logging hook:', error);
    }
    
    return payload;
  });

  /**
   * onError Hook: Log failed operations
   */
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const requestId = request.id;
    const requestData = requestStore.get(requestId);
    
    // Clean up request store
    requestStore.delete(requestId);
    
    // Skip if no request data or not a loggable request
    if (!requestData || !shouldLogRequest(request.method, request.url)) {
      return;
    }
    
    try {
      // Get user data from auth middleware
      const user = (request as any).user;
      if (!user?.id || !user?.companyId) {
        return;
      }
      
      // Log error activity
      const activity: ActivityEntry = {
        action: 'ERROR',
        entity_type: 'system',
        data: {
          error_message: error.message,
          error_stack: error.stack,
          request_method: request.method,
          request_url: request.url,
          request_body: request.body
        },
        user_id: user.id,
        user_email: user.email || 'unknown@example.com',
        metadata: {
          ip_address: requestData.ipAddress,
          user_agent: requestData.userAgent,
          request_id: requestId,
          response_time_ms: Date.now() - requestData.startTime,
          status_code: reply.statusCode || 500
        }
      };
      
      // Log error activity asynchronously
      setImmediate(() => {
        logActivity(user.companyId, activity).catch(logError => {
          console.error('Failed to log error activity:', logError);
        });
      });
    } catch (hookError) {
      console.error('Error in activity logging error hook:', hookError);
    }
  });

  /**
   * Cleanup hook to prevent memory leaks
   */
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    // Ensure request data is cleaned up
    requestStore.delete(request.id);
  });
};

/**
 * Manual activity logging function for custom operations
 * Use this when you need to log activities that don't fit the automatic patterns
 */
export const logCustomActivity = async (
  request: FastifyRequest,
  activity: Omit<ActivityEntry, 'user_id' | 'user_email' | 'metadata'>
): Promise<void> => {
  try {
    const user = (request as any).user;
    if (!user?.id || !user?.companyId) {
      return;
    }
    
    const completeActivity: ActivityEntry = {
      ...activity,
      user_id: user.id,
      user_email: user.email || 'unknown@example.com',
      metadata: {
        ip_address: request.ip,
        user_agent: request.headers['user-agent'],
        request_id: request.id,
        manual_log: true
      }
    };
    
    await logActivity(user.companyId, completeActivity);
  } catch (error) {
    console.error('Failed to log custom activity:', error);
  }
};
