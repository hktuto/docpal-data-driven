// User Profile Routes for DocPal API
// Handles user profile management endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  getUserProfiles, 
  getUserProfileById, 
  createUserProfile, 
  updateUserProfile, 
  deleteUserProfile,
  searchUserProfiles,
  CreateUserProfileData,
  UpdateUserProfileData
} from './user_service';
import {
  assignRoleToUser,
  removeRoleFromUser,
  getUserRole,
  assignUserToGroup,
  removeUserFromGroupAssignment,
  getUserGroupAssignments,
  getUserWithAssignments,
  getUsersWithAssignments
} from './user-assignment-service';

// Schemas
const userProfileSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string', nullable: true },
    address: { type: 'string', nullable: true },
    city: { type: 'string', nullable: true },
    preferences: { type: 'object' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    created_by: { type: 'string' }
  },
  required: ['id', 'name', 'email', 'preferences', 'created_at', 'updated_at', 'created_by']
} as const;

const createUserProfileSchema = {
  tags: ['users'],
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 128 },
      email: { type: 'string', format: 'email', maxLength: 128 },
      phone: { type: 'string', maxLength: 128 },
      address: { type: 'string', maxLength: 256 },
      city: { type: 'string', maxLength: 128 },
      preferences: { type: 'object' }
    },
    required: ['name', 'email'],
    additionalProperties: false
  },
  response: {
    201: userProfileSchema,
    400: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
} as const;

const updateUserProfileSchema = {
  tags: ['users'],
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 128 },
      email: { type: 'string', format: 'email', maxLength: 128 },
      phone: { type: 'string', maxLength: 128 },
      address: { type: 'string', maxLength: 256 },
      city: { type: 'string', maxLength: 128 },
      preferences: { type: 'object' }
    },
    additionalProperties: false
  },
  response: {
    200: userProfileSchema,
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

const getUserProfileSchema = {
  tags: ['users'],
  response: {
    200: userProfileSchema,
    404: {
      type: 'object',
      properties: {
        error: { type: 'string' }
      }
    }
  }
} as const;

const getUserProfilesSchema = {
  tags: ['users'],
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      with_assignments: { type: 'boolean', default: false }
    }
  },
  response: {
    200: {
      oneOf: [
        {
          type: 'array',
          items: userProfileSchema
        },
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              user_id: { type: 'string' },
              role_id: { type: 'string', nullable: true },
              role_name: { type: 'string', nullable: true },
              groups: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    group_id: { type: 'string' },
                    group_name: { type: 'string' },
                    assigned_at: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      ]
    }
  }
} as const;

const assignRoleSchema = {
  tags: ['users'],
  body: {
    type: 'object',
    properties: {
      role_id: { type: 'string', format: 'uuid' }
    },
    required: ['role_id'],
    additionalProperties: false
  },
  response: {
    200: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        role_id: { type: 'string' },
        assigned_at: { type: 'string', format: 'date-time' }
      }
    },
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

const assignGroupSchema = {
  tags: ['users'],
  body: {
    type: 'object',
    properties: {
      group_id: { type: 'string', format: 'uuid' },
      description: { type: 'string', maxLength: 256 }
    },
    required: ['group_id'],
    additionalProperties: false
  },
  response: {
    201: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        group_id: { type: 'string' },
        assigned_at: { type: 'string', format: 'date-time' }
      }
    },
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
 * Register user profile routes
 */
export const registerUserRoutes = async (fastify: FastifyInstance) => {
  // GET /api/users - List all user profiles
  fastify.get('/users', {
    schema: getUserProfilesSchema,
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { search, limit, with_assignments } = request.query as { 
        search?: string; 
        limit?: number; 
        with_assignments?: boolean 
      };
      
      let profiles;
      if (with_assignments) {
        profiles = await getUsersWithAssignments(companyId);
      } else if (search) {
        profiles = await searchUserProfiles(companyId, search, limit || 50);
      } else {
        profiles = await getUserProfiles(companyId);
      }
      
      return reply.status(200).send(profiles);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/users - Create new user profile
  fastify.post('/users', {
    schema: createUserProfileSchema,
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId, userId } = request as any;
      const profileData = request.body as CreateUserProfileData;
      
      const profile = await createUserProfile(companyId, profileData, userId);
      
      return reply.status(201).send(profile);
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error && error.message.includes('already exists')) {
        return reply.status(400).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/users/:userId - Get user profile by ID
  fastify.get('/users/:userId', {
    schema: getUserProfileSchema,
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { userId } = request.params as { userId: string };
      
      const profile = await getUserProfileById(companyId, userId);
      
      if (!profile) {
        return reply.status(404).send({ error: 'User profile not found' });
      }
      
      return reply.status(200).send(profile);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/users/:userId - Update user profile
  fastify.put('/users/:userId', {
    schema: updateUserProfileSchema,
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { userId } = request.params as { userId: string };
      const updateData = request.body as UpdateUserProfileData;
      
      const profile = await updateUserProfile(companyId, userId, updateData);
      
      return reply.status(200).send(profile);
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

  // DELETE /api/users/:userId - Delete user profile
  fastify.delete('/users/:userId', {
    tags: ['users'],
    response: {
      204: { type: 'null' },
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
      const { userId } = request.params as { userId: string };
      
      await deleteUserProfile(companyId, userId);
      
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/users/:userId/role - Assign role to user
  fastify.put('/users/:userId/role', {
    schema: assignRoleSchema,
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { userId } = request.params as { userId: string };
      const { role_id } = request.body as { role_id: string };
      
      const assignment = await assignRoleToUser(companyId, userId, role_id);
      
      return reply.status(200).send(assignment);
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/users/:userId/role - Remove role from user
  fastify.delete('/users/:userId/role', {
    tags: ['users'],
    response: {
      204: { type: 'null' },
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
      const { userId } = request.params as { userId: string };
      
      await removeRoleFromUser(companyId, userId);
      
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/users/:userId/group - Assign user to group
  fastify.put('/users/:userId/group', {
    schema: assignGroupSchema,
    preHandler: [fastify.authenticate, fastify.requireCompany]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { companyId } = request as any;
      const { userId } = request.params as { userId: string };
      const { group_id, description } = request.body as { group_id: string; description?: string };
      
      const assignment = await assignUserToGroup(companyId, userId, group_id, description);
      
      return reply.status(201).send(assignment);
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

  // DELETE /api/users/:userId/group/:groupId - Remove user from group
  fastify.delete('/users/:userId/group/:groupId', {
    tags: ['users'],
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
      const { userId, groupId } = request.params as { userId: string; groupId: string };
      
      await removeUserFromGroupAssignment(companyId, userId, groupId);
      
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

  // GET /api/users/:userId/assignments - Get user's role and group assignments
  fastify.get('/users/:userId/assignments', {
    tags: ['users'],
    response: {
      200: {
        type: 'object',
        properties: {
          user_id: { type: 'string' },
          role_id: { type: 'string', nullable: true },
          role_name: { type: 'string', nullable: true },
          groups: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                group_id: { type: 'string' },
                group_name: { type: 'string' },
                assigned_at: { type: 'string', format: 'date-time' }
              }
            }
          }
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
      const { userId } = request.params as { userId: string };
      
      const assignments = await getUserWithAssignments(companyId, userId);
      
      if (!assignments) {
        return reply.status(404).send({ error: 'User not found or has no assignments' });
      }
      
      return reply.status(200).send(assignments);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
};
