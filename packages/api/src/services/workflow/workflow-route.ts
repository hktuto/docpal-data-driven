import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, SessionContext } from '../auth/auth_middleware';
import { requireCompany } from '../company/company_middleware';
import {
  getWorkflowDefinitions,
  getWorkflowDefinition,
  createWorkflowDefinition,
  updateWorkflowDefinition,
  deleteWorkflowDefinition,
  getWorkflowExecutions,
  getWorkflowExecution,
  getUserTasks,
  getUserTask,
  completeUserTask,
  CreateWorkflowRequest,
  UpdateWorkflowRequest
} from './workflow-service';
import {
  triggerWorkflowExecution,
  syncWorkflowExecutionStatus,
  cancelWorkflowExecution,
  completeWorkflowUserTask
} from './workflow-execution-service';

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' }
  },
  required: ['error']
} as const;

// Schema definitions for request validation
const createWorkflowSchema = {
  tags: ['workflow'],
  description: 'Create a new workflow definition',
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      slug: { type: 'string', pattern: '^[a-z][a-z0-9_-]*$', maxLength: 100 },
      version: { type: 'string', maxLength: 20 },
      definition: { type: 'object' },
      events: { type: 'object' },
      status: { type: 'string', enum: ['active', 'inactive', 'draft'] }
    },
    required: ['name', 'slug', 'definition']
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        version: { type: 'string' },
        definition: { type: 'object' },
        events: { type: 'object' },
        status: { type: 'string' },
        created_by: { type: 'string' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' }
      }
    },
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    500: errorSchema
  }
} as const;

const updateWorkflowSchema = {
  tags: ['workflow'],
  description: 'Update an existing workflow definition',
  params: {
    type: 'object',
    properties: {
      slug: { type: 'string' }
    },
    required: ['slug']
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      definition: { type: 'object' },
      events: { type: 'object' },
      status: { type: 'string', enum: ['active', 'inactive', 'draft'] }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        version: { type: 'string' },
        definition: { type: 'object' },
        events: { type: 'object' },
        status: { type: 'string' },
        created_by: { type: 'string' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' }
      }
    },
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    404: errorSchema,
    500: errorSchema
  }
} as const;

const workflowParamsSchema = {
  params: {
    type: 'object',
    properties: {
      slug: { type: 'string' }
    },
    required: ['slug']
  }
} as const;

const executionParamsSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' }
    },
    required: ['id']
  }
} as const;

const taskParamsSchema = {
  tags: ['workflow'],
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' }
    },
    required: ['id']
  }
} as const;

const completeTaskSchema = {
  tags: ['workflow'],
  description: 'Complete a user task in a workflow execution',
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' }
    },
    required: ['id']
  },
  body: {
    type: 'object',
    properties: {
      result: { type: 'object' }
    },
    required: ['result']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        workflow_execution_id: { type: 'string' },
        step_id: { type: 'string' },
        assignee_id: { type: 'string' },
        candidate: { type: 'object' },
        task_type: { type: 'string' },
        form_definition: { type: 'object' },
        context_data: { type: 'object' },
        status: { type: 'string' },
        result: { type: 'object' },
        created_at: { type: 'string' },
        completed_at: { type: 'string' },
        timeout_at: { type: 'string' }
      }
    },
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    404: errorSchema,
    500: errorSchema
  }
} as const;

const triggerWorkflowSchema = {
  tags: ['workflow'],
  description: 'Manually trigger a workflow execution',
  params: {
    type: 'object',
    properties: {
      slug: { type: 'string' }
    },
    required: ['slug']
  },
  body: {
    type: 'object',
    properties: {
      trigger_data: { type: 'object' }
    }
  },
  response: {
    201: {
      type: 'object',
      properties: {
        execution_id: { type: 'string' },
        temporal_workflow_id: { type: 'string' },
        temporal_run_id: { type: 'string' },
        message: { type: 'string' }
      }
    },
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    404: errorSchema,
    500: errorSchema
  }
} as const;

