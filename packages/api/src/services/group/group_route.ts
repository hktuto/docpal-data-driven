// Group Routes for DocPal API
// Handles group management endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  getGroups, 
  getGroupById, 
  createGroup, 
  updateGroup, 
  deleteGroup,
  getGroupsWithMemberCounts,
  getGroupMembers,
  addUserToGroup,
  removeUserFromGroup,
  getUserGroups,
  searchGroups,
  CreateGroupData,
  UpdateGroupData
} from './group_service';

// Schemas
const groupSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    auto_join: { type: 'boolean' },
    auto_join_rule: { type: 'object' }
  },
  required: ['id', 'name', 'slug', 'description', 'created_at', 'updated_at', 'auto_join', 'auto_join_rule']
} as const;

const groupWithMembersSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    auto_join: { type: 'boolean' },
    auto_join_rule: { type: 'object' },
    member_count: { type: 'integer' }
  },
  required: ['id', 'name', 'slug', 'description', 'created_at', 'updated_at', 'auto_join', 'auto_join_rule', 'member_count']
} as const;

const groupMemberSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    user_id: { type: 'string' },
    group_id: { type: 'string' },
    description: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'user_id', 'group_id', 'created_at', 'updated_at']
} as const;

const createGroupSchema = {
  tags: ['groups'],
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 128 },
      slug: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-z0-9-_]+$' },
      description: { type: 'string', minLength: 1, maxLength: 256 },
      auto_join: { type: 'boolean' },
      auto_join_rule: { type: 'object' }
    },
    required: ['name', 'slug', 'description'],
    additionalProperties: false
  },
  response: {
    201: groupSchema,
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
} as const;

const updateGroupSchema = {
  tags: ['groups'],
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 128 },
      slug: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[a-z0-9-_]+$' },
      description: { type: 'string', minLength: 1, maxLength: 256 },
      auto_join: { type: 'boolean' },
      auto_join_rule: { type: 'object' }
    },
    additionalProperties: false
  },
  response: {
    200: groupSchema,
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

const getGroupSchema = {
  tags: ['groups'],
  response: {
    200: groupSchema,
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
} as const;

const getGroupsSchema = {
  tags: ['groups'],
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      with_members: { type: 'boolean', default: false }
    }
  },
  response: {
    200: {
      oneOf: [
        {
          type: 'array',
          items: groupSchema
        },
        {
          type: 'array',
          items: groupWithMembersSchema
        }
      ]
    }
  }
} as const;

const addUserToGroupSchema = {
  tags: ['groups'],
  body: {
    type: 'object',
    properties: {
      user_id: { type: 'string', format: 'uuid' },
      description: { type: 'string', maxLength: 256 }
    },
    required: ['user_id'],
    additionalProperties: false
  },
  response: {
    201: groupMemberSchema,
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

/**
 * Register group routes
 */
export const registerGroupRoutes = async (fastify: FastifyInstance) => {
  // GET /api/groups - List all groups
  fastify.get('/groups', {
    schema: getGroupsSchema,
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { search, limit, with_members } = request.query as { 
        search?: string; 
        limit?: number; 
        with_members?: boolean 
      };
      
      let groups;
      if (search) {
        groups = await searchGroups(companyId, search, limit || 50);
      } else if (with_members) {
        groups = await getGroupsWithMemberCounts(companyId);
      } else {
        groups = await getGroups(companyId);
      }
      
      return reply.status(200).send(groups);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/groups - Create new group
  fastify.post('/groups', {
    schema: createGroupSchema,
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const groupData = request.body as CreateGroupData;
      
      const group = await createGroup(companyId, groupData);
      
      return reply.status(201).send(group);
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error && error.message.includes('already exists')) {
        return reply.status(400).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/groups/:groupId - Get group by ID
  fastify.get('/groups/:groupId', {
    schema: getGroupSchema,
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { groupId } = request.params as { groupId: string };
      
      const group = await getGroupById(companyId, groupId);
      
      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }
      
      return reply.status(200).send(group);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/groups/:groupId - Update group
  fastify.put('/groups/:groupId', {
    schema: updateGroupSchema,
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { groupId } = request.params as { groupId: string };
      const updateData = request.body as UpdateGroupData;
      
      const group = await updateGroup(companyId, groupId, updateData);
      
      return reply.status(200).send(group);
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return reply.status(400).send({ error: error.message });
        }
        if (error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/groups/:groupId - Delete group
  fastify.delete('/groups/:groupId', {
    tags: ['groups'],
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
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { groupId } = request.params as { groupId: string };
      
      await deleteGroup(companyId, groupId);
      
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        if (error.message.includes('with members')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/groups/:groupId/members - Get group members
  fastify.get('/groups/:groupId/members', {
    tags: ['groups'],
    response: {
      200: {
        type: 'array',
        items: groupMemberSchema
      },
      404: {
        type: 'object',
        properties: {
          error: { type: 'string' }
        }
      }
    },
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { groupId } = request.params as { groupId: string };
      
      // First check if group exists
      const group = await getGroupById(companyId, groupId);
      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }
      
      const members = await getGroupMembers(companyId, groupId);
      
      return reply.status(200).send(members);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/groups/:groupId/members - Add user to group
  fastify.post('/groups/:groupId/members', {
    schema: addUserToGroupSchema,
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { groupId } = request.params as { groupId: string };
      const { user_id, description } = request.body as { user_id: string; description?: string };
      
      const member = await addUserToGroup(companyId, groupId, user_id, description);
      
      return reply.status(201).send(member);
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        if (error.message.includes('already a member')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/groups/:groupId/members/:userId - Remove user from group
  fastify.delete('/groups/:groupId/members/:userId', {
    tags: ['groups'],
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
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { groupId, userId } = request.params as { groupId: string; userId: string };
      
      await removeUserFromGroup(companyId, groupId, userId);
      
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error) {
        if (error.message.includes('not a member')) {
          return reply.status(400).send({ error: error.message });
        }
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
};