export async function workflowRoutes(fastify: FastifyInstance) {
  // Workflow Definitions Routes
  
  // GET /api/workflows - List workflow definitions
  fastify.get('/workflows', {
    schema: {
      tags: ['workflow'],
      description: 'List all workflow definitions for the current company',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          status: { type: 'string', enum: ['active', 'inactive', 'draft'] }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
              version: { type: 'string' },
              definition: { type: 'object' },
              events: { type: 'object' },
              status: { type: 'string' },
              created_by: { type: 'string' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' }
            }
          }
        },
        400: errorSchema,
        401: errorSchema,
        403: errorSchema,
        500: errorSchema
      }
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, id: userId } = request.user!;
      if (!companyId || !userId) {
        return reply.status(400).send({ error: 'Missing company or user context' });
      }
      const workflows = await getWorkflowDefinitions(companyId, userId);
      return reply.status(200).send(workflows);
    } catch (error) {
      fastify.log.error(error, 'Error fetching workflows');
      return reply.status(500).send({ error: 'Failed to fetch workflows' });
    }
  });

  // POST /api/workflows - Create workflow definition
  fastify.post('/workflows', {
    schema: createWorkflowSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, id: userId } = request.user!;
      if (!companyId || !userId) {
        return reply.status(400).send({ error: 'Missing company or user context' });
      }
      const workflowData = request.body as CreateWorkflowRequest;
      
      const workflow = await createWorkflowDefinition(companyId, userId, workflowData);
      return reply.status(201).send(workflow);
    } catch (error: any) {
      fastify.log.error('Error creating workflow:', error);
      if (error.message.includes('already exists')) {
        return reply.status(400).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Failed to create workflow' });
    }
  });

  // GET /api/workflows/:slug - Get workflow definition
  fastify.get('/workflows/:slug', {
    schema: {
      tags: ['workflow'],
      description: 'Get a specific workflow definition by slug',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' }
        },
        required: ['slug']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            version: { type: 'string' },
            definition: { type: 'object' },
            events: { type: 'object' },
            status: { type: 'string' },
            created_by: { type: 'string' },
            created_at: { type: 'string' },
            updated_at: { type: 'string' }
          }
        },
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        500: errorSchema
      }
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, id: userId } = request.user!;
      if (!companyId || !userId) {
        return reply.status(400).send({ error: 'Missing company or user context' });
      }
      const { slug } = request.params as { slug: string };
      
      const workflow = await getWorkflowDefinition(companyId, slug, userId);
      if (!workflow) {
        return reply.status(404).send({ error: 'Workflow not found' });
      }
      
      return reply.status(200).send(workflow);
    } catch (error) {
      fastify.log.error(error, 'Error fetching workflow');
      return reply.status(500).send({ error: 'Failed to fetch workflow' });
    }
  });

  // PUT /api/workflows/:slug - Update workflow definition
  fastify.put('/workflows/:slug', {
    schema: updateWorkflowSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, id: userId } = request.user!;
      if (!companyId || !userId) {
        return reply.status(400).send({ error: 'Missing company or user context' });
      }
      const { slug } = request.params as { slug: string };
      const updateData = request.body as UpdateWorkflowRequest;
      
      const workflow = await updateWorkflowDefinition(companyId, slug, userId, updateData);
      return reply.status(200).send(workflow);
    } catch (error: any) {
      fastify.log.error('Error updating workflow:', error);
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Failed to update workflow' });
    }
  });

  // DELETE /api/workflows/:slug - Delete workflow definition
  fastify.delete('/workflows/:slug', {
    schema: {
      tags: ['workflow'],
      description: 'Delete a workflow definition',
      ...workflowParamsSchema,
      response: {
        204: { type: 'null' },
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        409: errorSchema,
        500: errorSchema
      }
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, id: userId } = request.user!;
      if (!companyId || !userId) {
        return reply.status(400).send({ error: 'Missing company or user context' });
      }
      const { slug } = request.params as { slug: string };
      
      await deleteWorkflowDefinition(companyId, slug, userId);
      return reply.status(204).send();
    } catch (error: any) {
      fastify.log.error('Error deleting workflow:', error);
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: error.message });
      }
      if (error.message.includes('running executions')) {
        return reply.status(409).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Failed to delete workflow' });
    }
  });

  // POST /api/workflows/:slug/trigger - Manually trigger workflow
  fastify.post('/workflows/:slug/trigger', {
    schema: triggerWorkflowSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, id: userId } = request.user!;
      if (!companyId || !userId) {
        return reply.status(400).send({ error: 'Missing company or user context' });
      }
      const { slug } = request.params as { slug: string };
      const { trigger_data } = request.body as { trigger_data?: any };
      
      const result = await triggerWorkflowExecution(companyId, userId, {
        workflowSlug: slug,
        triggerData: trigger_data,
        userId,
      });

      return reply.status(201).send({
        execution_id: result.executionId,
        temporal_workflow_id: result.temporalWorkflowId,
        temporal_run_id: result.temporalRunId,
        message: result.message
      });
    } catch (error: any) {
      fastify.log.error('Error triggering workflow:', error);
      if (error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      if (error.message.includes('not active')) {
        return reply.status(400).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Failed to trigger workflow' });
    }
  });

  // Workflow Executions Routes

  // GET /api/workflows/:slug/executions - List workflow executions
  fastify.get('/workflows/:slug/executions', {
    schema: {
      tags: ['workflow'],
      description: 'List workflow executions for a specific workflow',
      ...workflowParamsSchema,
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              workflow_definition_id: { type: 'string' },
              definition: { type: 'object' },
              temporal_workflow_id: { type: 'string' },
              temporal_run_id: { type: 'string' },
              trigger_data: { type: 'object' },
              status: { type: 'string' },
              started_at: { type: 'string' },
              completed_at: { type: 'string' },
              result: { type: 'object' },
              error_message: { type: 'string' },
              workflow_name: { type: 'string' },
              workflow_slug: { type: 'string' }
            }
          }
        },
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        500: errorSchema
      }
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, id: userId } = request.user!;
      if (!companyId || !userId) {
        return reply.status(400).send({ error: 'Missing company or user context' });
      }
      const { slug } = request.params as { slug: string };
      const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number };
      
      // Verify workflow exists and user has access
      const workflow = await getWorkflowDefinition(companyId, slug, userId);
      if (!workflow) {
        return reply.status(404).send({ error: 'Workflow not found' });
      }
      
      const executions = await getWorkflowExecutions(companyId, slug, limit, offset);
      return reply.status(200).send(executions);
    } catch (error) {
      fastify.log.error(error, 'Error fetching workflow executions');
      return reply.status(500).send({ error: 'Failed to fetch workflow executions' });
    }
  });

  // GET /api/workflows/executions/:id - Get workflow execution details
  fastify.get('/workflows/executions/:id', {
    schema: {
      tags: ['workflow'],
      description: 'Get details of a specific workflow execution',
      ...executionParamsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workflow_definition_id: { type: 'string' },
            definition: { type: 'object' },
            temporal_workflow_id: { type: 'string' },
            temporal_run_id: { type: 'string' },
            trigger_data: { type: 'object' },
            status: { type: 'string' },
            started_at: { type: 'string' },
            completed_at: { type: 'string' },
            result: { type: 'object' },
            error_message: { type: 'string' },
            workflow_name: { type: 'string' },
            workflow_slug: { type: 'string' }
          }
        },
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        500: errorSchema
      }
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request.user!;
      if (!companyId) {
        return reply.status(400).send({ error: 'Missing company context' });
      }
      const { id } = request.params as { id: string };
      
      const execution = await getWorkflowExecution(companyId, id);
      if (!execution) {
        return reply.status(404).send({ error: 'Workflow execution not found' });
      }
      
      return reply.status(200).send(execution);
    } catch (error) {
      fastify.log.error(error, 'Error fetching workflow execution');
      return reply.status(500).send({ error: 'Failed to fetch workflow execution' });
    }
  });

  // POST /api/workflows/executions/:id/cancel - Cancel workflow execution
  fastify.post('/workflows/executions/:id/cancel', {
    schema: {
      tags: ['workflow'],
      description: 'Cancel a running workflow execution',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            status: { type: 'string' }
          }
        },
        400: errorSchema,
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        500: errorSchema
      }
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request.user!;
      if (!companyId) {
        return reply.status(400).send({ error: 'Missing company context' });
      }
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason?: string };
      
      const execution = await cancelWorkflowExecution(companyId, id, reason);
      
      return reply.status(200).send({
        message: 'Workflow execution cancelled successfully',
        status: execution.status
      });
    } catch (error: any) {
      fastify.log.error('Error cancelling workflow execution:', error);
      if (error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      if (error.message.includes('Cannot cancel')) {
        return reply.status(400).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Failed to cancel workflow execution' });
    }
  });

  // User Tasks Routes

  // GET /api/user-tasks - List user tasks
  fastify.get('/user-tasks', {
    schema: {
      tags: ['workflow'],
      description: 'List user tasks assigned to the current user',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'assigned', 'completed', 'cancelled', 'timeout'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              workflow_execution_id: { type: 'string' },
              step_id: { type: 'string' },
              assignee_id: { type: 'string' },
              candidate: { type: 'object' },
              task_type: { type: 'string' },
              form_definition: { type: 'object' },
              context_data: { type: 'object' },
              status: { type: 'string' },
              result: { type: 'object' },
              created_at: { type: 'string' },
              completed_at: { type: 'string' },
              timeout_at: { type: 'string' },
              temporal_workflow_id: { type: 'string' },
              workflow_name: { type: 'string' },
              workflow_slug: { type: 'string' }
            }
          }
        },
        401: errorSchema,
        403: errorSchema,
        500: errorSchema
      }
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, id: userId } = request.user!;
      if (!companyId || !userId) {
        return reply.status(400).send({ error: 'Missing company or user context' });
      }
      const { status, limit = 50, offset = 0 } = request.query as { 
        status?: 'pending' | 'assigned' | 'completed' | 'cancelled' | 'timeout';
        limit?: number; 
        offset?: number;
      };
      
      const tasks = await getUserTasks(companyId, userId, status, limit, offset);
      return reply.status(200).send(tasks);
    } catch (error) {
      fastify.log.error(error, 'Error fetching user tasks');
      return reply.status(500).send({ error: 'Failed to fetch user tasks' });
    }
  });

  // GET /api/user-tasks/:id - Get user task details
  fastify.get('/user-tasks/:id', {
    schema: {
      tags: ['workflow'],
      description: 'Get details of a specific user task',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workflow_execution_id: { type: 'string' },
            step_id: { type: 'string' },
            assignee_id: { type: 'string' },
            candidate: { type: 'object' },
            task_type: { type: 'string' },
            form_definition: { type: 'object' },
            context_data: { type: 'object' },
            status: { type: 'string' },
            result: { type: 'object' },
            created_at: { type: 'string' },
            completed_at: { type: 'string' },
            timeout_at: { type: 'string' },
            temporal_workflow_id: { type: 'string' },
            workflow_name: { type: 'string' },
            workflow_slug: { type: 'string' }
          }
        },
        401: errorSchema,
        403: errorSchema,
        404: errorSchema,
        500: errorSchema
      }
    },
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, id: userId } = request.user!;
      if (!companyId || !userId) {
        return reply.status(400).send({ error: 'Missing company or user context' });
      }
      const { id } = request.params as { id: string };
      
      const task = await getUserTask(companyId, id, userId);
      if (!task) {
        return reply.status(404).send({ error: 'User task not found or access denied' });
      }
      
      return reply.status(200).send(task);
    } catch (error) {
      fastify.log.error(error, 'Error fetching user task');
      return reply.status(500).send({ error: 'Failed to fetch user task' });
    }
  });

  // POST /api/user-tasks/:id/complete - Complete user task
  fastify.post('/user-tasks/:id/complete', {
    schema: completeTaskSchema,
    preHandler: [requireAuth, requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, id: userId } = request.user!;
      if (!companyId || !userId) {
        return reply.status(400).send({ error: 'Missing company or user context' });
      }
      const { id } = request.params as { id: string };
      const { result } = request.body as { result: any };
      
      // Complete the task and signal the workflow
      const completionResult = await completeWorkflowUserTask(companyId, id, userId, result);
      
      // Get the updated task
      const task = await getUserTask(companyId, id, userId);
      
      return reply.status(200).send({
        ...task,
        _completion: completionResult
      });
    } catch (error: any) {
      fastify.log.error('Error completing user task:', error);
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Failed to complete user task' });
    }
  });
}
